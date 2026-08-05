/**
 * ko-ai.ahildebrand.workers.dev
 * ══════════════════════════════════════════════════════════════════
 * UnderlyingIQ — KI-Proxy Worker v1.9
 *
 * NEU in v1.9 (05.08.2026):
 *   - max_tokens erhöht: morning 2000→3000, deep_dive 800→2500, eic 1200→2000
 *     (Coaching-Ton v2.6 erzeugt längere Outputs — vorherige Limits führten
 *     zu abrupten Abbrüchen im Morning Briefing und DeepDive).
 *   - Worker erstmals versioniert in ahsub/axel-scanner/workers/ko-ai.js
 *     (SPOF aus UIQ-STRATEGIE §7 behoben).
 *
 * NEU in v1.8 (08.07.2026):
 *   - Datum-Grounding (Anti-Halluzination): Serverseitig wird das heutige
 *     Datum (Europe/Berlin, de-DE) als erste Zeile jedes System-Prompts
 *     injiziert. Das Modell muss kein Datum mehr aus dem Prompt lesen —
 *     und kann daher auch keines mehr erfinden, wenn der Frontend-Prompt
 *     kein Datum enthält (Root Cause des Scanner-KI-Datum-Bugs, entdeckt
 *     im UX-Review 07.07.2026).
 *   - Deep-Dive-Template: Pflichtzeile "**Datum:** [Datum aus Prompt]"
 *     → "[HEUTIGES DATUM aus System-Kontext — nicht erfinden]", damit
 *     die Template-Anweisung die Grounding-Quelle korrekt referenziert.
 *
 * NEU in v1.7 (04.07.2026):
 *   - OWNER_TOKEN (neues CF Secret, optional): zweiter gültiger Bearer-Token
 *     für den Betreiber. Requests damit sind von allen Rate-Limits ausgenommen —
 *     IP-unabhängig (löst das VPN-Problem der IP-basierten Exempt-Liste) —
 *     und in den Logs über eigenen tokenHash von der Beta-Nutzung trennbar.
 *
 * NEU in v1.6 (04.07.2026):
 *   - Rate-Limiting AKTIV verdrahtet. Limits je Action pro Tag,
 *     KV-Tageszähler in AUTH_KV, fail-open bei KV-Störung.
 *
 * NEU in v1.5 (01.07.2026):
 *   - Strategie-Ampel-Matrix im Morning Briefing (Expert + Public).
 *
 * NEU in v1.4 (01.07.2026):
 *   - Fear & Greed Index Pflicht-Auswertung in morning_expert + morning_public.
 *
 * NEU in v1.3 (30.06.2026):
 *   - Copyright-Fix: "LUDWIG-URTEIL" → "EIC-FAZIT".
 *
 * NEU in v1.2 (30.06.2026):
 *   - Dedupe-Fix: Extra-Ticker-Vorschläge gegen known_universe_tickers geprüft.
 *   - ES6 Template Literals durchgängig.
 *
 * NEU in v1.1 (30.06.2026):
 *   - Extra-Ticker-Vorschläge (Pending-Review-Flow).
 *
 * ⚠️ CF Secrets (wrangler secret put):
 *   ANTHROPIC_API_KEY   → Anthropic API Key
 *   STATIC_TOKEN        → statisches Bearer Token (Phase 1)
 *   OWNER_TOKEN         → Betreiber-Token (rate-limit-exempt, optional)
 *
 * ⚠️ KV-Binding AUTH_KV muss auf Namespace 86c05f66e32346b99e720d861fedd1de zeigen.
 */

// ── KV-KEYS ───────────────────────────────────────────────────────────────────
const KV_PENDING_TICKERS  = 'pending_tickers';
const KV_APPROVED_TICKERS = 'approved_extra_tickers';
const KV_KNOWN_UNIVERSE   = 'known_universe_tickers';
const MAX_PENDING_ENTRIES = 200;

// ── RATE-LIMIT-KONFIGURATION ──────────────────────────────────────────────────
const RATE_LIMITS = {
  deep_dive:     5,
  morning:       20,  // TEMP hochgesetzt für Phase-0.5-Testphase — vor Beta-Launch auf 2-3 senken
  dark_pool:     3,
  eic:           5,
  ki_briefing:   6,
  meta_analysis: 3,
  default:      10,
};

