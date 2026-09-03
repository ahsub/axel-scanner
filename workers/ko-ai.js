/**
 * ko-ai.ahildebrand.workers.dev
 * ══════════════════════════════════════════════════════════════════
 * UnderlyingIQ — KI-Proxy Worker v1.16
 *
 * NEU in v1.16 (31.08.2026, Compliance-Scanner-Regex-Lücke geschlossen —
 *   Priorität 1 aus Übergabeprotokoll 30.08. §8, zwei unabhängige
 *   Live-Belege am selben Tag):
 *   - Pattern 'strukturell unnötig' verlangte zwingend "strukturell" direkt
 *     vor "unnötig"/"nicht erforderlich" — beide Live-Belege vom 30.08.
 *     enthielten dieses Präfix NICHT: 1. Beleg "klassifiziert Collar-Setups
 *     als 'nicht nötig'" (andere Wortform: "nicht nötig" statt "unnötig"),
 *     2. Beleg "als Regime-Signal 'nicht erforderlich' bewertet" (ohne
 *     "strukturell" davor). Beide liefen am Compliance-Scanner vorbei.
 *   - Fix: Pflicht-Präfix entfernt, Pattern auf reine Wortgrenzen-Suche
 *     nach "unnötig" / "nicht nötig" / "nicht erforderlich" verengt, ohne
 *     geforderten Vorgänger-Kontext. Gegen den Prompt-Text selbst geprüft
 *     (ko-prompts.js v2.17.0): keine legitime Verwendung dieser Begriffe
 *     vorhanden, die jetzt fälschlich anschlagen würde — Scan bleibt
 *     zudem rein loggend (nicht blockierend), Fehlalarm-Risiko gering.
 *
 * NACHTRAG 2 (01.09.2026, Axel + Claude, isOwner-Verdacht im
 *   Haupthandler ausgeräumt):
 *   Nach der zweiten OWNER_TOKEN-Rotation trat ein einzelner
 *   "KI-Token ungültig"-Fehlschlag auf, obwohl der Wert nachweislich
 *   identisch (Passwort-Safe, an beiden Stellen — ko-ai UND ko-sync —
 *   neu gesetzt, redeployed) im Frontend eingetragen war. Verdacht:
 *   unsichtbares Zeichen in einer der beiden Quellen. Ein temporärer
 *   Debug-Log direkt nach der isOwner-Zuweisung im Haupt-POST-Handler
 *   (nur Längen+Boolean, kein Klartext) zeigte beim nächsten
 *   erfolgreichen Aufruf: token.length=64, owner.length=64 (identisch),
 *   isOwner=true, matchesStatic=false — kein Zeichenfehler, isOwner
 *   griff korrekt. Der einzelne Fehlschlag war mit hoher
 *   Wahrscheinlichkeit eine kurze Cloudflare-Edge-Propagations-
 *   verzögerung nach dem Redeploy (gleiches Muster wie der
 *   STATIC_TOKEN-Edge-Delay im 31.08.-Protokoll §3), kein struktureller
 *   Bug. Debug-Log nach Bestätigung wieder entfernt.
 *
 * NACHTRAG 1 (01.09.2026, Axel + Claude, OWNER_TOKEN-Diagnose /logs-Endpunkt):
 *   Nach dem Neusetzen von OWNER_TOKEN/STATIC_TOKEN (verschiedene Werte)
 *   wurde die isOwner-Verzweigung live verifiziert: ein ki_briefing-
 *   Live-Aufruf über das Frontend erschien anschließend NICHT in
 *   /logs?rl=1 (rateLimitsToday leer) — checkRateLimit() wird für
 *   isOwner=true also korrekt übersprungen, der Bearer-Token-Vergleich
 *   gegen env.OWNER_TOKEN funktioniert wie in v1.7 vorgesehen. Der
 *   ursprüngliche "Unauthorized" bei /logs?token=... war kein isOwner-Bug,
 *   sondern schlicht der falsche Token für diesen Endpoint (/logs prüft
 *   separat und ausschließlich gegen env.STATIC_TOKEN als Query-Parameter
 *   ?token=, nicht gegen OWNER_TOKEN) plus ein Copy-Paste-Rest beim
 *   ersten Versuch. Ein dafür kurzzeitig eingefügter Debug-Log (nur
 *   Längen+Boolean, kein Klartext-Token) ist nach Abschluss der Diagnose
 *   wieder entfernt. Bei diesem Test zusätzlich entdeckt (separat zu
 *   behandeln): der ki_briefing-Output enthielt echte Compliance-Treffer
 *   ("Prämienerwartung", "optimal") trotz Wortverbot in
 *   PUBLIC_REGULATORY_GUARDRAIL — noch nicht weiter untersucht.
 *
 * NEU in v1.15 (30.08.2026, Diagnose-Instrumentierung — Axel-Meldung
 *   "Morning Briefing dauert seit einigen Tagen ~10min statt <3min"):
 *   - callAnthropic() misst jetzt Start-/Endzeit um den fetch()-Call und
 *     loggt Modell, max_tokens und Dauer in ms via console.log (sichtbar
 *     in `wrangler tail`/CF-Dashboard). Reiner Diagnose-Zusatz, KEINE
 *     Verhaltensänderung, kein Einfluss auf Response/Fehlerpfad.
 *   - Zweck: unterscheiden, ob die Verlangsamung im Anthropic-Call selbst
 *     liegt oder in der vorgelagerten Datensammlung (ctx.marktkontext,
 *     CBOE-Abrufe) — dafür bislang keinerlei Zeitmessung vorhanden.
 *   - Bewusst als eigener, von der heutigen Coaching-Standard-Änderung
 *     unabhängiger Versionssprung behandelt (Diagnose-Fix, kein Feature).
 *
 * NEU in v1.14 (29.08.2026, Collar-Live-Test, letzter Fund des Tages):
 *   - 3 neue COMPLIANCE_PATTERNS: HVP-Richtungsfehler ("Volatilitaets-
 *     kompression" bei tatsaechlich HOHER Volatilitaet — Bedeutungsumkehr,
 *     erschien konsistent in mehreren Strategien heute, obwohl nirgends im
 *     Prompt-Text vorgegeben); "strukturell unnoetig" (Regime-Einschaetzung
 *     die wie eine Handlungsfreigabe klingt); "praemieneffizient" (weitere
 *     Variante der oekonomischen Tatsachenbehauptung ohne Live-Optionskette).
 *     Bekannte Einschraenkung: der HVP-Kompressions-Filter ist textbasiert
 *     und kann nicht pruefen, ob der HVP-Wert im konkreten Satz tatsaechlich
 *     hoch war — bei legitimer Verwendung des Konzepts "Volatility
 *     Contraction" (z.B. VCP-Strategie, echte Kursbereich-Kontraktion, ein
 *     anderes Konzept als HVP) waere ein Fehlalarm moeglich. Da der Scan
 *     rein loggend (nicht blockierend) ist, ist das Risiko gering.
 *
 * NEU in v1.13 (29.08.2026, CC-Live-Test, Trade-off-Prinzip):
 *   - 3 neue COMPLIANCE_PATTERNS ergaenzt (guenstiges Praemien-/Volatilitaets-
 *     Umfeld als oekonomische Tatsachenbehauptung; "reduziert die Gefahr/das
 *     Risiko" als Marktprognose-Framing; "Modell favorisiert/bevorzugt
 *     [aggressiv/konservativ/...]" als indirekte Options-Parameter-
 *     Entscheidung). Bewusst NICHT als blanker "Modell bevorzugt"-Filter,
 *     da diese Phrase auf Aggregatebene (Titel-Ranking) weiterhin zulaessig
 *     und sogar Pflichtformulierung ist — nur die Parameter-Kombination
 *     (aggressiv/konservativ/höher/nieder direkt danach) wird geflaggt.
 *
 * NEU in v1.12 (29.08.2026, Spec-Belastungstest — CSP/Wheel-Live-Test):
 *   - Deterministischer Compliance-Scan nach der KI-Antwort, vor Auslieferung
 *     (scanForComplianceViolations()). Auslöser: "attraktiv" und
 *     "Prämienerwartung" waren beide bereits wortwörtlich in
 *     PUBLIC_REGULATORY_GUARDRAIL (ko-prompts.js) verboten und erschienen
 *     trotzdem im Output — Beweis, dass Prompt-Instruktionen allein keine
 *     100%ige Zuverlässigkeit haben. Diese Ebene haengt nicht von
 *     Prompt-Befolgung ab, sondern erkennt bekannte Verstöße mechanisch.
 *   - Bewusst NICHT blockierend (kein Retry, keine Zensur) — nur Logging via
 *     bestehendem logRequest()-Mechanismus (neues optionales Feld
 *     `complianceFlags`), abrufbar über /logs?flagged=1. Begründung:
 *     Blockieren ohne Fallback-Plan (Retry? Fehlermeldung an Nutzer?) wäre
 *     ein neues Risiko in einem aktiv genutzten Produkt — erst Daten
 *     sammeln, wie oft/wo das wirklich auftritt, dann über härtere
 *     Maßnahmen entscheiden.
 *   - Nur für Public-Mode-Antworten aktiv (expert_mode ist bewusst
 *     unverändert direktiv, s. SUITE.md №65/№66).
 *
 * NEU in v1.11 (27.08.2026, Legal-Briefing-Audit — Backlog №60 in SUITE.md v4.19):
 *   - SICHERHEITS-FIX: expert_mode ist jetzt serverseitig hart an isOwner
 *     gebunden (`expertModeRequested && isOwner`), statt das Client-Flag
 *     ungeprüft zu übernehmen. Hintergrund: STATIC_TOKEN wird von allen
 *     Beta-Testern geteilt, das clientseitige EIC-PIN-Gate (localStorage,
 *     axel-scanner/index.html) ist selbstgesetzt und bot keine echte
 *     Identitätsprüfung — jeder Beta-Tester konnte sich damit theoretisch
 *     selbst freischalten und Axels reale Portfoliodaten (NAV ~€212K,
 *     Live-Positionen) aus den Expert-Prompts (eic, ki_briefing_expert,
 *     deep_dive_expert, morning_expert) einsehen. Da der Token selbst
 *     keine Einzelnutzer unterscheidet, ist OWNER_TOKEN das einzig
 *     verfügbare Unterscheidungsmerkmal (Axel persönlich vs. alle
 *     STATIC_TOKEN-Nutzer). Deutlich kleiner als die für Phase-2 vorgesehene
 *     volle JWT-Migration (s. Auth-Abschnitt unten) — reine Absicherung
 *     der bestehenden Mechanik, kein neues Auth-System. Verworfene
 *     Alternative: Token-Hash-Allowlist — funktioniert nicht, weil
 *     STATIC_TOKEN für alle Nutzer identisch ist und daher keinen
 *     Einzelnutzer-Hash liefert. Abgelehnte Anfragen werden als
 *     `<action>_EXPERT_DENIED` geloggt (Audit-Spur, kein Fehler an den
 *     Client — fällt still auf den Public-Prompt zurück).
 *   - ZUSATZFUND beim Umsetzen: die 'eic'-Action hatte gar keinen Public/
 *     Expert-Split (immer voller Investment-Case, unabhängig von
 *     expert_mode) und war über die API weiterhin erreichbar, obwohl im
 *     aktuellen Frontend kein Call-Site mehr existiert. Jetzt zusätzlich
 *     hart auf isOwner gesperrt (403 für Nicht-Owner).
 *
 * NEU in v1.10 (21.08.2026):
 *   - morning: 3000 → 4500. Live-Beweis (Axel, 21.08.2026, 08:12 Uhr
 *     Briefing): Ausgabe brach hart mitten im Wort ab ("bei bestehenden
 *     Long-Positionen s...") — klassische max_tokens-Abbruchsignatur,
 *     kein Frontend-Anzeigefehler. Die v1.9-Annahme, morning sei nach
 *     der 05.08-Erhöhung (2000->3000) nicht mehr betroffen, war FALSCH:
 *     der Prompt ist seither mehrfach gewachsen (Pflicht-Sentiment-
 *     Auswertung + 10-zeilige Strategie-Ampel-Tabelle mit Begruendung
 *     pro Zeile, s. v1.4/v1.5), ohne dass das Token-Budget je gegen die
 *     aktuelle Prompt-Laenge nachgetestet wurde.
 *   - Lehre aus drei Fehlschaetzungen in Folge (deep_dive am 05.08.,
 *     eic und ki_briefing/dark_pool in v1.9, jetzt morning): kuenftig
 *     grosszuegige Sicherheitsmarge statt knapper Nachjustierung, um
 *     wiederholtes Nachbessern kurz vor Praesentationen zu vermeiden.
 *
 * NEU in v1.9 (21.08.2026):
 *   - max_tokens-Erhöhung gegen wiederkehrende Truncation-Beschwerden
 *     (Axel-Anfrage 21.08.2026, "Handlungsempfehlungen brechen häufig
 *     unvermittelt ab"):
 *       ki_briefing: 2048 → 3000  (Output-Format verlangt 9 Pflichtfelder
 *         AKTION/STRATEGIE/ENTRY/STOP/ZIEL/POSITION/HALTEDAUER/BEGRÜNDUNG/
 *         WARNUNG — 2048 war seit Einführung nie erhöht worden, obwohl
 *         morning/deep_dive/eic am 05.08.2026 bereits angepasst wurden.)
 *       eic: 2000 → 3500  (umfangreichster Prompt im System — 7 Pflicht-
 *         Abschnitte inkl. vollstaendiger Options-Parameter-Tabelle; die
 *         05.08-Erhöhung von 1200→2000 reichte laut Axel weiterhin nicht.)
 *       dark_pool: 400 → 1000  (bislang nie erhöht — bei ~300 Wörtern
 *         Kapazität plausibler Kandidat für Abbrüche, erst heute als
 *         betroffen gemeldet.)
 *     morning (3000) und deep_dive (2500) zunaechst unveraendert gelassen,
 *     da nicht explizit als weiterhin betroffen gemeldet — dieser Grundsatz
 *     wurde in v1.10 fuer morning revidiert, s.o. (Live-Beweis).
 *   - Root-Cause-Kontext (Nachtrag zur 05.08-Änderung): Die damalige
 *     Session hatte behauptet, diese Datei sei bereits als workers/
 *     ko-ai.js ins Repo ahsub/ko-aggregator versioniert worden — das war
 *     NICHT der Fall (verifiziert 21.08.2026: kein einziger Commit
 *     erwähnt ko-ai.js, workers/ enthaelt nur ko-watchdog/). Die Live-
 *     Werte im CF-Dashboard waren zwar seit 05.08. korrekt aktiv (Axel
 *     hatte sie direkt im Dashboard gesetzt), aber der SPOF aus
 *     STRATEGIE.md ("ko-ai-Worker-Quellcode nicht versioniert") blieb
 *     bestehen. Mit diesem Commit erstmals tatsaechlich behoben.
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
 *     Einrichtung: Dashboard → Settings → Variables and Secrets → OWNER_TOKEN
 *     anlegen; denselben Wert in der eigenen App unter Einstellungen →
 *     KI-Zugangs-Token eintragen. Ohne gesetztes Secret ändert sich nichts.
 *   - Bekannte Phase-1-Grenze dokumentiert: IP-scoped Limits sind durch
 *     VPN-IP-Rotation umgehbar (Restrisiko geschlossene Beta; ab Phase-2-JWT
 *     obsolet). RATE_LIMIT_EXEMPT_HASHES bleibt als Fallback erhalten.
 *
 * NEU in v1.6 (04.07.2026):
 *   - Rate-Limiting AKTIV verdrahtet (vorher: Patch-Block v1.0 eingefügt,
 *     aber nie aufgerufen — toter Code). Limits je Action pro Tag,
 *     KV-Tageszähler in AUTH_KV, fail-open bei KV-Störung.
 *   - Scope-Entscheidung: Da Phase-1-Auth EINEN statischen Token für alle
 *     Nutzer verwendet, wäre ein Limit "pro tokenHash" ein GLOBALES Limit.
 *     Daher Zähler-Subjekt = hashToken(token + '|' + Client-IP) —
 *     näherungsweise pro Nutzer, gehasht+gesalzen (keine Klartext-IPs in KV),
 *     26h-TTL. Ab Phase-2-JWT wird das Subjekt der User-Hash.
 *   - /logs erweitert: ?rl=1 liefert zusätzlich die heutigen
 *     Rate-Limit-Zählerstände (Phase-1-Metrik "KI-Kosten je Nutzer").
 *   - 429-Antworten werden als Action "<action>_RATELIMIT" mitgeloggt.
 *   - Referenz: UIQ-STRATEGIE v1.3 Risikoregister "KI-Kosten-Skalierung";
 *     Quellcode ab jetzt versioniert in ahsub/workers (Befund behoben).
 *
 * NEU in v1.5 (01.07.2026):
 *   - Strategie-Ampel-Matrix im Morning Briefing (Expert + Public): alle 10
 *     Strategien werden mit Ampelfarbe (🟢🟡🔴⬜) + 1-Satz-Begründung aus
 *     Messwerten bewertet. Strikt no-hallucination: ⬜ wenn Daten fehlen,
 *     keine Ampelfarbe aus dem Training erfinden. Passend zu fading_short
 *     als neuer 10. Strategie (ko-strategies.js v2.1.0).
 *
 * NEU in v1.4 (01.07.2026):
 *   - Fear & Greed Index Pflicht-Auswertung in morning_expert + morning_public:
 *     KI muss den Wert jetzt explizit einordnen (Extreme Fear=kontraindik. bullisch
 *     bis Extreme Greed=Drawdown-Risiko). Vorher wurden die Daten an die KI
 *     gesendet aber nicht explizit zur Interpretation angewiesen → wurde
 *     haeufiig stillschweigend uebergangen.
 *
 * NEU in v1.3 (30.06.2026):
 *   - Copyright-Fix: "LUDWIG-URTEIL" im EIC-Prompt umbenannt zu "EIC-FAZIT" —
 *     "Ludwig" darf aus Copyright-Gruenden nicht mehr im Output erscheinen.
 *
 * NEU in v1.2 (30.06.2026):
 *   - Dedupe-Fix: Extra-Ticker-Vorschläge werden jetzt zusätzlich gegen die
 *     vom Aggregator gepushte known_universe_tickers-Liste abgeglichen,
 *     BEVOR sie in die Pending-Review-Liste aufgenommen werden. Verhindert
 *     unnötigen Admin-Aufwand für längst vorhandene Ticker (z.B. AAPL).
 *   - Durchgängig ES6 (Template Literals statt String-Konkatenation).
 *
 * NEU in v1.1 (30.06.2026):
 *   - Extra-Ticker-Vorschläge: User können im Fibo-Tab Custom-Ticker
 *     "zur Aggregator-Liste vorschlagen". Landen zunächst in einer
 *     Pending-Liste (KV), erst nach Admin-Freigabe übernimmt der
 *     nächtliche Aggregator-Lauf sie in die Ticker-Universe.
 *   - Grund: bei >1 User würde eine automatische Übernahme ohne Review
 *     a) Abuse/Spam ermöglichen, b) das GitHub-Actions-Zeitbudget
 *     (30min Timeout) und yfinance-Rate-Limits unkontrolliert belasten.
 *   - Jeder Vorschlag wird mit tokenHash + Zeitstempel attribuiert —
 *     Vorbereitung für späteres Multi-User/Quota-Handling.
 *
 * ⚠️ WICHTIGE VORAUSSETZUNG (bitte vor Deploy prüfen):
 *   AUTH_KV muss an dieselbe Cloudflare-KV-Namespace-ID gebunden sein,
 *   die auch CF_KV_NS_ID in den GitHub Actions Secrets referenziert
 *   (Namespace 86c05f66e32346b99e720d861fedd1de lt. Übergabeprotokoll).
 *   Nur so kann der Python-Aggregator die "approved_extra_tickers" aus
 *   demselben KV lesen, in das dieser Worker schreibt.
 *   Falls AUTH_KV aktuell an einen ANDEREN Namespace gebunden ist
 *   (z.B. dediziert fürs Logging), entweder:
 *     a) wrangler.toml AUTH_KV-Binding auf den Markt-Daten-Namespace
 *        umstellen, oder
 *     b) eine zweite KV-Binding (z.B. MARKET_KV) ergänzen und unten
 *        in TICKER_KV_BINDING den Namen anpassen.
 *
 * Zweck (unverändert):
 *   - Anthropic API Key bleibt SERVERSIDE (in CF Worker Secrets)
 *   - System-Prompts (IP) bleiben SERVERSIDE — nicht im Frontend sichtbar
 *   - Frontend sendet nur: { action, payload, token }
 *   - Worker injiziert System-Prompt, ruft Anthropic auf, gibt Ergebnis zurück
 *
 * Actions (KI-Proxy, unverändert):
 *   makro, ki_briefing, morning, oversold, meta_analysis, deep_dive, dark_pool, eic
 *
 * Neue Routen (Extra-Ticker):
 *   POST /extra-ticker            Bearer-Auth (User)  → Vorschlag einreichen
 *   GET  /extra-tickers           ?token=ADMIN         → Pending+Approved auflisten
 *   POST /extra-tickers/approve   ?token=ADMIN         → { syms:[...] } freigeben
 *   POST /extra-tickers/reject    ?token=ADMIN         → { syms:[...] } verwerfen
 *
 * Auth (Phase 1 — statischer Token):
 *   Header: Authorization: Bearer <STATIC_TOKEN>
 *   CF Secret: STATIC_TOKEN (wfc-geheim-xxx)
 *   Phase 2: JWT pro User (nach Auth-Integration)
 *   ⚠️ Bekannte Phase-1-Grenzen (Register UIQ-STRATEGIE v1.3):
 *     - expert_mode ist ein Client-Flag → jeder Token-Inhaber kann
 *       Expert-Prompts anfordern; harte Trennung erst mit Phase-2-JWT.
 *     - Rate-Limits daher IP-scoped statt user-scoped (s. v1.6-Eintrag).
 *
 * CF Secrets (wrangler secret put):
 *   ANTHROPIC_API_KEY   → Anthropic API Key
 *   STATIC_TOKEN        → statisches Bearer Token (Phase 1)
 *
 * Deploy:
 *   wrangler deploy
 *
 * CORS:
 *   Erlaubt: ahsub.github.io, localhost:*
 *   Für SaaS: eigene Domain eintragen
 */

