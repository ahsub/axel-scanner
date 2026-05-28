export const config = { runtime: 'edge' };
 
const TF_MAP = {
  '15m': { yInterval: '15m', lookbackDays: 5,   minBars: 30 },
  '30m': { yInterval: '30m', lookbackDays: 8,   minBars: 30 },
  '1h':  { yInterval: '1h',  lookbackDays: 14,  minBars: 30 },
  '4h':  { yInterval: '4h',  lookbackDays: 30,  minBars: 30 },
  '1d':  { yInterval: '1d',  lookbackDays: 130, minBars: 30 },
};
 
const HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
 
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
 
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'scan';
 
  if (mode === 'movers') return handleMovers();
  if (mode === 'afterhours') return handleAfterHours();
  return handleScan(searchParams);
}
 
async function handleScan(searchParams) {
  const symbol = (searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const tfKey = searchParams.get('interval') || '1d';
  const tf = TF_MAP[tfKey] || TF_MAP['1d'];
  if (!symbol) return errRes('No symbol', 400);
 
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * tf.lookbackDays;
 
  const hosts = ['query2', 'query1'];
  let lastErr = '';
  for (const host of hosts) {
    try {
      const url = 'https://' + host + '.finance.yahoo.com/v8/finance/chart/' + symbol + '?interval=' + tf.yInterval + '&period1=' + from + '&period2=' + to + '&includePrePost=false';
      const r = await fetch(url, { headers: { ...HEADERS, 'Referer': 'https://finance.yahoo.com/quote/' + symbol } });
      if (!r.ok) { lastErr = host + ' HTTP ' + r.status; continue; }
      const j = await r.json();
      const res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res) { lastErr = host + ' no_data'; continue; }
      const q = res.indicators.quote[0];
      const closes = q.close.map(function(v) { return v || 0; });
      const volumes = q.volume.map(function(v) { return v || 0; });
      if (closes.length < tf.minBars) { lastErr = 'insufficient: ' + closes.length; continue; }
      return okRes(computeIndicators(symbol, tf, closes, volumes, res.timestamp));
    } catch(e) {
      lastErr = e.message;
    }
  }
  return errRes('Scan fehlgeschlagen: ' + lastErr, 500);
}
 
async function handleMovers() {
  const hosts = ['query1', 'query2'];
  let lastErr = '';
  for (const host of hosts) {
    try {
      const url = 'https://' + host + '.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=most_actives&count=12&start=0&region=US&lang=en-US';
      const r = await fetch(url, { headers: { ...HEADERS, 'Referer': 'https://finance.yahoo.com/markets/stocks/most-active/' } });
      if (!r.ok) { lastErr = 'HTTP ' + r.status; continue; }
      const j = await r.json();
      const quotes = j && j.finance && j.finance.result && j.finance.result[0] && j.finance.result[0].quotes;
      if (!quotes || !quotes.length) { lastErr = 'empty'; continue; }
      const items = quotes.slice(0, 10).map(function(q) {
        return {
          symbol: q.symbol,
          name: (q.shortName || q.longName || q.symbol).substring(0, 22),
          price: q.regularMarketPrice ? q.regularMarketPrice.toFixed(2) : '—',
          change: q.regularMarketChange ? q.regularMarketChange.toFixed(2) : '0',
          changePct: q.regularMarketChangePercent ? q.regularMarketChangePercent.toFixed(2) : '0',
          volume: fmtVol(q.regularMarketVolume),
          avgVol: fmtVol(q.averageDailyVolume3Month),
          volRatio: q.averageDailyVolume3Month > 0 ? Math.round((q.regularMarketVolume / q.averageDailyVolume3Month) * 100) : null,
          mktCap: fmtCap(q.marketCap),
        };
      });
      return okRes({ mode: 'movers', items: items, ts: new Date().toISOString() });
    } catch(e) {
      lastErr = e.message;
    }
  }
  return errRes('Most active fehlgeschlagen: ' + lastErr, 500);
}
 
async function handleAfterHours() {
  const watchlist = ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','AVGO','MRVL','VRT','LRCX','TSM','ARM','CRDO'];
  const syms = watchlist.join(',');
  const hosts = ['query1', 'query2'];
  let lastErr = '';
  for (const host of hosts) {
    try {
      const url = 'https://' + host + '.finance.yahoo.com/v8/finance/quote?symbols=' + syms + '&formatted=false&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,preMarketPrice,preMarketChangePercent,postMarketPrice,postMarketChangePercent,regularMarketVolume';
      const r = await fetch(url, { headers: { ...HEADERS, 'Referer': 'https://finance.yahoo.com/' } });
      if (!r.ok) { lastErr = 'HTTP ' + r.status; continue; }
      const j = await r.json();
      const quotes = j && j.quoteResponse && j.quoteResponse.result;
      if (!quotes || !quotes.length) { lastErr = 'empty'; continue; }
      const now = new Date();
      const hour = now.getUTCHours();
      const isPreMarket = hour >= 9 && hour < 14;
      const items = quotes.map(function(q) {
        const ahPrice = isPreMarket ? q.preMarketPrice : q.postMarketPrice;
        const ahChg = isPreMarket ? q.preMarketChangePercent : q.postMarketChangePercent;
        return {
          symbol: q.symbol,
          name: (q.shortName || q.symbol).substring(0, 18),
          regularPrice: q.regularMarketPrice ? q.regularMarketPrice.toFixed(2) : '—',
          regularChgPct: q.regularMarketChangePercent ? q.regularMarketChangePercent.toFixed(2) : '0',
          ahPrice: ahPrice ? ahPrice.toFixed(2) : null,
          ahChgPct: ahChg ? ahChg.toFixed(2) : null,
          volume: fmtVol(q.regularMarketVolume),
        };
      }).filter(function(q) { return q.ahPrice !== null; })
        .sort(function(a, b) { return Math.abs(parseFloat(b.ahChgPct || 0)) - Math.abs(parseFloat(a.ahChgPct || 0)); });
      return okRes({ mode: 'afterhours', items: items, isPreMarket: isPreMarket, ts: new Date().toISOString() });
    } catch(e) {
      lastErr = e.message;
    }
  }
  return errRes('After-Hours fehlgeschlagen: ' + lastErr, 500);
}
 