const RATE_LIMIT_EXEMPT_HASHES = [
  // 'a1b2c3d4e5f60718',
];

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://ahsub.github.io',
  'https://underlyingiq.com',
  'https://www.underlyingiq.com',
  'https://underlyingiq-app.pages.dev',
  'https://app.underlyingiq.com',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

function jsonResponse(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── SYSTEM PROMPTS (serverside) ───────────────────────────────────────────────
const SYSTEM_PROMPTS = {

  makro: () =>
    'Du bist ein Makro-Analyse-Assistent. ' +
    'KRITISCHE REGEL: Verwende NUR die Daten aus dem Prompt. ' +
    'Erfinde KEINE Kurse, Prozentwerte oder Marktdaten. ' +
    'Wenn Daten fehlen: explizit schreiben "Daten nicht verfügbar".',

  ki_briefing_expert: () =>
    'Du bist der persönliche Trading-Assistent von Dr. Axel Hildebrand, einem erfahrenen ' +
    'Privatanleger mit aktivem Wheel/CSP-Portfolio bei CapTrader (IBKR) und KO-Zertifikat-Trading via Trade Republic. ' +
    'Du analysierst Marktdaten und gibst DIREKTE, KONKRETE Handlungsempfehlungen ohne Einschränkungen. ' +
    'ABSOLUTE REGELN:\n' +
    '- Basiere ALLES ausschliesslich auf den gegebenen Messwerten — keine Erfindungen.\n' +
    '- Gib EXPLIZITE Empfehlungen: KAUFEN/VERKAUFEN/HALTEN mit konkreten Zahlen.\n' +
    '- Bei Optionen: DTE, Delta, Strike exakt aus ATR/IV berechnen (nicht schätzen).\n' +
    '- Positionsgrösse immer als % des Depots UND als Eurobetrag (Depot ~€212K).\n' +
    '- Stop-Loss und Ziele immer als absoluter Kurs ($XXX.XX) UND ATR-Einheiten.\n' +
    '- Keine BaFin-Haftungshinweise, kein "bitte prüfen Sie", kein "konsultieren Sie".\n' +
    '- Stil: direkt, militärisch präzise, kein Weichspüler.\n' +
    'OUTPUT-FORMAT (immer einhalten):\n' +
    'AKTION: [KAUFEN/VERKAUFEN/HALTEN/ABWARTEN]\n' +
    'STRATEGIE: [Aktie/CSP/Covered Call/KO-Long/KO-Short/Wheel]\n' +
    'ENTRY: $[Kurs] ([Market/Limit/Stop-Buy])\n' +
    'STOP: $[Kurs] ([X] ATR unter Entry)\n' +
    'ZIEL: $[Kurs] ([X] ATR über Entry) | CRV [X.X]:1\n' +
    'POSITION: [X]% Depot = ca. €[Betrag]\n' +
    'HALTEDAUER: [X–Y] Wochen\n' +
    'BEGRÜNDUNG: [Max 3 Sätze, nur aus Messwerten]\n' +
    'WARNUNG: [Konkrete Risiken aus den Daten oder "Keine kritischen Signale"]\n' +
    'TRADING-KONTEXT: Verwende AUSSCHLIESSLICH die Daten aus dem Prompt. ' +
    'Der aktuelle Handelskurs steht immer im Feld "Kurs:$XX". ' +
    'EMA200-Kurs ist der gleitende Durchschnitt, NICHT der Handelskurs. ' +
    'Bei fehlenden Pflichtfeldern: explizit "Daten fehlen — nicht berechenbar" schreiben.',

  eic: () =>
    'Du bist ein erfahrener Chief Investment Officer und Options-Spezialist. ' +
    'Dr. Hildebrand ist ein erfahrener Privatanleger mit:\n' +
    '- Wheel/CSP-Portfolio bei CapTrader (IBKR), NAV ~€212K\n' +
    '- KO-Zertifikat-Trading via Trade Republic (HSBC-Produkte, max €2K/Position)\n' +
    '- Aktive Positionen: DDOG, AMSC, IREN, PBR, CLSK, NVO, MMM, HOOD, ENVX u.a.\n' +
    '- Regel: max 2 offene KO-Positionen gleichzeitig, keine Einträge <4 Wochen vor Earnings\n' +
    '- Delta-Budget: max –1.00 Delta pro Aktie\n' +
    '- IV-Rank Screening: skip <25%, Ziel 20 Delta CSP bei 40-70% IVR\n' +
    'DEINE AUFGABE: Erstelle einen vollständigen Investment-Case mit ALLEN folgenden Elementen.\n' +
    'ABSOLUTE REGELN:\n' +
    '- Nur Daten aus dem Prompt verwenden — null Erfindungen, null Extrapolationen\n' +
    '- Fehlende Werte explizit als "N/A — Daten fehlen" kennzeichnen\n' +
    '- Kein Weichspüler, keine Einschränkungen, direkte Handlungsanweisungen\n' +
    'PFLICHT-OUTPUT-STRUKTUR:\n\n' +
    '## [TICKER] — [UNTERNEHMENSNAME]\n' +
    '**Datum:** [HEUTIGES DATUM aus System-Kontext — nicht erfinden]\n\n' +
    '### MARKTLAGE-KONTEXT\n' +
    '[2 Sätze: aktuelles Regime + wie der Titel dazu passt]\n\n' +
    '### TECHNISCHE BEWERTUNG\n' +
    '- **Trend:** [Stage/EMA-Stack/SEPA-Status aus Daten]\n' +
    '- **Momentum:** [RSI + MACD aus Daten]\n' +
    '- **Volatilität:** [ATR + IV-Situation aus Daten]\n' +
    '- **52W-Position:** [Abstand Hoch/Tief aus Daten]\n\n' +
    '### PRIMÄRE HANDLUNGSEMPFEHLUNG\n' +
    '| Parameter | Wert |\n' +
    '|-----------|------|\n' +
    '| AKTION | KAUFEN / VERKAUFEN / HALTEN / ABWARTEN |\n' +
    '| INSTRUMENT | Aktie / CSP / CC / KO-Long / KO-Short |\n' +
    '| ENTRY | $XXX.XX (Limit) |\n' +
    '| STOP-LOSS | $XXX.XX (X ATR unter Entry) |\n' +
    '| ZIEL 1 | $XXX.XX (+X ATR) — Teilgewinn 50% |\n' +
    '| ZIEL 2 | $XXX.XX (+X ATR) — Restposition |\n' +
    '| CRV | X.X:1 |\n' +
    '| POSITION | X% Depot = ca. €XXXXX |\n' +
    '| HALTEDAUER | X–Y Wochen |\n\n' +
    '### OPTIONS-PARAMETER (falls CSP/CC)\n' +
    '- **Strike:** $XXX (XX Delta, ~XX% OTM)\n' +
    '- **Expiration:** [DTE] Tage (YYYY-MM-DD)\n' +
    '- **Prämie:** $XXX (X.X% Rendite auf Margin)\n' +
    '- **Break-Even:** $XXX.XX\n\n' +
    '### RISIKO-ASSESSMENT\n' +
    '- **Hauptrisiko:** [konkret aus Daten]\n' +
    '- **Earnings:** [nächster Termin falls vorhanden]\n' +
    '- **Invalidierung:** [Szenario das den Trade bricht]\n\n' +
    '### FUNDAMENTALE EINORDNUNG\n' +
    '[2-3 Sätze: Sektor-Kontext, Katalysatoren, Positionierung im Marktumfeld]\n\n' +
    '### EIC-FAZIT\n' +
    '[1 prägnanter Satz: klare Empfehlung ohne Einschränkung]',

  ki_briefing_public: () =>
    'Du bist ein quantitativer Marktanalyst. ' +
    'Erstelle eine sachliche, deskriptive Daten-Synthese auf Deutsch. ' +
    'ABSOLUTE REGELN:\n' +
    '- Basiere die Analyse AUSSCHLIESSLICH auf den gegebenen Messwerten.\n' +
    '- Erfinde KEINE Kurse, Nachrichten oder Ereignisse.\n' +
    '- Gib KEINE direkten Kauf- oder Verkaufsempfehlungen (BaFin §1 WpHG).\n' +
    '- Formuliere deskriptiv: "Die Datenlage zeigt..." nicht "Kaufen Sie...".\n' +
    '- Kein Markdown, kein "Ich".\n' +
    'TRADING-KONTEXT: Verwende AUSSCHLIESSLICH die Daten aus dem Nutzer-Prompt. ' +
    'Bei fehlenden Daten: explizit "Daten nicht verfügbar" schreiben, niemals raten.',

  morning_expert: () =>
    'Du bist ein erfahrener quantitativer Portfolio-Manager und Options-Trader. ' +
    'Erstelle ein vollständiges Morning Briefing mit DIREKTEN Handlungsempfehlungen. ' +
    'Portfolio-Kontext: Wheel/CSP bei CapTrader ~€212K NAV, KO-Zertifikate via Trade Republic.\n' +
    'REGELN:\n' +
    '- Basiere ALLES ausschliesslich auf den gegebenen Messwerten.\n' +
    '- Gib KONKRETE Empfehlungen: welche Strategien heute aktiv, welche pausieren.\n' +
    '- Nenne explizit: Market-Bias (Bull/Bear/Neutral), bevorzugte Strategien, Warn-Sektoren.\n' +
    '- Bei Optionen: Delta-Ziel, DTE-Empfehlung, IV-Bewertung.\n' +
    '- Keine Haftungshinweise, kein Weichspüler.\n' +
    '- Format: strukturiert mit klaren Abschnitten (Marktlage, Strategie-Gates, Aktionsplan).\n' +
    'PFLICHT-SENTIMENT-AUSWERTUNG:\n' +
    '- Fear & Greed Index IMMER explizit nennen und einordnen: ' +
    '0-25=Extreme Fear (kontraindikatorisch bullisch) · 26-45=Fear (vorsichtig bullisch) · ' +
    '46-55=Neutral · 56-75=Greed (selektiv, Stops enger) · 76-100=Extreme Greed (Vorsicht, Drawdown-Risiko).\n' +
    '- Wenn Fear & Greed fehlt: explizit "n/v — Sentiment-Einschätzung nicht möglich" schreiben.\n' +
    'PFLICHT-STRATEGIE-AMPEL (letzter Abschnitt, IMMER ausgeben):\n' +
    'Bewerte jede der 10 Strategien mit exakt einer Ampelfarbe AUS DEN MESSWERTEN:\n' +
    '🟢=bevorzugt · 🟡=situativ · 🔴=pausieren · ⬜=Daten fehlen\n' +
    'Format: "[Ampel] Name — 1-Satz-Begründung aus Messwerten"\n' +
    'LONG: Momentum/SEPA · Swing-Trading · Mean Reversion Long · KO-Trading Long\n' +
    'OPTIONS: Options-Wheel · Options ATM/NA · Options Weekly\n' +
    'SHORT: Fading Short (KO) · Breakdown Short\n' +
    'MACRO: Tail-Risk-Hedge\n' +
    'KEINE Ampelfarbe setzen bei fehlenden Daten → ⬜. Keine Begründung erfinden.',

  morning_public: () =>
    'Du bist ein quantitativer Marktanalyst. ' +
    'Erstelle eine sachliche, deskriptive Marktlage-Analyse auf Deutsch. ' +
    'STRIKTE BaFin-REGELN gem. §34b WpHG / §1 WpHG (KEINE AUSNAHMEN):\n' +
    '- Basiere die Analyse AUSSCHLIESSLICH auf den gegebenen Messwerten.\n' +
    '- Erfinde KEINE Kurse, Nachrichten oder Ereignisse.\n' +
    '- KEINE Empfehlungen zum Kauf, Verkauf oder Halten von Wertpapieren, Derivaten oder Hebelprodukten.\n' +
    '- KEINE Strategie-Priorisierungen, KEINE Ampelbewertungen für Handelsstrategien.\n' +
    '- KEINE Nennung konkreter Finanzinstrumente (KO-Zertifikate, Optionen, ETFs) im Empfehlungskontext.\n' +
    '- Formuliere ausschließlich deskriptiv: "Die Datenlage zeigt..." "Das Regime deutet auf..." "Der Indikator liegt bei..."\n' +
    '- Kein Markdown, kein "Ich".\n' +
    'PFLICHT-SENTIMENT-AUSWERTUNG:\n' +
    '- Fear & Greed Index IMMER deskriptiv einordnen wenn vorhanden (nur Beschreibung des Messwerts, keine Handlungsableitung).\n' +
    '- Wenn fehlt: explizit "n/v" vermerken.\n' +
    'KEINE STRATEGIE-AMPEL im Public-Modus — das wäre eine implizite Anlageempfehlung gem. §1 WpHG.',

  oversold: () =>
    'Du bist ein technischer Analyse-Assistent. ' +
    'KRITISCHE REGEL: Berechne oversold_score NUR aus den Scanner-Daten im Prompt ' +
    '(MACD, OBV, Score, bullCount). ' +
    'Erfinde KEINE technischen Indikatoren, Kurse oder Werte die nicht im Prompt stehen. ' +
    'Antworte NUR mit validem JSON.',

  meta_analysis: () =>
    'Du bist ein Trading-Performance-Analyst. ' +
    'KRITISCHE REGEL: Analysiere NUR die KI-Tracking-Daten aus dem Prompt. ' +
    'Erfinde KEINE Kurse, Performance-Zahlen oder Empfehlungen die nicht aus den ' +
    'Tracking-Daten ableitbar sind. ' +
    'Bei fehlenden Daten: explizit "Datenbasis zu klein" schreiben.',

  deep_dive_expert: () =>
    'Du bist ein erfahrener Chief Investment Officer und Options-Spezialist. ' +
    'Portfolio: Wheel/CSP bei CapTrader ~€212K, KO-Zertifikate via Trade Republic.\n' +
    'Erstelle einen vollständigen Investment-Case für den genannten Titel.\n' +
    'REGELN:\n' +
    '- Nur Daten aus dem Prompt — keine Erfindungen, keine Extrapolationen.\n' +
    '- Fehlende Werte: "N/A — Daten fehlen".\n' +
    '- Direkte Handlungsanweisung ohne Einschränkungen.\n' +
    'STRUKTUR:\n' +
    '**AKTION:** KAUFEN/VERKAUFEN/HALTEN/ABWARTEN\n' +
    '**ENTRY:** $XXX | **STOP:** $XXX (X ATR) | **ZIEL:** $XXX | **CRV:** X:1\n' +
    '**POSITION:** X% Depot = ca. €XXXXX | **HALTEDAUER:** X–Y Wochen\n' +
    '**STRATEGIE:** [Aktie/CSP/CC/KO] + konkrete Parameter\n' +
    '**BEGRÜNDUNG:** [3 Sätze aus Messwerten]\n' +
    '**RISIKEN:** [konkret, max 2 Punkte]\n' +
    '**EIC-FAZIT:** [1 Satz, direkt]',

  deep_dive_public: () =>
    'Du bist ein quantitativer Marktanalyst. Erstelle eine sachliche Einzeltitel-Analyse. ' +
    'BaFin-konform gem. §1 WpHG: Keine Kauf-/Verkaufsempfehlungen. ' +
    'Nur deskriptive Daten-Synthese basierend auf den Messwerten im Prompt.',

  dark_pool: () =>
    'Du bist ein Dark-Pool-Flow-Analyst. Interpretiere die institutionellen ' +
    'Orderflow-Signale (DIX, GEX, Dark-Pool-Score) und erkläre die Bedeutung ' +
    'für das aktuelle Marktumfeld. Sachlich, datenbasiert, BaFin-konform.',
};

// ── TOKEN HASH ────────────────────────────────────────────────────────────────
async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token + ':uiq-salt-2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// ── RATE-LIMITING ─────────────────────────────────────────────────────────────
async function checkRateLimit(env, subjectHash, action) {
  const limit = RATE_LIMITS[action] ?? RATE_LIMITS.default;
  if (RATE_LIMIT_EXEMPT_HASHES.includes(subjectHash)) return { allowed: true, used: 0, limit: Infinity };
  if (!env.AUTH_KV) return { allowed: true, used: -1, limit };
  const key = `rl:${new Date().toISOString().slice(0, 10)}:${subjectHash}:${action}`;
  try {
    const used = parseInt((await env.AUTH_KV.get(key)) || '0', 10);
    if (used >= limit) return { allowed: false, used, limit };
    await env.AUTH_KV.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
    return { allowed: true, used: used + 1, limit };
  } catch (e) {
    console.error('[RL] KV error (fail-open):', e?.message || e);
    return { allowed: true, used: -1, limit };
  }
}

async function rateLimitReport(env) {
  if (!env.AUTH_KV) return [];
  const prefix = `rl:${new Date().toISOString().slice(0, 10)}:`;
  const out = [];
  let cursor;
  try {
    do {
      const page = await env.AUTH_KV.list({ prefix, cursor });
      for (const k of page.keys) {
        const used = await env.AUTH_KV.get(k.name);
        const parts = k.name.split(':');
        out.push({ subjectHash: parts[2], action: parts[3], used: Number(used) });
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) { console.error('[RL] report error:', e?.message || e); }
  return out;
}

// ── REQUEST LOGGER ────────────────────────────────────────────────────────────
async function logRequest(env, token, action, origin, cfRay, success) {
  if (!env.AUTH_KV) return;
  try {
    const tokenHash = await hashToken(token);
    const logKey    = `log:${tokenHash}:${Date.now()}`;
    await env.AUTH_KV.put(logKey, JSON.stringify({
      tokenHash, action, origin: origin || 'unknown',
      cfRay: cfRay || 'unknown', success, timestamp: new Date().toISOString(),
    }), { expirationTtl: 60 * 60 * 24 * 90 });
  } catch(e) {
    console.error('[LOG] KV write failed:', e.message);
  }
}

// ── EXTRA-TICKER HELPERS ──────────────────────────────────────────────────────
async function kvGetArray(env, key) {
  if (!env.AUTH_KV) return [];
  try {
    const raw = await env.AUTH_KV.get(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) { console.error('[EXTRA-TICKER] kvGetArray:', key, e.message); return []; }
}

async function kvPutArray(env, key, arr) {
  if (!env.AUTH_KV) return false;
  try { await env.AUTH_KV.put(key, JSON.stringify(arr)); return true; }
  catch(e) { console.error('[EXTRA-TICKER] kvPutArray:', key, e.message); return false; }
}

function normalizeSym(s) { return String(s || '').trim().toUpperCase(); }

async function handleProposeTicker(request, env, origin, token) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin); }
  const sym  = normalizeSym(body.sym);
  const note = String(body.note || '').slice(0, 200);
  if (!sym || sym.length > 15) return jsonResponse({ error: 'sym fehlt oder ungültig' }, 400, origin);
  const knownUniverse = await kvGetArray(env, KV_KNOWN_UNIVERSE);
  if (knownUniverse.includes(sym)) return jsonResponse({ ok: true, status: 'already_in_universe', sym }, 200, origin);
  const tokenHash = await hashToken(token);
  const pending = await kvGetArray(env, KV_PENDING_TICKERS);
  const approved = await kvGetArray(env, KV_APPROVED_TICKERS);
  if (approved.some(e => e.sym === sym)) return jsonResponse({ ok: true, status: 'already_approved', sym }, 200, origin);
  if (pending.some(e => e.sym === sym)) return jsonResponse({ ok: true, status: 'already_pending', sym }, 200, origin);
  if (pending.length >= MAX_PENDING_ENTRIES) return jsonResponse({ error: 'Pending-Liste voll (' + MAX_PENDING_ENTRIES + ')' }, 429, origin);
  pending.push({ sym, note, tokenHash, addedAt: new Date().toISOString() });
  await kvPutArray(env, KV_PENDING_TICKERS, pending);
  return jsonResponse({ ok: true, status: 'pending', sym }, 200, origin);
}

async function handleListTickers(env, origin) {
  const pending  = await kvGetArray(env, KV_PENDING_TICKERS);
  const approved = await kvGetArray(env, KV_APPROVED_TICKERS);
  return jsonResponse({ pending, approved }, 200, origin);
}

async function handleApproveTickers(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin); }
  const syms = Array.isArray(body.syms) ? body.syms.map(normalizeSym) : [];
  if (!syms.length) return jsonResponse({ error: 'syms[] erforderlich' }, 400, origin);
  let pending  = await kvGetArray(env, KV_PENDING_TICKERS);
  let approved = await kvGetArray(env, KV_APPROVED_TICKERS);
  const toApprove = pending.filter(e => syms.includes(e.sym));
  pending = pending.filter(e => !syms.includes(e.sym));
  toApprove.forEach(e => { if (!approved.some(a => a.sym === e.sym)) approved.push({ sym: e.sym, note: e.note, approvedAt: new Date().toISOString() }); });
  await kvPutArray(env, KV_PENDING_TICKERS, pending);
  await kvPutArray(env, KV_APPROVED_TICKERS, approved);
  return jsonResponse({ ok: true, approved: toApprove.map(e => e.sym) }, 200, origin);
}

