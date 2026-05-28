export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (!symbol) return new Response(JSON.stringify({ error: 'No symbol' }), { status: 400, headers: cors() });

  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 60 * 60 * 24 * 130;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&from=${from}&to=${to}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; scanner/1.0)' }
    });
    if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res) throw new Error('no_data');

    const q = res.indicators.quote[0];
    const closes = q.close.map(v => v ?? 0);
    const volumes = q.volume.map(v => v ?? 0);
    const ts = res.timestamp;
    const n = closes.length;

    if (n < 60) throw new Error('insufficient_data');

    const dates = ts.map(t => {
      const d = new Date(t * 1000);
      return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    });

    // EMA
    function ema(data, p) {
      const k = 2 / (p + 1); const r = [];
      let e = data.slice(0, p).reduce((a, b) => a + b, 0) / p;
      for (let i = 0; i < p - 1; i++) r.push(null);
      r.push(e);
      for (let i = p; i < data.length; i++) { e = data[i] * k + e * (1 - k); r.push(e); }
      return r;
    }

    // SMA
    function sma(data, p) {
      return data.map((_, i) => i < p - 1 ? null : data.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p);
    }

    // MACD
    const e12 = ema(closes, 12), e26 = ema(closes, 26);
    const macdLine = closes.map((_, i) => (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null);
    const validMacd = macdLine.filter(v => v != null);
    const sigRaw = ema(validMacd, 9);
    const signal = []; let si = 0;
    macdLine.forEach(v => { signal.push(v != null ? sigRaw[si++] : null); });
    const hist = macdLine.map((v, i) => (v != null && signal[i] != null) ? v - signal[i] : null);

    // OBV
    const obv = [0];
    for (let i = 1; i < n; i++) {
      const p = obv[obv.length - 1];
      if (closes[i] > closes[i - 1]) obv.push(p + volumes[i]);
      else if (closes[i] < closes[i - 1]) obv.push(p - volumes[i]);
      else obv.push(p);
    }

    // 50d MA
    const ma50arr = sma(closes, 50);
    const ma50 = ma50arr[n - 1];
    const price = closes[n - 1];

    const histVal = hist[n - 1];
    const histPrev = hist[n - 2];
    const obvSlope = n >= 6 ? (obv[n - 1] - obv[n - 6]) / 1e6 : null;
    const lastVol = volumes[n - 1];
    const volAvg20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const volRatio = volAvg20 > 0 ? Math.round((lastVol / volAvg20) * 100) : null;

    // Last 20 days
    const last20c = closes.slice(-20);
    const last20h = hist.slice(-20);
    const last20o = obv.slice(-20);
    const oMin = Math.min(...last20o), oMax = Math.max(...last20o);
    const obvNorm = last20o.map(v => oMax === oMin ? 0.5 : (v - oMin) / (oMax - oMin));

    const payload = {
      symbol,
      price: +price.toFixed(2),
      ma50: +(ma50 ?? price).toFixed(2),
      macd_hist: histVal != null ? +histVal.toFixed(4) : null,
      macd_hist_prev: histPrev != null ? +histPrev.toFixed(4) : null,
      obv_slope_5d: obvSlope != null ? +obvSlope.toFixed(2) : null,
      volume_ratio: volRatio,
      closes_20d: last20c.map(v => +v.toFixed(2)),
      macd_hist_20d: last20h.map(v => v != null ? +v.toFixed(4) : 0),
      obv_norm_20d: obvNorm.map(v => +v.toFixed(3)),
      dates_20d: dates.slice(-20)
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors() }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: cors()
    });
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Cache-Control': 'public, s-maxage=300'
  };
}