// ── KV-KEYS für Extra-Ticker-Feature ──────────────────────────────────────────
const KV_PENDING_TICKERS  = 'pending_tickers';          // Array, wartet auf Review
const KV_APPROVED_TICKERS = 'approved_extra_tickers';   // Array, vom Aggregator gelesen
const KV_KNOWN_UNIVERSE   = 'known_universe_tickers';    // Array, vom Aggregator nach jedem Lauf gepusht (Dedupe-Check)
const MAX_PENDING_ENTRIES = 200;                          // Cap gegen Spam/Bloat

// ── RATE-LIMIT-KONFIGURATION (v1.6) ───────────────────────────────────────────
const RATE_LIMITS = {
  deep_dive:     5,
  morning:       20,  // TEMP hochgesetzt (10.07.2026) für aktive Phase-0.5-Testphase
                       // — vorher 2, was Axels eigenes Testen blockierte. Vor Beta-
                       // Launch wieder auf 2-3 senken ODER Owner-Exempt-Hash eintragen.
  dark_pool:     3,
  eic:           5,
  ki_briefing:   6,
  meta_analysis: 3,
  default:      10,   // makro, oversold und alles Übrige zusammen
};

const RATE_LIMIT_EXEMPT_HASHES = [
  // 'a1b2c3d4e5f60718',
];

