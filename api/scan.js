export const config = { runtime: 'edge' };

// Yahoo Finance interval → lookback in seconds and data points needed
const TF_MAP = {
  '15m': { yInterval: '15m',  lookbackDays: 5,   minBars: 40 },
  '30m': { yInterval: '30m',  lookbackDays: 8,   minBars: 40 },
  '1h':  { yInterval: '1h',   lookbackDays: 14,  minBars: 40 },
  '4h':  { yInterval: '4h',   lookbackDays: 30,  minBars: 40 },
  '1d':  { yInterval: '1d',   lookbackDays: 130, minBars: 30 },
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const tfKey = searchParams.get('interval') || '1d';
  const tf = TF_MAP[tfKey] || TF_MAP['1d'];

  if (!symbol) return err('No symbol', 400);

  const sources = [
    () => fetchYahoo('query2', symbol, tf),
    () => fetchYahoo('query1', symbol, tf),
  ];

  let lastError = '';
  for (const source of sources) {
    try {
      const data = await source();
      if (data && data.closes && data.closes.length >= tf.minBars) {
        return ok(compute(symbol, tf, data));
      }
    } catch (e) {
      lastError = e.message;
    }
  }
  return err('Alle Quellen fehlgeschlagen: ' + lastError, 500);
}

async function fetchYahoo(host, symbol, tf) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * tf.lookbackDays;
  const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${tf.yInterval}&period1=${from}&period2=${to}&includePrePost=false`;

  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://finance.yahoo.com/quote/${symbol}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  if (!r.ok) throw new Error(`${host} HTTP ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error(`${host} no_data`);

  const q = res.indicators.quote[0];
  return {
    closes: q.close.map(v => v ?? 0),
    volumes: q.volume.map(v => v ?? 0),
    timestamps: res.timestamp
  };
}

function compute(symbol, tf, { closes, volumes, timestamps }) {
  const n = closes.length;

  // Format dates depending on timeframe
  const dates = timestamps.map(t => {
    const d = new Date(t * 1000);
    const date = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return tf.yInterval === '1d' ? date : `${date} ${time}`;
  });

  function ema(data, p) {
    if (data.length < p) return data.map(() => null);
    const k = 2 / (p + 1); const r = [];
    let e = data.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = 0; i < p - 1; i++) r.push(null);
    r.push(e);
    for (let i = p; i < data.length; i++) { e = data[i] * k + e * (1 - k); r.push(e); }
    return r;
  }

  function sma(data, p) {
    return data.map((_, i) => i < p - 1 ? null : data.slice(i-p+1,i+1).reduce((a,b)=>a+b,0)/p);
  }

  // MACD (12, 26, 9)
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const ml = closes.map((_, i) => (e12[i]!=null && e26[i]!=null) ? e12[i]-e26[i] : null);
  const vm = ml.filter(v => v != null);
  const sr = ema(vm, 9);
  const sig = []; let si = 0;
  ml.forEach(v => { sig.push(v != null ? sr[si++] : null); });
  const hist = ml.map((v, i) => (v!=null && sig[i]!=null) ? v-sig[i] : null);

  // OBV
  const obv = [0];
  for (let i = 1; i < n; i++) {
    const p = obv[obv.length-1];
    if (closes[i] > closes[i-1]) obv.push(p + volumes[i]);
    else if (closes[i] < closes[i-1]) obv.push(p - volumes[i]);
    else obv.push(p);
  }

  // 50-bar MA (adapted to timeframe — fewer bars available for intraday)
  const maPeriod = Math.min(50, Math.floor(n * 0.6));
  const ma50arr = sma(closes, maPeriod);
  const ma50 = ma50arr[n-1] ?? closes[n-1];
  const price = closes[n-1];

  const histVal = hist[n-1];
  const histPrev = hist[n-2];
  const obvSlope = n >= 6 ? (obv[n-1] - obv[n-6]) / 1e6 : null;
  const lastVol = volumes[n-1];
  const volAvg20 = volumes.slice(-21,-1).reduce((a,b)=>a+b,0) / 20;
  const volRatio = volAvg20 > 0 ? Math.round((lastVol/volAvg20)*100) : null;

  // Last 20 bars for chart
  const l20c = closes.slice(-20);
  const l20h = hist.slice(-20);
  const l20o = obv.slice(-20);
  const oMin = Math.min(...l20o), oMax = Math.max(...l20o);
  const obvNorm = l20o.map(v => oMax===oMin ? 0.5 : (v-oMin)/(oMax-oMin));

  return {
    symbol,
    interval: tf.yInterval,
    ma_period: maPeriod,
    price: +price.toFixed(2),
    ma50: +ma50.toFixed(2),
    macd_hist: histVal!=null ? +histVal.toFixed(4) : null,
    macd_hist_prev: histPrev!=null ? +histPrev.toFixed(4) : null,
    obv_slope_5d: obvSlope!=null ? +obvSlope.toFixed(2) : null,
    volume_ratio: volRatio,
    closes_20d: l20c.map(v => +v.toFixed(2)),
    macd_hist_20d: l20h.map(v => v!=null ? +v.toFixed(4) : 0),
    obv_norm_20d: obvNorm.map(v => +v.toFixed(3)),
    dates_20d: dates.slice(-20)
  };
}

function ok(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors() }
  });
}
function err(msg, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() }
  });
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60'
  };
}