function computeIndicators(symbol, tf, closes, volumes, timestamps) {
  const n = closes.length;
 
  function ema(data, p) {
    if (data.length < p) return data.map(function() { return null; });
    const k = 2 / (p + 1);
    const result = [];
    let e = 0;
    for (let i = 0; i < p; i++) e += data[i];
    e = e / p;
    for (let i = 0; i < p - 1; i++) result.push(null);
    result.push(e);
    for (let i = p; i < data.length; i++) {
      e = data[i] * k + e * (1 - k);
      result.push(e);
    }
    return result;
  }
 
  function sma(data, p) {
    return data.map(function(_, i) {
      if (i < p - 1) return null;
      let sum = 0;
      for (let j = i - p + 1; j <= i; j++) sum += data[j];
      return sum / p;
    });
  }
 
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macdLine = closes.map(function(_, i) {
    return (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null;
  });
  const validMacd = macdLine.filter(function(v) { return v != null; });
  const sigRaw = ema(validMacd, 9);
  const signal = [];
  let si = 0;
  macdLine.forEach(function(v) { signal.push(v != null ? sigRaw[si++] : null); });
  const hist = macdLine.map(function(v, i) {
    return (v != null && signal[i] != null) ? v - signal[i] : null;
  });
 
  const obv = [0];
  for (let i = 1; i < n; i++) {
    const prev = obv[obv.length - 1];
    if (closes[i] > closes[i - 1]) obv.push(prev + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(prev - volumes[i]);
    else obv.push(prev);
  }
 
  const maPeriod = Math.min(50, Math.floor(n * 0.6));
  const ma50arr = sma(closes, maPeriod);
  const ma50 = ma50arr[n - 1] != null ? ma50arr[n - 1] : closes[n - 1];
  const price = closes[n - 1];
  const histVal = hist[n - 1];
  const histPrev = hist[n - 2];
  const obvSlope = n >= 6 ? (obv[n - 1] - obv[n - 6]) / 1e6 : null;
  const lastVol = volumes[n - 1];
  const slice20 = volumes.slice(-21, -1);
  let volSum = 0;
  for (let i = 0; i < slice20.length; i++) volSum += slice20[i];
  const volAvg20 = slice20.length > 0 ? volSum / slice20.length : 0;
  const volRatio = volAvg20 > 0 ? Math.round((lastVol / volAvg20) * 100) : null;
 
  const dates = timestamps.map(function(t) {
    const d = new Date(t * 1000);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return tf.yInterval === '1d' ? day + '.' + mon : day + '.' + mon + ' ' + hr + ':' + min;
  });
 
  const l20c = closes.slice(-20);
  const l20h = hist.slice(-20);
  const l20o = obv.slice(-20);
  let oMin = l20o[0], oMax = l20o[0];
  for (let i = 1; i < l20o.length; i++) {
    if (l20o[i] < oMin) oMin = l20o[i];
    if (l20o[i] > oMax) oMax = l20o[i];
  }
  const obvNorm = l20o.map(function(v) {
    return oMax === oMin ? 0.5 : (v - oMin) / (oMax - oMin);
  });
 
  return {
    symbol: symbol,
    interval: tf.yInterval,
    price: Math.round(price * 100) / 100,
    ma50: Math.round(ma50 * 100) / 100,
    macd_hist: histVal != null ? Math.round(histVal * 10000) / 10000 : null,
    macd_hist_prev: histPrev != null ? Math.round(histPrev * 10000) / 10000 : null,
    obv_slope_5d: obvSlope != null ? Math.round(obvSlope * 100) / 100 : null,
    volume_ratio: volRatio,
    closes_20d: l20c.map(function(v) { return Math.round(v * 100) / 100; }),
    macd_hist_20d: l20h.map(function(v) { return v != null ? Math.round(v * 10000) / 10000 : 0; }),
    obv_norm_20d: obvNorm.map(function(v) { return Math.round(v * 1000) / 1000; }),
    dates_20d: dates.slice(-20),
  };
}
 
function fmtVol(v) {
  if (!v) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return Math.round(v / 1e3) + 'K';
  return String(v);
}
 
function fmtCap(v) {
  if (!v) return '—';
  if (v >= 1e12) return (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  return Math.round(v / 1e6) + 'M';
}
 
function okRes(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
 
function errRes(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status: status || 500,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
 
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=120',
  };
}
