// Vercel Node.js Serverless Function (runtime: nodejs)
// No 'export const config' needed — Node.js is the default runtime
 
const TF_MAP = {
  '15m': { yInterval: '15m', lookbackDays: 5,   minBars: 30 },
  '30m': { yInterval: '30m', lookbackDays: 8,   minBars: 30 },
  '1h':  { yInterval: '1h',  lookbackDays: 14,  minBars: 30 },
  '4h':  { yInterval: '4h',  lookbackDays: 30,  minBars: 30 },
  '1d':  { yInterval: '1d',  lookbackDays: 130, minBars: 30 },
};
 
const YF_HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
 
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
 
function ok(res, data) {
  cors(res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=120');
  res.status(200).json(data);
}
 
function err(res, msg, status) {
  cors(res);
  res.status(status || 500).json({ error: msg });
}
 
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(204).end();
  }
 
  const mode = req.query.mode || 'scan';
 
  if (mode === 'movers') return handleMovers(req, res);
  if (mode === 'afterhours') return handleAfterHours(req, res);
  return handleScan(req, res);
};
 
// ─── SCAN ────────────────────────────────────────────────────────────────────
 
async function handleScan(req, res) {
  const symbol = ((req.query.symbol || '')).toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const tfKey = req.query.interval || '1d';
  const tf = TF_MAP[tfKey] || TF_MAP['1d'];
  if (!symbol) return err(res, 'No symbol', 400);
 
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * tf.lookbackDays;
  const hosts = ['query2', 'query1'];
  let lastErr = '';
 
  for (const host of hosts) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${tf.yInterval}&period1=${from}&period2=${to}&includePrePost=false`;
      const r = await fetch(url, { headers: { ...YF_HEADERS, 'Referer': `https://finance.yahoo.com/quote/${symbol}` } });
      if (!r.ok) { lastErr = `${host} HTTP ${r.status}`; continue; }
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      if (!result) { lastErr = `${host} no_data`; continue; }
      const q = result.indicators.quote[0];
      const closes = q.close.map(v => v || 0);
      const volumes = q.volume.map(v => v || 0);
      if (closes.length < tf.minBars) { lastErr = `insufficient: ${closes.length}`; continue; }
      return ok(res, computeIndicators(symbol, tf, closes, volumes, result.timestamp));
    } catch (e) {
      lastErr = e.message;
    }
  }
  return err(res, `Scan fehlgeschlagen: ${lastErr}`);
}
 
// ─── MOST ACTIVE via Finnhub ─────────────────────────────────────────────────
 
async function handleMovers(req, res) {
  const key = process.env.FINNHUB_KEY;
  if (!key) return err(res, 'FINNHUB_KEY nicht konfiguriert');
 
  try {
    const symbols = ['NVDA','AAPL','MSFT','TSLA','AMD','META','AMZN','GOOGL','PLTR','SPY',
                     'SOXL','TQQQ','MRVL','AVGO','VRT','ARM','CRDO','LRCX','TSM','SMCI'];
 
    const results = await Promise.all(symbols.map(sym =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`)
        .then(r => r.json())
        .then(d => ({ symbol: sym, data: d }))
        .catch(() => null)
    ));
 
    const items = results
      .filter(r => r && r.data && r.data.c)
      .map(r => ({
        symbol: r.symbol,
        name: r.symbol,
        price: r.data.c.toFixed(2),
        change: (r.data.d || 0).toFixed(2),
        changePct: (r.data.dp || 0).toFixed(2),
        volume: '—',
        volRatio: null,
        mktCap: '—',
        high: (r.data.h || 0).toFixed(2),
        low: (r.data.l || 0).toFixed(2),
      }))
      .sort((a, b) => Math.abs(parseFloat(b.changePct)) - Math.abs(parseFloat(a.changePct)))
      .slice(0, 10);
 
    return ok(res, { mode: 'movers', items, ts: new Date().toISOString() });
  } catch (e) {
    return err(res, `Movers fehlgeschlagen: ${e.message}`);
  }
}
 
// ─── AFTER HOURS via Finnhub ─────────────────────────────────────────────────
 
async function handleAfterHours(req, res) {
  const key = process.env.FINNHUB_KEY;
  if (!key) return err(res, 'FINNHUB_KEY nicht konfiguriert');
 
  const watchlist = ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','AVGO','MRVL',
                     'VRT','LRCX','TSM','ARM','CRDO','PLTR','SMCI','ORCL','CRM','SNOW'];
  try {
    const results = await Promise.all(watchlist.map(sym =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`)
        .then(r => r.json())
        .then(d => ({ symbol: sym, data: d }))
        .catch(() => null)
    ));
 
    const hour = new Date().getUTCHours();
    const isPreMarket = hour >= 9 && hour < 14;
 
    const items = results
      .filter(r => r && r.data && r.data.c && r.data.pc)
      .map(r => {
        const chg = ((r.data.c - r.data.pc) / r.data.pc * 100);
        return {
          symbol: r.symbol,
          name: r.symbol,
          regularPrice: r.data.c.toFixed(2),
          regularChgPct: (r.data.dp || 0).toFixed(2),
          ahPrice: r.data.c.toFixed(2),
          ahChgPct: chg.toFixed(2),
        };
      })
      .filter(r => r.ahPrice !== null)
      .sort((a, b) => Math.abs(parseFloat(b.ahChgPct || 0)) - Math.abs(parseFloat(a.ahChgPct || 0)))
      .slice(0, 12);
 
    return ok(res, { mode: 'afterhours', items, isPreMarket, ts: new Date().toISOString() });
  } catch (e) {
    return err(res, `After-Hours fehlgeschlagen: ${e.message}`);
  }
}
 