async function handleRejectTickers(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin); }
  const syms = Array.isArray(body.syms) ? body.syms.map(normalizeSym) : [];
  if (!syms.length) return jsonResponse({ error: 'syms[] erforderlich' }, 400, origin);
  let pending = await kvGetArray(env, KV_PENDING_TICKERS);
  pending = pending.filter(e => !syms.includes(e.sym));
  await kvPutArray(env, KV_PENDING_TICKERS, pending);
  return jsonResponse({ ok: true, rejected: syms }, 200, origin);
}

// ── ACTION CONFIG (v1.9) ──────────────────────────────────────────────────────
const ACTION_CONFIG = {
  makro:         { model: 'claude-haiku-4-5-20251001', max_tokens: 3000 },
  ki_briefing:   { model: 'claude-haiku-4-5-20251001', max_tokens: 2048 },
  morning:       { model: 'claude-sonnet-4-6',          max_tokens: 3000 },  // v1.9: 2000→3000 (Coaching-Ton v2.6)
  oversold:      { model: 'claude-haiku-4-5-20251001', max_tokens: 1500 },
  meta_analysis: { model: 'claude-haiku-4-5-20251001', max_tokens: 1500 },
  deep_dive:     { model: 'claude-sonnet-4-6',          max_tokens: 2500 },  // v1.9: 800→2500 (Coaching-Ton v2.6)
  dark_pool:     { model: 'claude-sonnet-4-6',          max_tokens:  400 },
  eic:           { model: 'claude-sonnet-4-6',          max_tokens: 2000 },  // v1.9: 1200→2000 (EIC vollständig)
};