// ── CORS-Konfiguration ────────────────────────────────────────────────────────
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

// ── SYSTEM PROMPTS (serverside — nicht im Frontend) ───────────────────────────
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
    'TRADING-KONTEXT: Du bist ein Trading-Analyse-Assistent. ' +
    'Verwende AUSSCHLIESSLICH die Daten aus dem Nutzer-Prompt. ' +
    'Erfinde oder schätze NIEMALS Kurse, Strikes, Prämien oder andere Zahlen. ' +
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

// ── TOKEN HASH (für anonymisiertes Logging UND Extra-Ticker-Attribution) ─────
async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token + ':uiq-salt-2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// ── RATE-LIMITING (v1.6) ──────────────────────────────────────────────────────
async function checkRateLimit(env, subjectHash, action) {
  const limit = RATE_LIMITS[action] ?? RATE_LIMITS.default;

  if (RATE_LIMIT_EXEMPT_HASHES.includes(subjectHash)) {
    return { allowed: true, used: 0, limit: Infinity };
  }
  if (!env.AUTH_KV) {
    return { allowed: true, used: -1, limit }; // kein KV → fail-open
  }

  const key = `rl:${new Date().toISOString().slice(0, 10)}:${subjectHash}:${action}`;
  try {
    const used = parseInt((await env.AUTH_KV.get(key)) || '0', 10);
    if (used >= limit) {
      return { allowed: false, used, limit };
    }
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
  } catch (e) {
    console.error('[RL] report error:', e?.message || e);
  }
  return out;
}

