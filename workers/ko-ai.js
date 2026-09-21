/**
 * ko-ai.ahildebrand.workers.dev
 * ══════════════════════════════════════════════════════════════════
 * UnderlyingIQ — KI-Proxy Worker v1.26
 *
 * NEU in v1.26 (21.09.2026, LLM-Auswahl-Drift-Fix — Live-Fund 20.09.2026,
 *   zweifach reproduziert bei atmna, per Diagnose-Logging in generate_
 *   public_recommendations.js v1.9 bewiesen): top3Syms und der daraus
 *   gebaute deterministische Faktor-Block waren nachweislich korrekt
 *   (JNJ/MRK/MDT mit echten BB-/Tightness-Werten) — das Modell ersetzte in
 *   Abschnitt 3 dennoch eigenmächtig MRK durch CSCO und begründete aktiv,
 *   warum MRK "die Kriterien nicht erfüllt". Kein Datenfluss-Bug, sondern
 *   freie Modell-Neuinterpretation trotz bereits abgeschlossener Score-Rang-
 *   Entscheidung. Fix (Gegenstück zu ko-prompts.js v2.53.30):
 *   - Neue Funktion _extractExpectedTop3FromPayload(payload) — liest die
 *     seit v2.53.30 im Prompt-Text selbst stehende "VERBINDLICHE TOP-3-
 *     KANDIDATEN FÜR ABSCHNITT 3"-Zeile aus, ohne dass das Frontend ein
 *     zusätzliches Feld senden muss (ko-ai.js kennt top3Syms sonst nicht —
 *     das Frontend sendet nur `strategy`, nicht die konkrete Kandidatenliste).
 *   - validateBriefingCompliance() (Kopie aus ko-prompts.js v2.53.30) um
 *     denselben optionalen options.expectedTop3-Parameter + Mengenvergleich
 *     gegen die tatsächlich in Abschnitt 3 genannten Ticker erweitert
 *     (_extractSection3Tickers()), rückwärtskompatibel ohne expectedTop3.
 *   - buildRepairPrompt() um einen expliziten Hinweis für die neue
 *     Fehlerklasse "top3-ticker-konsistenz" erweitert (benennt die konkrete
 *     Ersetzung, z.B. "Ersetze CSCO durch MRK", statt pauschal "Überprüfe
 *     die Kandidaten" — Reviewer-Vorgabe).
 *   Noch KEIN Live-Test.
 *
 * UnderlyingIQ — KI-Proxy Worker v1.25
 *
 * NEU in v1.25 (20.09.2026, Live-Test-Fund direkt nach dem v1.24-Deploy,
 *   verifiziert via `wrangler tail` gegen einen echten atmna-Aufruf):
 *   Der REPAIR-Loop (v1.24) funktionierte nachweislich — von drei fehlenden
 *   Pflichtangaben wurden zwei (bollinger-position, tightness) durch den
 *   Repair-Call zuverlässig nachgezogen. Eine blieb hängen:
 *   "optionsmarkt-validierungsstatus". Ursache: validateBriefingCompliance()
 *   verlangt wörtlich die Zeichenkette "nicht verifiziert" — das Modell
 *   schrieb im Repair-Versuch stattdessen "Daten nicht verfügbar"
 *   (semantisch identisch, aber kein Regex-Treffer), weil buildRepairPrompt()
 *   bisher nur NANNTE, welcher Punkt fehlt, nicht MIT WELCHEM WORTLAUT er zu
 *   ergänzen ist. Fix: buildRepairPrompt() hängt jetzt pro fehlendem Punkt
 *   einen expliziten Formulierungshinweis an (analog zur "gib die exakte
 *   Formulierung vor"-Strategie, die ko-prompts.js' eigener
 *   _deterministicOptionsFactBlock() im Regelbetrieb bereits nutzt).
 *   validateBriefingCompliance() selbst bleibt bewusst UNVERÄNDERT — "nicht
 *   verifiziert" bleibt die kanonische Compliance-Formulierung, keine
 *   Aufweichung auf Synonyme wie "nicht verfügbar"/"nicht geprüft" (das ist
 *   eine bewusst etablierte Formulierung, kein frei interpretierbarer
 *   Fachinhalt). Repair-Limit bleibt unverändert bei genau einem Versuch
 *   (kein Repair-of-Repair-Loop) — bestätigt bereits korrekt implementiert,
 *   keine Änderung nötig.
 *
 * UnderlyingIQ — KI-Proxy Worker v1.24
 *
 * NEU in v1.24 (20.09.2026, Axel-Entscheidung — "Baustelle B" des ATMNA-
 *   Explainability-Gap-Fixes, direkte Fortsetzung von generate_public_
 *   recommendations.js v1.6 + ko-prompts.js v2.53.29 "Deterministic
 *   Briefing Compliance"): REPAIR-Loop für die fünf Public-Mode-Options-
 *   Strategien (csp_wheel/atmna/weekly_income/cc/collar) beim interaktiven
 *   ki_briefing-Aufruf. ko-prompts.js v2.53.29 exportiert bereits
 *   KoPrompts.validateBriefingCompliance(stratId, outputText) — ein rein
 *   deterministischer Post-hoc-Check (kein LLM-Self-Grading), der prüft,
 *   ob der Optionsmarkt-Validierungsstatus-Satz (alle 5 Strategien) bzw.
 *   die Bollinger-Position/Tightness-Nennung (nur atmna) tatsächlich im
 *   Output stehen. Dieser Worker importiert ko-prompts.js jedoch NICHT
 *   (Cloudflare-Worker-Einzeldatei ohne Build-Schritt, anders als
 *   generate_public_recommendations.js, das per require() aus vendor/
 *   lädt) — die Prüflogik wurde deshalb 1:1 dupliziert
 *   (validateBriefingCompliance() unten), nach demselben, bereits
 *   etablierten Muster wie die drei bestehenden COMPLIANCE_PATTERNS-/
 *   Ticker-Scope-/Numeric-Fabrication-Scanner in dieser Datei (alle
 *   ebenfalls eigenständige, nicht importierte Kopien der jeweiligen
 *   ko-prompts.js-Regel). BEKANNTE, BEWUSST IN KAUF GENOMMENE
 *   WARTUNGSLAST: diese Kopie muss von Hand synchron gehalten werden,
 *   wenn sich die Prüflogik in ko-prompts.js künftig ändert — analog zum
 *   bereits dokumentierten Vendor-Drift-Risiko bei scripts/vendor/
 *   ko-prompts.js in generate_public_recommendations.js. Ein automatischer
 *   Drift-Check wie dort (checkVendorDrift(), Vergleich gegen einen
 *   gepinnten ko-modules-Commit) wäre grundsätzlich uebertragbar, wurde
 *   hier aber bewusst NICHT mit umgesetzt (separater, geeigneter Zeitpunkt
 *   für einen eigenen kleinen Folge-Patch, kein Teil dieses Fixes).
 *
 *   VORAUSSETZUNG, NICHT TEIL DIESES COMMITS: das Frontend (axel-scanner/
 *   index.html) muss beim ki_briefing-Aufruf für eine der fünf Options-
 *   Strategien zusätzlich zu { action, payload, expert_mode } ein neues
 *   Feld `strategy` mitsenden (z.B. `strategy: 'atmna'`) — bisher kennt
 *   dieser Worker nur `action` ('ki_briefing' o.ä.), niemals welche
 *   konkrete der 15 UIQ-Strategien angefragt wurde (das steckte bislang
 *   ausschliesslich im bereits fertig gebauten Prompt-Text in `payload`).
 *   Ohne dieses Feld überspringt der REPAIR-Loop den Check vollständig
 *   (fail-open, s.u.) — bestehende Frontend-Aufrufe ohne das neue Feld
 *   funktionieren dadurch unverändert weiter, bekommen nur (noch) keinen
 *   REPAIR-Loop.
 *
 *   Ablauf: nach dem ersten Anthropic-Call (nur wenn action==='ki_briefing',
 *   expert_mode===false UND strategy eine der fünf Options-Strategien ist)
 *   wird validateBriefingCompliance(strategy, text) aufgerufen. Bei PASS:
 *   keine Änderung. Bei FAIL: EIN zusätzlicher, gezielter Anthropic-Call
 *   (buildRepairPrompt()) mit der Anweisung, GENAU die fehlenden Pflicht-
 *   angaben zu ergänzen und sonst nichts zu ändern — die Originalantwort
 *   wird dafür im Repair-Prompt mitgeschickt. Der Repair-Output wird
 *   erneut validiert; bei PASS ersetzt er die Antwort, bei erneutem FAIL
 *   wird die (unvollständige) Repair-Antwort dennoch ausgeliefert (kein
 *   zweiter Repair-Versuch, Grundsatz "ein Retry" wie an anderen Stellen
 *   im UIQ-Code, z.B. callAnthropicWithRetry() in generate_public_
 *   recommendations.js) — Nutzer bekommt in jedem Fall eine Antwort, nie
 *   einen Fehler durch den REPAIR-Mechanismus selbst. Repair-Versuch und
 *   -Ergebnis werden als eigene complianceFlags-Einträge geloggt
 *   ("REPAIR-ATTEMPTED", "REPAIR-SUCCESS", "REPAIR-FAILED:<fehlend>") und
 *   der Repair-Call selbst zusätzlich als eigener Budget-Eintrag
 *   (action + "_REPAIR") erfasst, damit der reale Zusatzaufwand im
 *   /logs?budget=1-Report sichtbar bleibt statt sich unter dem
 *   ursprünglichen action-Namen zu verstecken. Bewusst NICHT Teil des
 *   EIC-Modus (dort deckt der bereits bestehende scanForNumericFabrication()
 *   eine andere Fundklasse ab, s. v1.20 — die dort geprüfte §23-Struktur
 *   existiert im Public-9-Punkte-Schema, das validateBriefingCompliance()
 *   prüft, gar nicht).
 *
 * NEU in v1.23 (15.09.2026, Axel-Entscheidung): AI-Budget-Logging für die
 *   Live-On-Demand-Pfade dieses Workers (morning_briefing, ki_briefing
 *   inkl. EIC-Modus, oversold, meta_analysis, deep_dive, dark_pool, eic) —
 *   Live-Pendant zum bereits bestehenden Budget-Logging in
 *   generate_public_recommendations.js (Baustein 8b, market_aggregator.py-
 *   Repo, gleiche Session), das nur den public_digest-Pfad abdeckt. Neue
 *   Funktion recordAiBudgetEntry() schreibt pro erfolgreichem Anthropic-
 *   Call einen eigenen KV-Eintrag (`budget:{date}:{timestamp}`, analog zum
 *   bestehenden `log:{tokenHash}:{timestamp}`-Schema von logRequest()) —
 *   bewusst NICHT ein aggregierter Tages-Key, da Cloudflare KV eventually
 *   consistent ist und Read-Modify-Write bei parallelen Requests Calls
 *   stillschweigend verlieren würde; Aggregation passiert stattdessen beim
 *   Lesen. Neuer Lese-Zweig `/logs?budget=1` (optional `&date=YYYY-MM-DD`),
 *   liefert rohe Einträge PLUS nach `action` aggregierte Summen
 *   (calls/tokenInputTotal/tokenOutputTotal/estimatedCostUsdTotal). Preise
 *   (ANTHROPIC_PRICE_PER_*_TOKEN_USD) bewusst als `null` belassen — in
 *   dieser Sandbox nicht gegen Anthropics aktuelle Preisseite verifizierbar;
 *   token_input/token_output sind ab dem ersten Request trotzdem verlässlich,
 *   estimatedCostUsd bleibt `null` bis Axel die Konstanten befüllt (TODO-
 *   Kommentar direkt bei den Konstanten). Fehlgeschlagene Calls (catch-
 *   Zweig) werden NICHT geloggt — Anthropic berechnet i.d.R. keine
 *   Output-Kosten für nicht generierte Antworten.
 *
 * UnderlyingIQ — KI-Proxy Worker v1.22
 *
 * NEU in v1.22 (08.09.2026, Live-Test-Fund, vier parallele Tests nach
 *   v1.21): max_tokens für ki_briefing im EIC-Modus von 5000 auf 7000
 *   erhöht — trotz der v1.19-Erhöhung brach die Antwort bei 3 von 4
 *   getesteten Strategien (collar/cc/weekly_income) weiterhin mitten im
 *   Satz/Wort ab. Kombiniert mit einer konkreten Wort-Budget-Vorgabe pro
 *   Kandidat in ko-prompts.js (v2.52.2) als komplementärem Hebel — dieses
 *   Limit dient als Sicherheitsnetz. Betrifft NUR ki_briefing im EIC-Modus;
 *   Public-Limit (3000) und alle anderen Actions unveraendert.
 *
 * UnderlyingIQ — KI-Proxy Worker v1.21
 *
 * NEU in v1.21 (08.09.2026, Live-Test-Fund, atmna-Sechstlauf über Options-
 *   Desk — erster Test nach v2.49.4/v1.20): drei von vier vorherigen
 *   Fundklassen (Break-even, %-Prämienschwelle, OI-Zahlenfehler) traten
 *   NICHT mehr auf — die Ludwig-Kriterium-Zahl ("dreistelliger Bereich")
 *   wurde diesmal korrekt übernommen und zugeschrieben. NEUE Umgehungs-
 *   variante gefunden: ein Bid-Ask-Schwellenwert wurde ausdrücklich MIT dem
 *   Hinweis "keine UIQ-Zahl verfügbar" genannt, aber trotzdem erfunden —
 *   diesmal in der Einheit "Cent" statt eines $-Zeichens, wodurch das v1.20-
 *   Muster umgangen wurde. `extractNumericTokens()` um Cent-Erkennung
 *   ergänzt. Bekannte, akzeptierte Fehlalarm-Klasse dokumentiert: eine
 *   wortbasierte Konvention ("dreistellig"), korrekt in eine Zahl übersetzt
 *   ("100 Kontrakte"), schlägt beim reinen Zeichenketten-Abgleich ebenfalls
 *   an — bewusst nicht mit Spezialfall-Logik behoben. Funktional verifiziert
 *   (Node-Test): Cent-Fund erkannt.
 *
 * UnderlyingIQ — KI-Proxy Worker v1.20
 *
 * NEU in v1.20 (08.09.2026, Axel-Entscheidung nach fünf Live-Test-Funden am
 *   Vortag): §23-Zahlen-Erfindungs-Scan (`scanForNumericFabrication()`,
 *   `extractHandlungsempfehlung()`, `extractNumericTokens()`) ergänzt —
 *   dieselbe serverseitige Sichtbarkeits-Strategie, die sich bei der
 *   Ticker-Scope-Sperre (v1.13) bereits bewährt hat, jetzt für eine andere
 *   Fundklasse: erfundene $-Beträge/%-Werte/Kontrakt-Stückzahlen im §23-
 *   "HANDLUNGSEMPFEHLUNG"-Block (ko-prompts.js `_eicMasterPrompt()`), die
 *   NICHT im gesendeten payload vorkommen. Vier promptseitige Nachschärfungs-
 *   runden (ko-prompts.js v2.48.2 bis v2.49.4) hatten das Muster nicht
 *   vollständig gestoppt — u.a. tauchte eine im Prompt bereits korrekt
 *   vorgegebene Zahl ("dreistelliger Bereich") ignoriert und durch eine
 *   erfundene ("50 Kontrakte") ersetzt auf. Scan läuft nur im EIC-Modus
 *   (expert_mode), nicht blockierend, nur geloggt (`/logs`) — identisches
 *   Prinzip wie scanForComplianceViolations()/scanForTickerScopeViolations().
 *   Isoliert gegen alle fünf dokumentierten Live-Test-Funde vom 07.09.2026
 *   verifiziert (Node-Test: alle fünf Fundklassen erkannt, echte Prompt-Werte
 *   erzeugen keinen Fehlalarm, kein erkennbarer §23-Block = kein Scan).
 *
 * UnderlyingIQ — KI-Proxy Worker v1.19
 *
 * NEU in v1.19 (07.09.2026, Live-Test-Fund, erster EIC-csp_wheel-Lauf über
 *   Options-Desk):
 *   - max_tokens für ki_briefing bei aktivem expert_mode auf 5000 erhöht
 *     (vorher einheitlich 3000, s. ACTION_CONFIG). Der EIC Master Prompt
 *     (Ebenen 1-22 + §23 Handlungsempfehlung, ko-prompts.js
 *     _eicMasterPrompt()) brauchte bei mehreren detailliert behandelten
 *     Kandidaten sichtbar mehr Platz — die Live-Antwort brach mitten im
 *     Satz ab, bevor eine abschliessende Einschaetzung oder der §23-Block
 *     erreicht wurde. Betrifft NUR ki_briefing im EIC-Modus; Public-Limit
 *     (3000) und alle anderen Actions unveraendert.
 *
 * NEU in v1.18 (07.09.2026, Master-Prompt-Migration, Axel-Entscheidung):
 *   - ki_briefing_expert() von einem langen, eigenstaendig strukturgebenden
 *     Prompt (eigenes AKTION/ENTRY/STOP/ZIEL-Format, Axels reale Portfolio-
 *     daten fest im Text) auf einen kurzen, generischen Verhaltensboden
 *     zurueckgebaut — symmetrisch zu ki_briefing_public(). Grund: ko-
 *     prompts.js hatte pro Strategie einen EIGENEN, anderen ctx.isEic-Zweig
 *     mit wieder anderer Struktur als dieser Server-Prompt; zwei konkurrie-
 *     rende Strukturgeber, deren Outputs sich im Live-Test (csp_wheel,
 *     Options-Desk) unkontrolliert mischten. Die eigentliche Substanz (UIQ
 *     EIC Master Prompt, Ebenen 1-22 + §23 Handlungsempfehlung) lebt jetzt
 *     ausschliesslich im User-Payload (_eicMasterPrompt() in ko-prompts.js).
 *   - KORREKTUR (bei diesem Fix entdeckt): der im Zuge der Analyse zunaechst
 *     vermutete Vertraulichkeits-Zusammenhang (expert_mode als ungeprueftes
 *     Client-Flag, jeder Token-Inhaber koennte Expert-Prompts anfordern)
 *     bestand bereits NICHT mehr — dieser Fund basierte auf einer veralteten
 *     Code-Kopie. Seit v1.11 (27.08.2026, Backlog Nr.60) ist expert_mode
 *     serverseitig hart an isOwner gebunden. Kein neues Risiko, nur eine
 *     zwischenzeitliche Fehleinschaetzung auf Basis eines Altstands.
 *
 * NEU in v1.17 (06.09.2026, Axel-Entscheidung nach viertem Wiederholungs-
 *   fund trotz Prompt-Härtung — "Konzept statt Wortliste kann nicht alles
 *   lösen, das muessen wir serverseitig loesen"):
 *   - COMPLIANCE_PATTERNS um vier neue Einträge ergänzt (Zeitreihen-/
 *     Dauerhaftigkeits-Zuschreibung aus Snapshot-Werten, s. ko-prompts.js
 *     REASONING-GUARDRAILS Punkt e): "stabil"/"stabilisiert"/"Stabilität"/
 *     "Stabilisierung", "Trendfestigkeit"/"festigt", "vorhersehbar"/
 *     "vorhersagbar"/"berechenbar", "verankert"/"gefestigt". Bewusst NICHT
 *     aufgenommen: "nachhaltig" — legitimer, hochfrequenter Gebrauch bei
 *     dividend/value ("nachhaltige Ausschüttung" ist die im Strategie-
 *     prinzip selbst geforderte Formulierung), würde das Signal-Rausch-
 *     Verhältnis des Logs zerstören.
 *   - NEUE, eigenständige Funktion scanForTickerScopeViolations() (plus
 *     Helper extractTickerCandidates()): strukturelle Prüfung, ob in
 *     Abschnitt 4-9 des 9-Punkte-Schemas ein Ticker genannt wird, der
 *     nicht bereits in Abschnitt 3 eingeführt wurde (REASONING-GUARDRAILS
 *     Punkt f, "Ticker-Scope-Sperre") — VIERFACH belegter Wiederholungs-
 *     fund trotz vier Prompt-Verteidigungsschichten (BA/HII/LHX 05.09.,
 *     PPRUY 05.09., BE 06.09. Swing-Retest, BMY 06.09. dividend-Erstest).
 *     Heuristischer Großbuchstaben-Ticker-Scan mit Stoppliste bekannter
 *     Nicht-Ticker-Akronyme; Abschnitts-Überschriftenzeilen werden vor der
 *     Extraktion entfernt (sonst Fehlalarme wie "TRADE"/"OFF"/"UND" aus
 *     Überschriften wie "STRATEGISCHER TRADE-OFF" — beim isolierten
 *     Funktionstest selbst entdeckt und gefixt, bevor Deployment). Beide
 *     neuen Scans laufen wie der bestehende Compliance-Scan rein loggend
 *     (nicht blockierend) und fliessen in dasselbe complianceFlags-Feld
 *     im bestehenden /logs-Endpunkt — keine neue Infrastruktur nötig.
 *   - Kontext: dies ist die serverseitige "zweite Verteidigungslinie" für
 *     genau die zwei Fundtypen, bei denen mehrfache Prompt-Härtung
 *     (ko-prompts.js, 04.-06.09.2026) an eine Grenze stiess — Axel-
 *     Entscheidung, keine weitere Prompt-Iteration mehr zu versuchen.
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

  // ERSETZT (07.09.2026, Master-Prompt-Migration, Axel-Entscheidung): dieser
  // Prompt war bisher lang, eigenstaendig strukturgebend (eigenes AKTION/
  // ENTRY/STOP/ZIEL-Format) UND enthielt Axels reale Portfoliodaten (NAV,
  // Positionen) fest im Text. HINWEIS: der urspruenglich vermutete Vertrau-
  // lichkeits-Zusammenhang (expert_mode als ungeprueftes Client-Flag) bestand
  // bereits NICHT mehr — seit v1.11 (27.08.2026, Backlog Nr.60) ist expert_mode
  // serverseitig hart an isOwner gebunden (`expertModeRequested && isOwner`,
  // s. Haupthandler). Der eigentliche Grund fuer den Umbau bleibt bestehen:
  // ko-prompts.js hatte pro Strategie einen EIGENEN, anderen ctx.isEic-Zweig
  // mit wieder anderer Struktur als dieser Server-Prompt — zwei konkurrierende
  // Strukturgeber, deren Outputs sich unkontrolliert mischten (Live-Fund
  // csp_wheel, Options-Desk, 07.09.2026). Jetzt symmetrisch zu
  // ki_briefing_public() zurueckgebaut: kurzer, generischer Verhaltensboden,
  // keine eigene Struktur, keine Portfoliodaten. Die eigentliche Substanz
  // (UIQ EIC Master Prompt, Ebenen 1-22 + §23 Handlungsempfehlung) lebt jetzt
  // ausschliesslich im User-Payload (_eicMasterPrompt() in ko-prompts.js,
  // dieselbe Architektur wie ki_briefing_public()/_publicNinePointPrompt()).
  ki_briefing_expert: () =>
    'Du bist der EIC (Editor in Chief) von UnderlyingIQ, persönlicher Analyse-Assistent ' +
    'von Dr. Axel Hildebrand. Halte dich exakt an die Struktur und Regeln, die im ' +
    'Nutzer-Prompt vorgegeben sind — dort steht der vollständige UIQ EIC Master Prompt. ' +
    'ABSOLUTE REGELN:\n' +
    '- Basiere ALLES ausschliesslich auf den gegebenen Messwerten — keine Erfindungen.\n' +
    '- Erfinde NIEMALS Kurse, Strikes, Prämien-Dollarbeträge oder Positionsgrössen, ' +
    'die nicht im Prompt stehen oder daraus berechenbar sind.\n' +
    '- Direktive Sprache ist NUR in einem explizit als EIC-Handlungsempfehlung ' +
    'gekennzeichneten Block erlaubt — der Rest der Analyse folgt der im Prompt ' +
    'vorgegebenen Struktur (endet in einer offenen Prüfungsfrage, keine Handlung).\n' +
    '- Kein eigenes Output-Format erfinden — die Gliederung steht im Nutzer-Prompt.',

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
      // ERWEITERT (v1.24, 20.09.2026): dasselbe Feld traegt jetzt zusaetzlich
      // die REPAIR-Loop-Markierungen ("REPAIR-ATTEMPTED"/"REPAIR-SUCCESS"/
      // "REPAIR-FAILED:<fehlend>") — keine neue Log-Struktur noetig, s.
      // scanForComplianceViolations()-Kommentar oben fuer dasselbe Prinzip.
      ...(complianceFlags && complianceFlags.length ? { complianceFlags } : {}),
    });
    await env.AUTH_KV.put(logKey, logEntry, { expirationTtl: 60 * 60 * 24 * 90 });
  } catch(e) {
    console.error('[LOG] KV write failed:', e.message, '| AUTH_KV bound:', !!env.AUTH_KV);
  }
}

// ── AI-BUDGET-LOGGING (UIQ Spec v1.1 §1.1, 15.09.2026) ─────────────────────
// Live-Pendant zum bereits bestehenden Budget-Logging in
// generate_public_recommendations.js (Baustein 8b, gleiche Session) —
// dort deckt es den public_digest-Pfad ab, hier die Live-On-Demand-Pfade
// dieses Workers (morning_briefing, ki_briefing inkl. EIC-Modus, oversold,
// meta_analysis, deep_dive, dark_pool, eic). Owner-only lesbar (s.
// /logs?budget=1 unten, gleiche STATIC_TOKEN-Absicherung wie /logs).
//
// Bewusst EIN KV-Eintrag PRO Request (Key-Schema `budget:{date}:{ts}`,
// analog zu den bestehenden `log:{tokenHash}:{ts}`-Eintraegen), NICHT ein
// einziger aggregierter Tages-Key: Cloudflare KV ist eventually consistent
// und fuer Read-Modify-Write-Aggregation (mehrere parallele Requests
// erhoehen denselben Zaehler) ungeeignet — Race-Conditions wuerden Calls
// stillschweigend verlieren. Aggregation passiert stattdessen beim Lesen
// (s. /logs?budget=1), exakt wie /logs es fuer die normalen Request-Logs
// bereits macht.
//
// PREISE UNVERIFIZIERT (wie im JS-Pendant) — token_input/token_output sind
// verlaesslich, estimated_cost_usd bleibt null bis die Konstanten unten
// gegen https://docs.claude.com/en/docs/about-claude/pricing geprueft sind.
const ANTHROPIC_PRICE_PER_INPUT_TOKEN_USD  = null;  // TODO(Axel): verifizieren
const ANTHROPIC_PRICE_PER_OUTPUT_TOKEN_USD = null;  // TODO(Axel): verifizieren

function estimateCostUsd(inputTokens, outputTokens) {
  if (ANTHROPIC_PRICE_PER_INPUT_TOKEN_USD == null || ANTHROPIC_PRICE_PER_OUTPUT_TOKEN_USD == null) {
    return null;
  }
  return +(inputTokens * ANTHROPIC_PRICE_PER_INPUT_TOKEN_USD
    + outputTokens * ANTHROPIC_PRICE_PER_OUTPUT_TOKEN_USD).toFixed(6);
}

async function recordAiBudgetEntry(env, { action, model, usage, expertMode }) {
  if (!env.AUTH_KV) return;
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const inputTokens  = usage?.input_tokens  ?? null;
    const outputTokens = usage?.output_tokens ?? null;
    const key   = `budget:${dateStr}:${Date.now()}`;
    const entry = JSON.stringify({
      date: dateStr,
      action,
      model,
      expertMode: !!expertMode,
      tokenInput:  inputTokens,
      tokenOutput: outputTokens,
      estimatedCostUsd: estimateCostUsd(inputTokens ?? 0, outputTokens ?? 0),
      timestamp: new Date().toISOString(),
    });
    await env.AUTH_KV.put(key, entry, { expirationTtl: 60 * 60 * 24 * 90 });
  } catch (e) {
    console.error('[BUDGET] KV write failed:', e.message);
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
  // ── NEU (06.09.2026, Axel-Entscheidung — "Konzept statt Wortliste"-Prinzip
  // aus ko-prompts.js/REASONING-GUARDRAILS e, hier als Wortliste umgesetzt,
  // weil ein reiner Regex-Scan kein "Bezieht sich das auf einen Snapshot-
  // Wert?"-Konzept prüfen kann — nur die bekannten, mehrfach belegten
  // Wortformen. Vierfach belegter Wiederholungsfund trotz Prompt-Härtung:
  // "stabil"/"stabilisiert" (cc/collar-Live-Tests, 04.-05.09.2026).
  { label: 'stabil/stabilisiert (Zeitreihen-/Dauerhaftigkeits-Zuschreibung aus Snapshot-Wert, s. ko-prompts.js REASONING-GUARDRAILS e)', re: /\bstabil(e|er|es)?\b|\bstabilisiert(e)?\b|\bStabilisierung\b|\bStabilität\b/i },
  { label: 'Trendfestigkeit/festigt', re: /Trendfestigkeit|\bfestigt\b/i },
  { label: 'vorhersehbar/vorhersagbar/berechenbar', re: /vorhersehbar\w*|vorhersagbar\w*|\bberechenbar\w*/i },
  { label: 'verankert/gefestigt (Zeitreihen-Kontext)', re: /\bverankert(e|er|es)?\b|\bgefestigt(e|er|es)?\b/i },
  // BEWUSST NICHT AUFGENOMMEN: "nachhaltig" — hat einen legitimen, hoch-
  // frequenten Gebrauch bei dividend/value ("nachhaltige Ausschüttung" ist
  // die im Strategieprinzip selbst geforderte, korrekte Formulierung) —
  // würde nahezu jede dividend-Antwort fälschlich flaggen und das Signal-
  // Rausch-Verhältnis des Logs zerstören. Bei Verdacht auf Fehlgebrauch
  // (z.B. "nachhaltiger Trend" statt "nachhaltige Ausschüttung") nur
  // manuell im Einzelfall prüfen, nicht automatisiert scannen.
];