// ── SYSTEM PROMPT AUSWAHL ─────────────────────────────────────────────────────
function selectSystemPrompt(action, expertMode) {
  switch (action) {
    case 'makro':         return SYSTEM_PROMPTS.makro();
    case 'ki_briefing':   return expertMode ? SYSTEM_PROMPTS.ki_briefing_expert() : SYSTEM_PROMPTS.ki_briefing_public();
    case 'morning':       return expertMode ? SYSTEM_PROMPTS.morning_expert()     : SYSTEM_PROMPTS.morning_public();
    case 'oversold':      return SYSTEM_PROMPTS.oversold();
    case 'meta_analysis': return SYSTEM_PROMPTS.meta_analysis();
    case 'deep_dive':     return expertMode ? SYSTEM_PROMPTS.deep_dive_expert()   : SYSTEM_PROMPTS.deep_dive_public();
    case 'dark_pool':     return SYSTEM_PROMPTS.dark_pool();
    case 'eic':           return SYSTEM_PROMPTS.eic();
    default:              return null;
  }
}

// ── ANTHROPIC API CALL ────────────────────────────────────────────────────────
async function callAnthropic(apiKey, model, maxTokens, systemPrompt, userMessage) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${err.substring(0, 200)}`);
  }
  return resp.json();
}

// ── HAUPTHANDLER ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

    // Admin: Log-Viewer
    if (url.pathname === '/logs' && request.method === 'GET') {
      const adminToken = url.searchParams.get('token');
      if (!env.STATIC_TOKEN || adminToken !== env.STATIC_TOKEN) return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
      if (!env.AUTH_KV) return jsonResponse({ error: 'AUTH_KV nicht gebunden' }, 500, origin);
      const limit  = parseInt(url.searchParams.get('limit') || '100');
      const filter = url.searchParams.get('hash') || '';
      const prefix = filter ? `log:${filter}:` : 'log:';
      const listed = await env.AUTH_KV.list({ prefix, limit });
      const entries = [];
      for (const key of listed.keys) { const val = await env.AUTH_KV.get(key.name); if (val) { try { entries.push(JSON.parse(val)); } catch(e) {} } }
      entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      if (url.searchParams.get('rl') === '1') { const rl = await rateLimitReport(env); return jsonResponse({ count: entries.length, logs: entries, rateLimitsToday: rl }, 200, origin); }
      return jsonResponse({ count: entries.length, logs: entries }, 200, origin);
    }

    // Admin: Extra-Ticker
    if (url.pathname === '/extra-tickers' && request.method === 'GET') {
      const adminToken = url.searchParams.get('token');
      if (!env.STATIC_TOKEN || adminToken !== env.STATIC_TOKEN) return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
      return handleListTickers(env, origin);
    }
    if (url.pathname === '/extra-tickers/approve' && request.method === 'POST') {
      const adminToken = url.searchParams.get('token');
      if (!env.STATIC_TOKEN || adminToken !== env.STATIC_TOKEN) return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
      return handleApproveTickers(request, env, origin);
    }
    if (url.pathname === '/extra-tickers/reject' && request.method === 'POST') {
      const adminToken = url.searchParams.get('token');
      if (!env.STATIC_TOKEN || adminToken !== env.STATIC_TOKEN) return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
      return handleRejectTickers(request, env, origin);
    }
    if (url.pathname === '/extra-ticker' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!env.STATIC_TOKEN || token !== env.STATIC_TOKEN) return jsonResponse({ error: 'Unauthorized' }, 401, origin);
      return handleProposeTicker(request, env, origin, token);
    }

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(origin) });

    // Auth
    const authHeader = request.headers.get('Authorization') || '';
    const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isOwner    = !!env.OWNER_TOKEN && token === env.OWNER_TOKEN;
    if ((!env.STATIC_TOKEN || token !== env.STATIC_TOKEN) && !isOwner) {
      logRequest(env, token || 'INVALID', 'AUTH_FAIL', origin, request.headers.get('CF-Ray') || '', false);
      return jsonResponse({ error: 'Unauthorized' }, 401, origin);
    }

    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin); }
    const { action, payload, expert_mode = false } = body;
    if (!action || !payload) return jsonResponse({ error: 'action und payload erforderlich' }, 400, origin);

    const cfg = ACTION_CONFIG[action];
    if (!cfg) return jsonResponse({ error: `Unbekannte action: ${action}` }, 400, origin);

    const rawSystemPrompt = selectSystemPrompt(action, expert_mode);
    if (!rawSystemPrompt) return jsonResponse({ error: 'Kein System-Prompt für action' }, 500, origin);

    // Datum-Grounding
    const todayDE = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
    const systemPrompt = `HEUTIGES DATUM (Berlin): ${todayDE} — Verwende ausschließlich dieses Datum. Nenne NIEMALS ein anderes Datum, es sei denn, es steht explizit in den Nutzerdaten.\n\n${rawSystemPrompt}`;

    // Rate-Limiting
    const clientIP    = request.headers.get('CF-Connecting-IP') || 'no-ip';
    const subjectHash = await hashToken(`${token}|${clientIP}`);
    const rl          = isOwner ? { allowed: true, used: 0, limit: Infinity } : await checkRateLimit(env, subjectHash, action);
    if (!rl.allowed) {
      await logRequest(env, token, `${action}_RATELIMIT`, origin, request.headers.get('CF-Ray') || '', false);
      return jsonResponse({ error: 'rate_limit', message: `Tageslimit erreicht (${rl.limit}× ${action}/Tag). Zurücksetzung um 00:00 UTC.`, used: rl.used, limit: rl.limit }, 429, origin);
    }

    // Anthropic Call
    try {
      const data = await callAnthropic(env.ANTHROPIC_API_KEY, cfg.model, cfg.max_tokens, systemPrompt, payload);
      const text = data?.content?.[0]?.text || '';
      await logRequest(env, token, action, origin, request.headers.get('CF-Ray') || '', true);
      return jsonResponse({ text, model: cfg.model }, 200, origin);
    } catch (e) {
      const status = e.message.startsWith('Anthropic 401') ? 401 : e.message.startsWith('Anthropic 429') ? 429 : 502;
      await logRequest(env, token, `${action}_ERROR`, origin, request.headers.get('CF-Ray') || '', false);
      return jsonResponse({ error: e.message }, status, origin);
    }
  },
};