// ── REQUEST LOGGER ────────────────────────────────────────────────────────────
async function logRequest(env, token, action, origin, cfRay, success, complianceFlags) {
  if (!env.AUTH_KV) return;
  try {
    const tokenHash  = await hashToken(token);
    const timestamp  = new Date().toISOString();
    const logKey     = `log:${tokenHash}:${Date.now()}`;
    const logEntry   = JSON.stringify({
      tokenHash,
      action,
      origin:   origin || 'unknown',
      cfRay:    cfRay  || 'unknown',
      success,
      timestamp,
      // NEU (29.08.2026, Spec-Belastungstest CSP/Wheel-Live-Test): nur
      // gesetzt, wenn der Compliance-Scan (s. scanForComplianceViolations())
      // in einer Public-Mode-Antwort mindestens einen bekannten Verstoss
      // gefunden hat. Absichtlich NICHT blockierend — dient der Sichtbarkeit
      // (wie oft/wo treten Verstoesse trotz Guardrail auf), nicht der
      // automatischen Zensur. Ueber den bestehenden /logs-Endpoint abrufbar.
      ...(complianceFlags && complianceFlags.length ? { complianceFlags } : {}),
    });
    await env.AUTH_KV.put(logKey, logEntry, { expirationTtl: 60 * 60 * 24 * 90 });
  } catch(e) {
    console.error('[LOG] KV write failed:', e.message, '| AUTH_KV bound:', !!env.AUTH_KV);
  }
}