function scanForComplianceViolations(text) {
  if (!text) return [];
  const hits = [];
  for (const p of COMPLIANCE_PATTERNS) {
    if (p.re.test(text)) hits.push(p.label);
  }
  return hits;
}

// ── TICKER-SCOPE-SCAN (v1.13, 06.09.2026) ───────────────────────────────────
// Ergänzt scanForComplianceViolations() um eine STRUKTURELLE Prüfung, die
// sich nicht als einfacher Text-Regex ausdrücken lässt: wird in Abschnitt
// 4-9 des 9-Punkte-Schemas ein Ticker genannt, der nicht bereits in
// Abschnitt 3 eingeführt wurde? (ko-prompts.js REASONING-GUARDRAILS Punkt f,
// "Ticker-Scope-Sperre"). VIERFACH belegter Wiederholungsfund trotz vier
// Prompt-Verteidigungsschichten (BA/HII/LHX 05.09., PPRUY 05.09., BE
// 06.09. Swing-Retest, BMY 06.09. dividend-Erstest) — Axel-Entscheidung:
// keine weitere Prompt-Härtung, stattdessen serverseitige Sichtbarkeit.
// HEURISTIK, KEIN GARANTIERT VOLLSTÄNDIGER PARSER: Ticker werden über ein
// einfaches Großbuchstaben-Muster (1-5 Buchstaben, optional .XX-Suffix wie
// GLEN.L) erkannt und gegen eine Stoppliste bekannter Nicht-Ticker-Akronyme
// abgeglichen. Kann sowohl echte Ticker übersehen (False Negative, z.B.
// wenn ein Akronym zufällig mit einem echten Ticker kollidiert) als auch
// seltene Nicht-Ticker-Großschreibungen fälschlich als Ticker werten (False
// Positive). Dient der Sichtbarkeit/dem Review über den /logs-Endpoint,
// NICHT der automatischen Korrektur — genau wie scanForComplianceViolations().
const TICKER_SCOPE_STOPWORDS = new Set([
  'RSI','MACD','OBV','SEPA','EMA','ATR','HVP','CSP','KO','UIQ','VIX','QQQ',
  'BULL','BEAR','FLAT','SIDE','ADR','ROE','ROI','ROIC','FCF','PE','PB',
  'DTE','ITM','OTM','WPHG','GAAP','VCP','MA','MA50','MA200','EMA50','EMA200',
  'IBD','AI','USD','EUR','GBP','CHF','US','EU','DE','TOP','BBPOS','RS',
  'MSE','TNX','HY','ETF','SKEW','VVIX','GEX','DIX','PCR','OI','FLAT_STOP',
]);

