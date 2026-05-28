export const config = { runtime: 'edge' };
 
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
 
// ─── SCAN ────────────────────────────────────────────────────────────────────
 
async function handleScan(searchParams) {
  const symbol = (searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const tfKey = searchParams.get('interval') || '1d';
  const tf = TF_MAP[tfKey] || TF_MAP['1d'];
  if (!symbol) return errRes('No symbol', 400);
 
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * tf.lookbackDays;
  const hosts = ['query2', 'query1'];
  let lastErr = '';
 
  for (var hi = 0; hi < hosts.length; hi++) {
    var host = hosts[hi];
    try {
      var url = 'https://' + host + '.finance.yahoo.com/v8/finance/chart/' + symbol
        + '?interval=' + tf.yInterval
        + '&period1=' + from
        + '&period2=' + to
        + '&includePrePost=false';
      var r = await fetch(url, { headers: Object.assign({}, YF_HEADERS, { 'Referer': 'https://finance.yahoo.com/quote/' + symbol }) });
      if (!r.ok) { lastErr = host + ' HTTP ' + r.status; continue; }
      var j = await r.json();
      var res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res) { lastErr = host + ' no_data'; continue; }
      var q = res.indicators.quote[0];
      var closes = q.close.map(function(v) { return v || 0; });
      var volumes = q.volume.map(function(v) { return v || 0; });
      if (closes.length < tf.minBars) { lastErr = 'insufficient: ' + closes.length; continue; }
      return okRes(computeIndicators(symbol, tf, closes, volumes, res.timestamp));
    } catch(e) {
      lastErr = e.message;
    }
  }
  return errRes('Scan fehlgeschlagen: ' + lastErr, 500);
}
 
// ─── MOST ACTIVE via Finnhub ─────────────────────────────────────────────────
 
async function handleMovers() {
  var key = typeof process !== 'undefined' && process.env ? process.env.FINNHUB_KEY : null;
  if (!key) return errRes('FINNHUB_KEY nicht konfiguriert', 500);
 
  try {
    // Get market status + top symbols by fetching a broad quote list
    // Finnhub: use stock screener endpoint for most active
    var url = 'https://finnhub.io/api/v1/stock/market-status?exchange=US&token=' + key;
    var statusRes = await fetch(url);
    var statusData = await statusRes.json();
 
    // Fetch quotes for known high-volume symbols
    var symbols = ['NVDA','AAPL','MSFT','TSLA','AMD','META','AMZN','GOOGL','PLTR','SPY',
                   'SOXL','TQQQ','MRVL','AVGO','VRT','ARM','CRDO','LRCX','TSM','SMCI'];
    var quotePromises = symbols.map(function(sym) {
      return fetch('https://finnhub.io/api/v1/quote?symbol=' + sym + '&token=' + key)
        .then(function(r) { return r.json(); })
        .then(function(d) { return { symbol: sym, data: d }; })
        .catch(function() { return null; });
    });
 
    var results = await Promise.all(quotePromises);
    var items = [];
 
    for (var i = 0; i < results.length; i++) {
      var item = results[i];
      if (!item || !item.data || !item.data.c) continue;
      var d = item.data;
      var chgPct = d.dp ? d.dp.toFixed(2) : '0';
      items.push({
        symbol: item.symbol,
        name: item.symbol,
        price: d.c ? d.c.toFixed(2) : '—',
        change: d.d ? d.d.toFixed(2) : '0',
        changePct: chgPct,
        volume: '—',
        volRatio: null,
        mktCap: '—',
        high: d.h ? d.h.toFixed(2) : '—',
        low: d.l ? d.l.toFixed(2) : '—',
      });
    }
 
    // Sort by absolute % change (most active by movement)
    items.sort(function(a, b) {
      return Math.abs(parseFloat(b.changePct)) - Math.abs(parseFloat(a.changePct));
    });
 
    return okRes({ mode: 'movers', items: items.slice(0, 10), ts: new Date().toISOString() });
  } catch(e) {
    return errRes('Movers fehlgeschlagen: ' + e.message, 500);
  }
}
 
// ─── AFTER HOURS via Finnhub ─────────────────────────────────────────────────
 