// ── COMPLIANCE-SCAN (v1.12, 29.08.2026) ─────────────────────────────────────
// Deterministischer Nachpruef-Schritt gegen UIQ-REGULATORY-LANGUAGE-SPEC.md.
// Entstanden nach dem CSP/Wheel-Live-Test: "attraktiv" und "Praemienerwartung"
// waren beide bereits WORTWOERTLICH in PUBLIC_REGULATORY_GUARDRAIL
// (ko-prompts.js) verboten und erschienen trotzdem im Output — Beweis, dass
// Prompt-Instruktionen allein keine 100%ige Zuverlaessigkeit haben, auch bei
// exakten Wortverboten. Diese Liste ist bewusst NICHT identisch mit der
// Guardrail-Wortliste: sie enthaelt nur Begriffe mit niedrigem
// Fehlalarm-Risiko (z.B. "Empfehlung" fehlt hier bewusst, weil das Modell es
// legitim in einer Verneinung wie "keine Empfehlung" verwenden darf/soll —
// ein reiner String-Match wuerde das faelschlich flaggen). Nur fuer
// Public-Mode-Antworten relevant (expert_mode-Antworten sind bewusst
// direktiv, s. SUITE.md №65/№66).
const COMPLIANCE_PATTERNS = [
  { label: 'attraktiv',            re: /\battraktiv\w*/i },
  { label: 'strukturell günstig',  re: /strukturell\s+(günstig|attraktiv)/i },
  { label: 'Prämienerwartung',     re: /Prämienerwartung/i },
  { label: 'optimal',              re: /\boptimal(?:e|er|es|en|erweise)?\b/i },
  { label: 'Fokus auf',            re: /\bFokus\s+auf\b/i },
  { label: 'priorisier',           re: /priorisier/i },
  { label: 'solltest du',          re: /solltest\s+du/i },
  { label: 'jetzt handeln',        re: /jetzt\s+handeln/i },
  { label: 'Trade eröffnen',       re: /Trade\s+eröffnen/i },
  { label: 'Top-Kandidat',         re: /Top-Kandidat/i },
  { label: 'Exit-Schwelle/-Fenster', re: /Exit-(Schwelle|Fenster)/i },
  { label: 'Stop unterhalb/oberhalb', re: /Stop\s+(unterhalb|oberhalb)/i },
  { label: 'ist für dich nicht geeignet', re: /ist\s+für\s+dich\s+nicht\s+geeignet/i },
  { label: 'günstiges Prämien-/Volatilitäts-Umfeld', re: /günstiges?\s+(Prämien|Volatilitäts)-?Umfeld/i },
  { label: 'reduziert die Gefahr/das Risiko', re: /reduziert\s+(modellseitig\s+)?(die\s+Gefahr|das\s+Risiko)/i },
  { label: 'Modell favorisiert/bevorzugt [Parameter] (Regex verbreitert 03.09.2026 — alte Fassung verlangte "die/den/eine" + Adjektiv direkt danach, ließ "Modell bevorzugt trotzdem die Kombination aus..." durch)', re: /Modell\s+(favorisiert|bevorzugt)/i },
  { label: 'HVP-Richtungsfehler (Kompression bei hohem HVP)', re: /(Volatilitäts-?kompression|Volatilitäts-?komprimierung|komprimierte\s+Vol)/i },
  { label: 'unnötig/nicht erforderlich (Regex-Lücke geschlossen 31.08.2026 — zwei unabhängige Live-Belege 30.08.: "nicht nötig" und "nicht erforderlich" OHNE "strukturell" davor, Pflicht-Präfix griff nicht)', re: /\b(unnötig|nicht\s+n(ö|oe)tig|nicht\s+erforderlich)\b/i },
  { label: 'prämieneffiziente Struktur', re: /prämieneffizient/i },
  { label: 'maximiert/optimiert (Verbform, Zielkonflikt-Superlativ)', re: /\b(maximiert|optimiert)\b/i },
  { label: 'Andienungs-/Ausübungswahrscheinlichkeit', re: /(Andienungs|Ausübungs)wahrscheinlichkeit/i },
  { label: 'keine strukturellen Hemmnisse', re: /keine\s+strukturellen\s+Hemmnisse/i },
  { label: 'ATM-orientiert (Strategy-Fit-Moneyness-Verwechslung, ggf. False-Positive bei atmna selbst)', re: /ATM-orientiert/i },
  { label: 'verdichtet(e) Volatilität (Synonym-Umgehung von komprimiert)', re: /verdichtete?\s+Volatilit/i },
  { label: 'nicht strukturell gehemmt (Synonym-Umgehung von Hemmnisse)', re: /nicht\s+strukturell\s+gehemmt/i },
  { label: 'Strike-Annäherung/Strike-Niveau aus Underlying-Signal (Regex präzisiert 03.09.2026 — flaggt nur die kausale Verknüpfung, nicht den erwünschten "...kann UIQ ohne Optionskettendaten nicht beurteilen"-Vorbehalt im selben Satz)', re: /Strike-(Ann(ä|ae)herung|Niveau)(?![^.]{0,100}beurteilen)/i },
];