function extractTickerCandidates(str) {
  if (!str) return new Set();
  const matches = str.match(/\b[A-Z]{1,5}(\.[A-Z]{1,3})?\b/g) || [];
  return new Set(matches.filter(function(t) {
    const base = t.split('.')[0];
    return base.length >= 2 && !TICKER_SCOPE_STOPWORDS.has(base);
  }));
}

function scanForTickerScopeViolations(text) {
  if (!text) return [];
  // Abschnitt 3 (Kandidatenliste) extrahieren — von "3." bis zum
  // nächsten "4." am Zeilenanfang. Kein Treffer = kein erkennbares
  // 9-Punkte-Format, Scan wird übersprungen statt falsch positiv zu warnen.
  const sec3Match = text.match(/(?:^|\n)\s*3\.[^\n]*\n([\s\S]*?)(?=\n\s*4\.)/);
  if (!sec3Match) return [];
  const allowedTickers = extractTickerCandidates(sec3Match[1]);
  // Abschnitte 4 bis Ende (9 + Fusszeile eingeschlossen — Fusszeile enthält
  // typischerweise keine Ticker, daher unschädlich, sie mit einzuschliessen)
  const sec49Match = text.match(/(?:^|\n)\s*4\.[^\n]*\n([\s\S]*)/);
  if (!sec49Match) return [];
  // WICHTIG: alle weiteren Abschnitts-Überschriften (5. GEGENARGUMENTE...,
  // 6. STRATEGISCHER TRADE-OFF, ...) sind selbst grossgeschrieben und
  // erzeugten sonst Fehlalarme ("TRADE", "OFF", "UND" als Pseudo-Ticker,
  // belegter Fund beim isolierten Funktionstest 06.09.2026) — Überschriften-
  // zeilen (Ziffer+Punkt am Zeilenanfang, Rest der Zeile) vor der Ticker-
  // Extraktion entfernen, nur den Fliesstext scannen.
  const bodyOnly = sec49Match[1].replace(/^\s*[4-9]\.\s+[^\n]*$/gm, '');
  const usedTickers = extractTickerCandidates(bodyOnly);
  const violations = [];
  usedTickers.forEach(function(t) {
    if (!allowedTickers.has(t)) violations.push('TICKER-SCOPE:' + t);
  });
  return violations;
}