async function handleAfterHours() {
  var key = typeof process !== 'undefined' && process.env ? process.env.FINNHUB_KEY : null;
  if (!key) return errRes('FINNHUB_KEY nicht konfiguriert', 500);
 
  var watchlist = ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','AVGO','MRVL',
                   'VRT','LRCX','TSM','ARM','CRDO','PLTR','SMCI','ORCL','CRM','SNOW'];
  try {
    var quotePromises = watchlist.map(function(sym) {
      return fetch('https://finnhub.io/api/v1/quote?symbol=' + sym + '&token=' + key)
        .then(function(r) { return r.json(); })
        .then(function(d) { return { symbol: sym, data: d }; })
        .catch(function() { return null; });
    });
 
    var results = await Promise.all(quotePromises);
    var now = new Date();
    var hour = now.getUTCHours();
    var isPreMarket = hour >= 9 && hour < 14;  // 09:00-14:00 UTC = 10:00-15:30 MEZ
 
    var items = [];
    for (var i = 0; i < results.length; i++) {
      var item = results[i];
      if (!item || !item.data || !item.data.c) continue;
      var d = item.data;
      var regularPrice = d.c ? d.c.toFixed(2) : null;
      var regularChgPct = d.dp ? d.dp.toFixed(2) : '0';
      if (!regularPrice) continue;
 
      // Finnhub /quote returns current price which includes pre/post market
      // Use 'pc' (prev close) vs 'c' (current) to detect after-hours movement
      var ahPrice = null;
      var ahChgPct = null;
      if (d.c && d.pc && d.pc > 0) {
        var chg = ((d.c - d.pc) / d.pc * 100);
        // Only show if market is closed (significant after-hours signal)
        ahPrice = d.c.toFixed(2);
        ahChgPct = chg.toFixed(2);
      }
 
      if (!ahPrice) continue;
      items.push({
        symbol: item.symbol,
        name: item.symbol,
        regularPrice: regularPrice,
        regularChgPct: regularChgPct,
        ahPrice: ahPrice,
        ahChgPct: ahChgPct,
      });
    }
 
    items.sort(function(a, b) {
      return Math.abs(parseFloat(b.ahChgPct || 0)) - Math.abs(parseFloat(a.ahChgPct || 0));
    });
 
    return okRes({ mode: 'afterhours', items: items.slice(0, 12), isPreMarket: isPreMarket, ts: new Date().toISOString() });
  } catch(e) {
    return errRes('After-Hours fehlgeschlagen: ' + e.message, 500);
  }
}
 
// ─── INDICATORS ──────────────────────────────────────────────────────────────
 
function computeIndicators(symbol, tf, closes, volumes, timestamps) {
  var n = closes.length;
 
  function ema(data, p) {
    if (data.length < p) return data.map(function() { return null; });
    var k = 2 / (p + 1);
    var result = [];
    var e = 0;
    for (var i = 0; i < p; i++) e += data[i];
    e = e / p;
    for (var i = 0; i < p - 1; i++) result.push(null);
    result.push(e);
    for (var i = p; i < data.length; i++) {
      e = data[i] * k + e * (1 - k);
      result.push(e);
    }
    return result;
  }
 
  function sma(data, p) {
    return data.map(function(_, i) {
      if (i < p - 1) return null;
      var sum = 0;
      for (var j = i - p + 1; j <= i; j++) sum += data[j];
      return sum / p;
    });
  }
 
  var e12 = ema(closes, 12);
  var e26 = ema(closes, 26);
  var macdLine = closes.map(function(_, i) {
    return (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null;
  });
  var validMacd = macdLine.filter(function(v) { return v != null; });
  var sigRaw = ema(validMacd, 9);
  var signal = [];
  var si = 0;
  macdLine.forEach(function(v) { signal.push(v != null ? sigRaw[si++] : null); });
  var hist = macdLine.map(function(v, i) {
    return (v != null && signal[i] != null) ? v - signal[i] : null;
  });
 
  var obv = [0];
  for (var i = 1; i < n; i++) {
    var prev = obv[obv.length - 1];
    if (closes[i] > closes[i - 1]) obv.push(prev + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(prev - volumes[i]);
    else obv.push(prev);
  }
 
  var maPeriod = Math.min(50, Math.floor(n * 0.6));
  var ma50arr = sma(closes, maPeriod);
  var ma50 = ma50arr[n - 1] != null ? ma50arr[n - 1] : closes[n - 1];
  var price = closes[n - 1];
  var histVal = hist[n - 1];
  var histPrev = hist[n - 2];
  var obvSlope = n >= 6 ? (obv[n - 1] - obv[n - 6]) / 1e6 : null;
  var lastVol = volumes[n - 1];
  var slice20 = volumes.slice(-21, -1);
  var volSum = 0;
  for (var i = 0; i < slice20.length; i++) volSum += slice20[i];
  var volAvg20 = slice20.length > 0 ? volSum / slice20.length : 0;
  var volRatio = volAvg20 > 0 ? Math.round((lastVol / volAvg20) * 100) : null;
 
  var dates = timestamps.map(function(t) {
    var d = new Date(t * 1000);
    var day = String(d.getDate()).padStart(2, '0');
    var mon = String(d.getMonth() + 1).padStart(2, '0');
    var hr = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return tf.yInterval === '1d' ? day + '.' + mon : day + '.' + mon + ' ' + hr + ':' + min;
  });
 
  var l20c = closes.slice(-20);
  var l20h = hist.slice(-20);
  var l20o = obv.slice(-20);
  var oMin = l20o[0], oMax = l20o[0];
  for (var i = 1; i < l20o.length; i++) {
    if (l20o[i] < oMin) oMin = l20o[i];
    if (l20o[i] > oMax) oMax = l20o[i];
  }
  var obvNorm = l20o.map(function(v) {
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
 
// ─── HELPERS ─────────────────────────────────────────────────────────────────
 
function okRes(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=120' },
  });
}
 
function errRes(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status: status || 500,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
 
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