function scanForComplianceViolations(text) {
  if (!text) return [];
  const hits = [];
  for (const p of COMPLIANCE_PATTERNS) {
    if (p.re.test(text)) hits.push(p.label);
  }
  return hits;
}

// ── EXTRA-TICKER HELPERS ──────────────────────────────────────────────────────
async function kvGetArray(env, key) {
  if (!env.AUTH_KV) return [];
  try {
    const raw = await env.AUTH_KV.get(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) {
    console.error('[EXTRA-TICKER] kvGetArray Fehler:', key, e.message);
    return [];
  }
}

async function kvPutArray(env, key, arr) {
  if (!env.AUTH_KV) return false;
  try {
    await env.AUTH_KV.put(key, JSON.stringify(arr));
    return true;
  } catch(e) {
    console.error('[EXTRA-TICKER] kvPutArray Fehler:', key, e.message);
    return false;
  }
}

function normalizeSym(s) {
  return String(s || '').trim().toUpperCase();
}

async function handleProposeTicker(request, env, origin, token) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400, origin); }

  const sym  = normalizeSym(body.sym);
  const note = String(body.note || '').slice(0, 200);
  if (!sym || sym.length > 15) {
    return jsonResponse({ error: 'sym fehlt oder ungültig' }, 400, origin);
  }

  const knownUniverse = await kvGetArray(env, KV_KNOWN_UNIVERSE);
  if (knownUniverse.includes(sym)) {
    return jsonResponse({ ok: true, status: 'already_in_universe', sym }, 200, origin);
  }

  const tokenHash = await hashToken(token);
  const pending = await kvGetArray(env, KV_PENDING_TICKERS);
  const approved = await kvGetArray(env, KV_APPROVED_TICKERS);

  if (approved.some(e => e.sym === sym)) {
    return jsonResponse({ ok: true, status: 'already_approved', sym }, 200, origin);
  }
  if (pending.some(e => e.sym === sym)) {
    return jsonResponse({ ok: true, status: 'already_pending', sym }, 200, origin);
  }
  if (pending.length >= MAX_PENDING_ENTRIES) {
    return jsonResponse({ error: 'Pending-Liste voll (Limit ' + MAX_PENDING_ENTRIES + ') — bitte zuerst im Admin-Tab sichten.' }, 429, origin);
  }

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
  toApprove.forEach(e => {
    if (!approved.some(a => a.sym === e.sym)) {
      approved.push({ sym: e.sym, note: e.note, approvedAt: new Date().toISOString() });
    }
  });

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