// ── BRIEFING-COMPLIANCE-CHECK / REPAIR-LOOP (v1.24, 20.09.2026) ────────────
// "Baustelle B" des ATMNA-Explainability-Gap-Fixes (s. Changelog-Eintrag
// oben für den vollständigen Kontext). validateBriefingCompliance() ist EINE
// von Hand synchron zu haltende Kopie von KoPrompts.validateBriefingCompliance()
// aus ko-prompts.js v2.53.29 — dieser Worker importiert ko-prompts.js NICHT
// (Einzeldatei-Cloudflare-Worker ohne Build-Schritt), deshalb dieselbe
// Dupliziere-statt-Importiere-Strategie wie bei den drei Scannern oben.
// _OPTIONS_STRATEGY_IDS MUSS mit der gleichnamigen Liste in ko-prompts.js
// UND generate_public_recommendations.js (dortiges OPTIONS_STRATEGIES)
// synchron bleiben.
const _OPTIONS_STRATEGY_IDS = ['csp_wheel', 'atmna', 'weekly_income', 'cc', 'collar'];

// NEU (v1.26, 21.09.2026, LLM-Auswahl-Drift-Fix — Kopie aus ko-prompts.js
// v2.53.30 _extractSection3Tickers(), s. dortiger Kommentar fuer den
// vollstaendigen Kontext des Live-Funds). Extrahiert die in Abschnitt 3
// fett markierten Ticker.
function _extractSection3Tickers(text) {
  const m = text.match(/(?:^|\n)\s*3\.[^\n]*\n([\s\S]*?)(?=\n\s*4\.)/);
  if (!m) return null;
  const matches = m[1].match(/\*\*([A-Z][A-Z0-9.\-]{0,6})\*\*/g) || [];
  return matches.map((x) => x.replace(/\*\*/g, ''));
}