// ─── INDICATORS ──────────────────────────────────────────────────────────────
 
function computeIndicators(symbol, tf, closes, volumes, timestamps) {
  const n = closes.length;
 
  function ema(data, p) {
    if (data.length < p) return data.map(() => null);
    const k = 2 / (p + 1);
    const result = [];
    let e = data.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = 0; i < p - 1; i++) result.push(null);
    result.push(e);
    for (let i = p; i < data.length; i++) { e = data[i] * k + e * (1 - k); result.push(e); }
    return result;
  }
 
  function sma(data, p) {
    return data.map((_, i) => {
      if (i < p - 1) return null;
      return data.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p;
    });
  }
 
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const macdLine = closes.map((_, i) => (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null);
  const validMacd = macdLine.filter(v => v != null);
  const sigRaw = ema(validMacd, 9);
  const signal = []; let si = 0;
  macdLine.forEach(v => signal.push(v != null ? sigRaw[si++] : null));
  const hist = macdLine.map((v, i) => (v != null && signal[i] != null) ? v - signal[i] : null);
 
  const obv = [0];
  for (let i = 1; i < n; i++) {
    const prev = obv[obv.length - 1];
    if (closes[i] > closes[i - 1]) obv.push(prev + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(prev - volumes[i]);
    else obv.push(prev);
  }
 
  const maPeriod = Math.min(50, Math.floor(n * 0.6));
  const ma50arr = sma(closes, maPeriod);
  const ma50 = ma50arr[n - 1] ?? closes[n - 1];
  const price = closes[n - 1];
  const histVal = hist[n - 1], histPrev = hist[n - 2];
  const obvSlope = n >= 6 ? (obv[n - 1] - obv[n - 6]) / 1e6 : null;
  const lastVol = volumes[n - 1];
  const volAvg20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volAvg20 > 0 ? Math.round((lastVol / volAvg20) * 100) : null;
 
  const dates = timestamps.map(t => {
    const d = new Date(t * 1000);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return tf.yInterval === '1d' ? `${day}.${mon}` : `${day}.${mon} ${hr}:${min}`;
  });
 
  const l20c = closes.slice(-20), l20h = hist.slice(-20), l20o = obv.slice(-20);
  const oMin = Math.min(...l20o), oMax = Math.max(...l20o);
  const obvNorm = l20o.map(v => oMax === oMin ? 0.5 : (v - oMin) / (oMax - oMin));
 
  return {
    symbol, interval: tf.yInterval,
    price: +price.toFixed(2), ma50: +ma50.toFixed(2),
    macd_hist: histVal != null ? +histVal.toFixed(4) : null,
    macd_hist_prev: histPrev != null ? +histPrev.toFixed(4) : null,
    obv_slope_5d: obvSlope != null ? +obvSlope.toFixed(2) : null,
    volume_ratio: volRatio,
    closes_20d: l20c.map(v => +v.toFixed(2)),
    macd_hist_20d: l20h.map(v => v != null ? +v.toFixed(4) : 0),
    obv_norm_20d: obvNorm.map(v => +v.toFixed(3)),
    dates_20d: dates.slice(-20),
  };
}