const ACTION_CONFIG = {
  makro:         { model: 'claude-haiku-4-5-20251001', max_tokens: 3000 },
  ki_briefing:   { model: 'claude-haiku-4-5-20251001', max_tokens: 3000 }, // v1.9: 2048->3000
  morning:       { model: 'claude-sonnet-4-6',          max_tokens: 4500 }, // v1.10: 3000->4500 (Live-Truncation bestaetigt)
  oversold:      { model: 'claude-haiku-4-5-20251001', max_tokens: 1500 },
  meta_analysis: { model: 'claude-haiku-4-5-20251001', max_tokens: 1500 },
  deep_dive:     { model: 'claude-sonnet-4-6',          max_tokens: 3200  }, // v1.10: 2500->3200, vorsorglich (gleiche Risikoklasse wie morning/eic)
  dark_pool:     { model: 'claude-sonnet-4-6',          max_tokens: 1000  }, // v1.9: 400->1000
  eic:           { model: 'claude-sonnet-4-6',          max_tokens: 3500  }, // v1.9: 2000->3500
};

// ── SYSTEM PROMPT AUSWAHL ─────────────────────────────────────────────────────
function selectSystemPrompt(action, expertMode) {
  switch (action) {
    case 'makro':        return SYSTEM_PROMPTS.makro();
    case 'ki_briefing':  return expertMode
                           ? SYSTEM_PROMPTS.ki_briefing_expert()
                           : SYSTEM_PROMPTS.ki_briefing_public();
    case 'morning':      return expertMode
                           ? SYSTEM_PROMPTS.morning_expert()
                           : SYSTEM_PROMPTS.morning_public();
    case 'oversold':     return SYSTEM_PROMPTS.oversold();
    case 'meta_analysis':return SYSTEM_PROMPTS.meta_analysis();
    case 'deep_dive':    return expertMode
                           ? SYSTEM_PROMPTS.deep_dive_expert()
                           : SYSTEM_PROMPTS.deep_dive_public();
    case 'dark_pool':    return SYSTEM_PROMPTS.dark_pool();
    case 'eic':          return SYSTEM_PROMPTS.eic();
    default:             return null;
  }
}