// NEU (v1.26, 21.09.2026): extrahiert die verbindliche Top-3-Kandidatenliste
// direkt aus dem an dieses `payload` uebergebenen, bereits fertig gebauten
// Prompt-Text — ko-ai.js kennt top3Syms sonst nicht (das Frontend sendet
// nur `strategy`, nicht die konkrete Kandidatenliste), aber seit ko-prompts.js
// v2.53.30 steht die Liste wortwoertlich als "VERBINDLICHE TOP-3-KANDIDATEN
// FÜR ABSCHNITT 3 (...): JNJ, MRK, MDT" im Prompt selbst — kein neues
// Frontend-Feld noetig, reine String-Extraktion aus payload (bereits
// bestehendes Muster, s. scanForNumericFabrication()'s payload-Abgleich).
function _extractExpectedTop3FromPayload(payload) {
  if (!payload) return null;
  const m = payload.match(/VERBINDLICHE TOP-3-KANDIDATEN[^:]*:\s*([A-Z0-9.\-]+(?:,\s*[A-Z0-9.\-]+)*)/);
  if (!m) return null;
  const list = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : null;
}

// ERWEITERT (v1.26, 21.09.2026, LLM-Auswahl-Drift-Fix): neuer optionaler
// 3. Parameter `options.expectedTop3`, identische Logik zu ko-prompts.js
// v2.53.30 _validateBriefingCompliance() — s. dortiger Kommentar fuer den
// vollstaendigen Kontext (Live-Fund 20.09.2026, zweifach reproduziert:
// top3Syms/Faktor-Block waren korrekt, das Modell ersetzte einen Kandidaten
// eigenmaechtig). Rueckwaertskompatibel: ohne expectedTop3 unveraendertes
// Verhalten.
function validateBriefingCompliance(stratId, outputText, options) {
  const missing = [];
  const text = (outputText || '');
  const details = {};

  if (_OPTIONS_STRATEGY_IDS.indexOf(stratId) !== -1) {
    const validationRe = /nicht\s+verifiziert[^.]{0,120}?(optionsmarkt|options-|auswahlkriterien|strike-staffel|open\s+interest|wochenoption)/i;
    const validationReRev = /(optionsmarkt|options-|auswahlkriterien|strike-staffel|open\s+interest|wochenoption)[^.]{0,120}?nicht\s+verifiziert/i;
    if (!validationRe.test(text) && !validationReRev.test(text)) {
      missing.push('optionsmarkt-validierungsstatus');
    }
  }

  if (stratId === 'atmna') {
    const hasBB = /bollinger|\bBB\b|\bBB-Position\b/i.test(text);
    const hasTightness = /tightness/i.test(text);
    if (!hasBB) missing.push('bollinger-position');
    if (!hasTightness) missing.push('tightness');
  }

  if (_OPTIONS_STRATEGY_IDS.indexOf(stratId) !== -1
      && options && Array.isArray(options.expectedTop3) && options.expectedTop3.length) {
    const expected = options.expectedTop3.slice();
    const actual = _extractSection3Tickers(text) || [];
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const missingTickers = expected.filter((s) => !actualSet.has(s));
    const unexpectedTickers = actual.filter((s) => !expectedSet.has(s));
    if (missingTickers.length || unexpectedTickers.length) {
      missing.push('top3-ticker-konsistenz');
      details.top3Mismatch = { expected, actual, missingTickers, unexpectedTickers };
    }
  }

  const result = { status: missing.length ? 'FAIL' : 'PASS', missing };
  if (Object.keys(details).length) result.details = details;
  return result;
}