// ── ANTHROPIC API CALL ────────────────────────────────────────────────────────
async function callAnthropic(apiKey, model, maxTokens, systemPrompt, userMessage) {
  const body = {
    model,
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }],
  };

  // DIAGNOSE (v1.15, 30.08.2026): reine Zeitmessung um den Anthropic-Call,
  // um Verlangsamungen (s. Changelog v1.15) vom Rest der Pipeline zu
  // unterscheiden. Keine Verhaltensänderung.
  const _t0 = Date.now();

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const _durationMs = Date.now() - _t0;
  console.log(`[callAnthropic] model=${model} maxTokens=${maxTokens} durationMs=${_durationMs}`);

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

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/logs' && request.method === 'GET') {
      const adminToken = url.searchParams.get('token');
      if (!env.STATIC_TOKEN || adminToken !== env.STATIC_TOKEN) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
      }
      const kvStatus = {
        AUTH_KV_bound: !!env.AUTH_KV,
        STATIC_TOKEN_bound: !!env.STATIC_TOKEN,
        env_keys: Object.keys(env || {}),
      };
      if (!env.AUTH_KV) {
        return jsonResponse({ error: 'AUTH_KV nicht gebunden', debug: kvStatus }, 500, origin);
      }
      const limit   = parseInt(url.searchParams.get('limit') || '100');
      const filter  = url.searchParams.get('hash') || '';
      const prefix  = filter ? `log:${filter}:` : 'log:';
      const listed  = await env.AUTH_KV.list({ prefix, limit });
      const entries = [];
      for (const key of listed.keys) {
        const val = await env.AUTH_KV.get(key.name);
        if (val) {
          try { entries.push(JSON.parse(val)); } catch(e) {}
        }
      }
      entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

      // NEU (29.08.2026): ?flagged=1 zeigt nur Eintraege mit
      // Compliance-Verstoessen (s. scanForComplianceViolations()) — schnelle
      // Sicht ohne alle Logs manuell zu durchsuchen.
      const flaggedOnly = url.searchParams.get('flagged') === '1';
      const filteredEntries = flaggedOnly
        ? entries.filter(e => e.complianceFlags && e.complianceFlags.length)
        : entries;

      if (url.searchParams.get('rl') === '1') {
        const rl = await rateLimitReport(env);
        return jsonResponse({ count: filteredEntries.length, logs: filteredEntries, rateLimitsToday: rl }, 200, origin);
      }

      return jsonResponse({ count: filteredEntries.length, logs: filteredEntries }, 200, origin);
    }

    if (url.pathname === '/extra-tickers' && request.method === 'GET') {
      const adminToken = url.searchParams.get('token');
      if (!env.STATIC_TOKEN || adminToken !== env.STATIC_TOKEN) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
      }
      return handleListTickers(env, origin);
    }

    if (url.pathname === '/extra-tickers/approve' && request.method === 'POST') {
      const adminToken = url.searchParams.get('token');
      if (!env.STATIC_TOKEN || adminToken !== env.STATIC_TOKEN) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
      }
      return handleApproveTickers(request, env, origin);
    }

    if (url.pathname === '/extra-tickers/reject' && request.method === 'POST') {
      const adminToken = url.searchParams.get('token');
      if (!env.STATIC_TOKEN || adminToken !== env.STATIC_TOKEN) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
      }
      return handleRejectTickers(request, env, origin);
    }

    if (url.pathname === '/extra-ticker' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!env.STATIC_TOKEN || token !== env.STATIC_TOKEN) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin);
      }
      return handleProposeTicker(request, env, origin, token);
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders(origin),
      });
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isOwner    = !!env.OWNER_TOKEN && token === env.OWNER_TOKEN;

    if ((!env.STATIC_TOKEN || token !== env.STATIC_TOKEN) && !isOwner) {
      logRequest(env, token || 'INVALID', 'AUTH_FAIL', origin,
        request.headers.get('CF-Ray') || '', false);
      return jsonResponse({ error: 'Unauthorized' }, 401, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
    }

    const { action, payload, expert_mode: expertModeRequested = false } = body;

    if (!action || !payload) {
      return jsonResponse({ error: 'action und payload erforderlich' }, 400, origin);
    }

    const cfg = ACTION_CONFIG[action];
    if (!cfg) {
      return jsonResponse({ error: `Unbekannte action: ${action}` }, 400, origin);
    }

    // SICHERHEITS-FIX (v1.11, 27.08.2026, Legal-Briefing-Audit Backlog №60):
    // expert_mode war bisher ein reines Client-Flag — jeder Inhaber des
    // geteilten STATIC_TOKEN (also jeder Beta-Tester) konnte sich per
    // clientseitigem EIC-PIN (localStorage) selbst freischalten und damit
    // Axels reale Portfoliodaten (NAV, Positionen) aus den Expert-Prompts
    // einsehen. Da STATIC_TOKEN von allen Beta-Nutzern geteilt wird, kann
    // eine Token-basierte Allowlist einzelne Nutzer nicht unterscheiden —
    // OWNER_TOKEN ist das einzige Merkmal, das Axel persönlich von allen
    // anderen Token-Inhabern trennt. Daher: expert_mode wird jetzt serverseitig
    // hart auf isOwner geprüft und nicht mehr vom Client übernommen. Jede
    // Anfrage mit STATIC_TOKEN bekommt zwingend den Public-Prompt, unabhängig
    // vom gesendeten Flag oder gesetztem PIN.
    if (expertModeRequested && !isOwner) {
      logRequest(env, token, `${action}_EXPERT_DENIED`, origin,
        request.headers.get('CF-Ray') || '', false);
    }
    const expert_mode = expertModeRequested && isOwner;

    // ZUSATZFUND (v1.11, beim Umsetzen von №60 entdeckt): die 'eic'-Action hat
    // KEINEN Public/Expert-Split in selectSystemPrompt() — sie liefert IMMER
    // den vollen persönlichen Investment-Case (Axels reale Portfoliodaten),
    // unabhängig von expert_mode. Im aktuellen Frontend nicht aufgerufen
    // (kein 'eic'-Call-Site in axel-scanner/index.html gefunden), aber über
    // die API mit dem geteilten STATIC_TOKEN weiterhin erreichbar. Gleiche
    // Fundklasse wie oben — daher zusätzlich hart auf isOwner gesperrt.
    if (action === 'eic' && !isOwner) {
      logRequest(env, token, 'eic_EXPERT_DENIED', origin,
        request.headers.get('CF-Ray') || '', false);
      return jsonResponse({ error: 'Diese Funktion ist nur für den Betreiber verfügbar.' }, 403, origin);
    }

    const rawSystemPrompt = selectSystemPrompt(action, expert_mode);
    if (!rawSystemPrompt) {
      return jsonResponse({ error: 'Kein System-Prompt für action' }, 500, origin);
    }
    const todayDE = new Date().toLocaleDateString('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const systemPrompt =
      'HEUTIGES DATUM (Berlin): ' + todayDE +
      ' — Verwende ausschließlich dieses Datum. Nenne NIEMALS ein anderes Datum, ' +
      'es sei denn, es steht explizit in den Nutzerdaten.\n\n' +
      rawSystemPrompt;

    const clientIP    = request.headers.get('CF-Connecting-IP') || 'no-ip';
    const subjectHash = await hashToken(`${token}|${clientIP}`);
    const rl          = isOwner
      ? { allowed: true, used: 0, limit: Infinity }
      : await checkRateLimit(env, subjectHash, action);

    if (!rl.allowed) {
      await logRequest(env, token, `${action}_RATELIMIT`, origin,
        request.headers.get('CF-Ray') || '', false);
      return jsonResponse({
        error:   'rate_limit',
        message: `Tageslimit erreicht (${rl.limit}× ${action}/Tag). Zurücksetzung um 00:00 UTC.`,
        used:    rl.used,
        limit:   rl.limit,
      }, 429, origin);
    }

    try {
      const data = await callAnthropic(
        env.ANTHROPIC_API_KEY,
        cfg.model,
        cfg.max_tokens,
        systemPrompt,
        payload,
      );

      const text = data?.content?.[0]?.text || '';

      // Compliance-Scan nur im Public-Modus (expert_mode ist bewusst
      // direktiv, s. SUITE.md №65/№66) — nicht blockierend, nur geloggt.
      const complianceFlags = expert_mode ? [] : scanForComplianceViolations(text);
      if (complianceFlags.length) {
        console.warn('[COMPLIANCE]', action, complianceFlags.join(', '));
      }

      const cfRay = request.headers.get('CF-Ray') || '';
      await logRequest(env, token, action, origin, cfRay, true, complianceFlags);

      return jsonResponse({ text, model: cfg.model }, 200, origin);

    } catch (e) {
      const status = e.message.startsWith('Anthropic 401') ? 401
                   : e.message.startsWith('Anthropic 429') ? 429
                   : 502;

      const cfRayErr = request.headers.get('CF-Ray') || '';
      await logRequest(env, token, `${action}_ERROR`, origin, cfRayErr, false);

      return jsonResponse({ error: e.message }, status, origin);
    }
  },
};