// Baut den Repair-Prompt für den zweiten Anthropic-Call. Schickt die
// Originalantwort MIT und verlangt ausdrücklich, NUR die fehlenden
// Pflichtangaben zu ergänzen und sonst nichts zu ändern — das Modell soll
// nicht neu generieren, sondern gezielt nachbessern (analog zum
// REPAIR-Loop-Konzept, das ko-prompts.js selbst im Kommentar bei
// validateBriefingCompliance() vorschlägt).
// GESCHÄRFT (v1.25, 20.09.2026, Live-Test-Fund direkt nach v1.24-Deploy):
// Bollinger-Position/Tightness wurden vom Repair zuverlässig nachgezogen,
// "optionsmarkt-validierungsstatus" blieb hängen — das Modell schrieb "Daten
// nicht verfügbar" statt der von validateBriefingCompliance() wörtlich
// verlangten Zeichenkette "nicht verifiziert" (semantisch identisch, aber
// kein Regex-Treffer). Root Cause: der Prompt nannte bisher nur, WELCHER
// Punkt fehlt, nicht MIT WELCHEM WORTLAUT er zu ergänzen ist. Fix: pro
// fehlendem Punkt einen expliziten Formulierungshinweis anhängen. Der
// Validator selbst bleibt bewusst UNVERÄNDERT an "nicht verifiziert" als
// kanonische Formulierung gebunden (nicht auf Synonyme wie "nicht
// verfügbar"/"nicht geprüft" aufgeweicht) — das ist eine bewusst etablierte
// Compliance-Sprache, kein fachlicher Inhalt, den das Modell frei
// interpretieren soll.
// ERWEITERT (v1.26, 21.09.2026, LLM-Auswahl-Drift-Fix): neuer optionaler
// 4. Parameter `details` — bei 'top3-ticker-konsistenz' in `missing` liefert
// details.top3Mismatch die konkreten erwarteten/tatsaechlichen/fehlenden/
// unerwarteten Ticker (aus validateBriefingCompliance()). Reviewer-Vorgabe:
// der Repair-Hinweis muss die Ersetzung EXPLIZIT benennen ("Ersetze CSCO
// durch MRK"), nicht nur pauschal "Überprüfe die Kandidaten" sagen.
function buildRepairPrompt(strategy, missing, originalText, details) {
  const missingDesc = missing.join(', ');
  const hints = [];

  if (missing.includes('optionsmarkt-validierungsstatus')) {
    hints.push(
      '- Für "optionsmarkt-validierungsstatus": Verwende im Text ' +
      'WÖRTLICH die Formulierung "nicht verifiziert". ' +
      'Nicht durch "nicht verfügbar", "nicht geprüft" oder andere ' +
      'Umschreibungen ersetzen.'
    );
  }

  if (
    missing.includes('bollinger-position') ||
    missing.includes('tightness')
  ) {
    hints.push(
      '- Für "bollinger-position"/"tightness": Verwende die Begriffe ' +
      '"Bollinger-Position" und "Tightness" WÖRTLICH.'
    );
  }

  if (missing.includes('top3-ticker-konsistenz') && details && details.top3Mismatch) {
    const { expected, missingTickers, unexpectedTickers } = details.top3Mismatch;
    hints.push(
      '- Für "top3-ticker-konsistenz": Für ' + strategy + ' ist die ' +
      'Kandidatenauswahl deterministisch vorgegeben. Die verbindlichen ' +
      'drei Kandidaten für Abschnitt 3 sind: ' + expected.join(', ') + '. ' +
      'Deine vorherige Antwort verwendete stattdessen ' +
      (unexpectedTickers.length ? unexpectedTickers.join(', ') : '(unvollständige Liste)') +
      '. Das ist nicht zulässig. Ersetze ' +
      (unexpectedTickers.length ? unexpectedTickers.join(', ') : 'die falschen Ticker') +
      ' durch ' + (missingTickers.length ? missingTickers.join(', ') : 'die fehlenden Ticker') +
      '. Verwende in Abschnitt 3 EXAKT: ' + expected.join(', ') + '. ' +
      'Falls einer der vorgegebenen Kandidaten zuvor als "erfüllt die ' +
      'Kriterien nicht" dargestellt wurde, entferne diese Aussage — die ' +
      'Kandidatenauswahl selbst steht nicht zur Debatte, nur ihre ' +
      'Erläuterung.'
    );
  }

  const hintText = hints.length
    ? '\n\nWICHTIG — exakter Wortlaut:\n' + hints.join('\n')
    : '';

  return (
    'Deine vorherige Antwort zur Strategie "' + strategy +
    '" ließ folgende Pflichtangabe(n) aus: ' + missingDesc +
    '. Hier ist deine vorherige Antwort:\n\n' +
    '---\n' + originalText + '\n---\n\n' +
    'Ergänze GENAU die fehlende(n) Pflichtangabe(n) an der dafür ' +
    'vorgesehenen Stelle (Abschnitt 3 für den Optionsmarkt-' +
    'Validierungsstatus bzw. die verbindlichen Top-3-Kandidaten, ' +
    'Abschnitt 4 für Bollinger-Position/Tightness bei atmna). Ändere ' +
    'sonst NICHTS an der Antwort, auch nicht Formulierungen, ' +
    'Reihenfolge oder Länge anderer Abschnitte.' +
    hintText +
    '\nGib die VOLLSTÄNDIGE, korrigierte Antwort zurück, nicht nur ' +
    'den Zusatz und nicht nur den betroffenen Abschnitt.'
  );
}

// ── §23 NUMERIC-FABRICATION-SCAN (v1.20, 08.09.2026) ────────────────────────
// Ergänzt die beiden Scanner oben um eine EIC-exklusive Prüfung: findet
// $-Beträge und %-Werte im "HANDLUNGSEMPFEHLUNG (EIC-exklusiv)"-Block (§23,
// ko-prompts.js _eicMasterPrompt()), die NICHT im an das Modell gesendeten
// payload vorkommen — können also weder ein echter UIQ-Datenwert (Strike,
// IVP-Perzentil, Kurs, ATR) noch eine im Prompt genannte Marktkonvention
// (30-45 DTE, 50/60/70%-Gewinnstufen, 5%-Strike-Staffelung) sein.
// Auslöser: FÜNF Live-Test-Funde am 07.09.2026 (csp_wheel/atmna), bei denen
// trotz vier promptseitiger Nachschärfungsrunden (ko-prompts.js v2.48.2 bis
// v2.49.4) immer wieder NEUE erfundene Zahlen auftauchten (Break-even-Kurse,
// %-Mindestprämienschwellen, Bid-Ask-Spread-Dollarbeträge, eine falsche
// OI-Mindestzahl — obwohl die korrekte Zahl im Prompt selbst stand). Axel-
// Entscheidung nach dem fünften Fund: serverseitige Sichtbarkeit statt einem
// sechsten Prompt-Patch — dasselbe Muster, das sich bei der Ticker-Scope-
// Sperre (v1.13) bereits bewährt hat.
// HEURISTIK, KEIN GARANTIERT VOLLSTÄNDIGER PARSER (wie die beiden Scanner
// oben): ein $-/%-Wert im Handlungsempfehlungs-Block, der als Zeichenkette
// nicht im payload auftaucht, ist ein STARKES Fabrikationssignal, aber kein
// Beweis (z.B. könnte das Modell einen echten Prompt-Wert leicht anders
// formatieren, etwa "458,57" vs. "458.57" oder mit/ohne Tausenderpunkt —
// dann False Positive). BEKANNTE FEHLALARM-KLASSE (Live-Fund 08.09.2026,
// atmna-Sechstlauf): eine wortbasierte Konvention im Prompt ("dreistelliger
// Bereich"), korrekt vom Modell in eine Zahl übersetzt ("100 Kontrakte"),
// schlägt hier ebenfalls an — der reine Zeichenketten-Abgleich kann "100"
// nicht mit "dreistellig" verknüpfen. Bewusst nicht mit Spezialfall-Logik
// behoben (würde Domänenwissen fest verdrahten, das dieser Scanner gerade
// NICHT haben soll) — im /logs-Review ist das ein akzeptabler, erkennbarer
// Fehlalarm, kein Blocker. Dient der Sichtbarkeit im /logs-Endpoint, NICHT
// der automatischen Korrektur oder Blockierung — genau wie die beiden
// Scanner oben. Läuft nur, wenn expert_mode aktiv UND ein "HANDLUNGS-
// EMPFEHLUNG"-Block überhaupt erkennbar ist (kein Treffer = kein Scan,
// kein Fehlalarm).
function extractHandlungsempfehlung(text) {
  if (!text) return '';
  const m = text.match(/HANDLUNGSEMPFEHLUNG[^\n]*\n([\s\S]*)/i);
  return m ? m[1] : '';
}

function extractNumericTokens(str) {
  if (!str) return [];
  // $-Beträge ($123,45 / $123.45 / $123), %-Werte (12,5% / 12.5% / 12%),
  // Kontrakt-Stückzahlen ("50 Kontrakte") und Cent-Angaben ("5 Cent") —
  // letztere ergänzt nach Live-Fund 08.09.2026 (atmna-Sechstlauf): das
  // Modell nannte einen erfundenen Bid-Ask-Schwellenwert ausdrücklich MIT
  // dem Hinweis "keine UIQ-Zahl verfügbar" davor, wich aber auf die Einheit
  // "Cent" statt eines $-Zeichens aus und entging damit dem bisherigen
  // Muster — dieselbe Fundklasse, neue Verkleidung, kein neues Prompt-
  // Verbot noetig (Fund-Prinzip s. §23-Kommentar in ko-prompts.js), nur
  // eine weitere Einheit im Scanner.
  const dollarMatches = str.match(/\$\s?\d[\d.,]*/g) || [];
  const pctMatches = str.match(/\d[\d.,]*\s?%/g) || [];
  const kontrakteMatches = str.match(/\d[\d.,]*\s?Kontrakte[n]?/gi) || [];
  const centMatches = str.match(/\d[\d.,]*\s?Cent/gi) || [];
  return dollarMatches.concat(pctMatches).concat(kontrakteMatches).concat(centMatches);
}

function scanForNumericFabrication(text, payload) {
  if (!text || !payload) return [];
  const block = extractHandlungsempfehlung(text);
  if (!block) return [];
  const candidates = extractNumericTokens(block);
  const violations = [];
  candidates.forEach(function(tok) {
    const normalized = tok.replace(/\s/g, '');
    if (!payload.includes(normalized) && !payload.includes(tok)) {
      violations.push('ZAHL-ERFUNDEN:' + tok.trim());
    }
  });
  return violations;
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

      // NEU (15.09.2026): ?budget=1 liest die AI-Budget-Log-Eintraege
      // (s. recordAiBudgetEntry() oben) statt der normalen Request-Logs —
      // eigener Zweig mit eigenem Key-Prefix (`budget:` statt `log:`) und
      // eigener Aggregation (Summe pro action), da die Fragestellung eine
      // andere ist ("was kostet welche Funktion") als bei den normalen
      // Logs ("wer hat wann was aufgerufen"). Optional ?date=YYYY-MM-DD
      // grenzt auf einen Tag ein (nutzt den Key-Prefix direkt, kein Scan).
      // HINWEIS (v1.24): Repair-Calls landen hier unter dem eigenen Action-
      // Namen "<action>_REPAIR" (s. Haupthandler unten) — dadurch sind die
      // Zusatzkosten des REPAIR-Loops in dieser Aggregation separat
      // sichtbar, statt sich unter dem ursprünglichen "ki_briefing"-Eintrag
      // zu verstecken.
      if (url.searchParams.get('budget') === '1') {
        const dateFilter   = url.searchParams.get('date') || '';
        const budgetPrefix = dateFilter ? `budget:${dateFilter}:` : 'budget:';
        const budgetLimit  = parseInt(url.searchParams.get('limit') || '1000');
        const budgetListed = await env.AUTH_KV.list({ prefix: budgetPrefix, limit: budgetLimit });
        const budgetEntries = [];
        for (const key of budgetListed.keys) {
          const val = await env.AUTH_KV.get(key.name);
          if (val) {
            try { budgetEntries.push(JSON.parse(val)); } catch(e) {}
          }
        }
        budgetEntries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        const byAction = {};
        for (const e of budgetEntries) {
          const a = e.action || 'unknown';
          if (!byAction[a]) {
            byAction[a] = { calls: 0, tokenInputTotal: 0, tokenOutputTotal: 0, estimatedCostUsdTotal: 0, costUnknown: false };
          }
          byAction[a].calls += 1;
          byAction[a].tokenInputTotal  += e.tokenInput  || 0;
          byAction[a].tokenOutputTotal += e.tokenOutput || 0;
          if (e.estimatedCostUsd == null) byAction[a].costUnknown = true;
          else byAction[a].estimatedCostUsdTotal += e.estimatedCostUsd;
        }
        for (const a of Object.keys(byAction)) {
          byAction[a].estimatedCostUsdTotal = byAction[a].costUnknown
            ? null
            : +byAction[a].estimatedCostUsdTotal.toFixed(6);
          delete byAction[a].costUnknown;
        }

        return jsonResponse({ count: budgetEntries.length, byAction, entries: budgetEntries }, 200, origin);
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

    // ERWEITERT (v1.24, 20.09.2026): neues optionales Feld `strategy` —
    // s. Changelog-Eintrag oben. Fehlt es (z.B. bei älteren Frontend-
    // Ständen oder Actions ausserhalb von ki_briefing), bleibt der REPAIR-
    // Loop weiter unten schlicht inaktiv (fail-open) — kein Verhaltens-
    // unterschied zu v1.23 für alle Aufrufe, die dieses Feld nicht senden.
    const { action, payload, expert_mode: expertModeRequested = false, strategy = null } = body;

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

    // ERHÖHTES max_tokens FÜR EIC-MODUS (07.09.2026, zuletzt 5000; 08.09.2026
    // ERNEUT ERHÖHT — Live-Test-Fund: trotz 5000 brach die Antwort bei 3 von
    // 4 parallel getesteten Strategien (collar/cc/weekly_income) weiterhin
    // mitten im Satz/Wort ab, obwohl §23s Kompaktheits-Vorgabe (v2.49.2)
    // bereits nachgeschärft wurde. Zusammen mit einer konkreten Wort-Budget-
    // Vorgabe pro Kandidat (s. ko-prompts.js) als zweiter, komplementärer
    // Hebel — dieses Limit ist das Sicherheitsnetz, falls die Kompaktheit
    // trotzdem nicht durchgehend greift. Betrifft NUR ki_briefing im EIC-
    // Modus — Public-Limit (3000) und alle anderen Actions bleiben
    // unveraendert.
    const effectiveMaxTokens = (action === 'ki_briefing' && expert_mode)
      ? 7000
      : cfg.max_tokens;

    try {
      const data = await callAnthropic(
        env.ANTHROPIC_API_KEY,
        cfg.model,
        effectiveMaxTokens,
        systemPrompt,
        payload,
      );

      let text = data?.content?.[0]?.text || '';

      // ── REPAIR-LOOP (v1.24, 20.09.2026) ─────────────────────────────────
      // Nur für Public-Mode-ki_briefing-Aufrufe einer der fünf Options-
      // Strategien (s. validateBriefingCompliance()-Kommentar oben) — und
      // nur, wenn das Frontend die neue `strategy`-Angabe überhaupt sendet
      // (fail-open sonst, s. Kommentar bei der body-Destrukturierung).
      // Läuft VOR den bestehenden Compliance-/Ticker-Scope-Scannern, damit
      // diese bei einem erfolgreichen Repair bereits den korrigierten Text
      // scannen, nicht die unvollständige Erstantwort.
      let repairFlags = [];
      if (!expert_mode && action === 'ki_briefing' && _OPTIONS_STRATEGY_IDS.indexOf(strategy) !== -1) {
        // NEU (v1.26, 21.09.2026, LLM-Auswahl-Drift-Fix): expectedTop3 aus
        // dem Prompt-Text selbst extrahiert (s. _extractExpectedTop3FromPayload()
        // -Kommentar) — null, wenn payload noch mit einer aelteren ko-prompts.js-
        // Version (vor v2.53.30) gebaut wurde; validateBriefingCompliance()
        // ueberspringt den Top-3-Check dann automatisch (rueckwaertskompatibel).
        const expectedTop3 = _extractExpectedTop3FromPayload(payload);
        const initialCheck = validateBriefingCompliance(strategy, text, { expectedTop3 });
        if (initialCheck.status === 'FAIL') {
          repairFlags.push('REPAIR-ATTEMPTED');
          console.warn('[REPAIR]', action, strategy, 'fehlende Pflichtangaben:', initialCheck.missing.join(', '));
          try {
            const repairPrompt = buildRepairPrompt(strategy, initialCheck.missing, text, initialCheck.details);
            const repairData = await callAnthropic(
              env.ANTHROPIC_API_KEY,
              cfg.model,
              effectiveMaxTokens,
              systemPrompt,
              repairPrompt,
            );
            const repairText = repairData?.content?.[0]?.text || '';
            // Eigener Budget-Eintrag (nicht unter dem ursprünglichen action-
            // Namen), damit die Zusatzkosten des Repair-Calls im
            // /logs?budget=1-Report separat sichtbar bleiben.
            await recordAiBudgetEntry(env, {
              action: `${action}_REPAIR`, model: cfg.model,
              usage: repairData.usage, expertMode: expert_mode,
            });
            const repairCheck = validateBriefingCompliance(strategy, repairText, { expectedTop3 });
            if (repairCheck.status === 'PASS') {
              text = repairText;
              repairFlags.push('REPAIR-SUCCESS');
            } else {
              // Kein zweiter Repair-Versuch (Grundsatz "ein Retry", s.
              // callAnthropicWithRetry() in generate_public_
              // recommendations.js) — die (weiterhin unvollständige)
              // Repair-Antwort wird trotzdem ausgeliefert, damit der
              // Nutzer in jedem Fall eine Antwort bekommt.
              text = repairText;
              repairFlags.push('REPAIR-FAILED:' + repairCheck.missing.join('+'));
              console.warn('[REPAIR] fehlgeschlagen, fehlt weiterhin:', repairCheck.missing.join(', '));
            }
          } catch (repairErr) {
            // Repair-Call selbst gescheitert (z.B. Netzwerk-/Anthropic-
            // Fehler) — Originalantwort bleibt unverändert erhalten, kein
            // Fehler an den Nutzer durch den REPAIR-Mechanismus selbst.
            repairFlags.push('REPAIR-ERROR:' + repairErr.message.slice(0, 80));
            console.error('[REPAIR] Anthropic-Call fehlgeschlagen:', repairErr.message);
          }
        }
      }

      // Compliance-/Ticker-Scope-Scan nur im Public-Modus (expert_mode ist
      // bewusst direktiv, s. SUITE.md №65/№66) — nicht blockierend, nur
      // geloggt. Im EIC-Modus stattdessen der §23-Zahlen-Erfindungs-Scan
      // (v1.20, s. scanForNumericFabrication() oben) — andere Fundklasse,
      // deshalb anderer Scanner, aber dasselbe complianceFlags-Feld für
      // /logs, damit keine zweite Log-Struktur entsteht.
      const complianceFlags = (expert_mode
        ? scanForNumericFabrication(text, payload)
        : scanForComplianceViolations(text).concat(scanForTickerScopeViolations(text))
      ).concat(repairFlags);
      if (complianceFlags.length) {
        console.warn('[COMPLIANCE]', action, complianceFlags.join(', '));
      }

      const cfRay = request.headers.get('CF-Ray') || '';
      await logRequest(env, token, action, origin, cfRay, true, complianceFlags);
      await recordAiBudgetEntry(env, { action, model: cfg.model, usage: data.usage, expertMode: expert_mode });

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
