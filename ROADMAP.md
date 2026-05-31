# KO-Scanner — Roadmap & Geplante Erweiterungen

> Technische Trading-App für Knock-out Turbo-Zertifikate auf Trade Republic  
> Entwickelt von Dr. Axel Hildebrand · Stand: Mai 2026

---

## ✅ Implementiert (v1.0)

### Scanner & Analyse
- [x] MACD / OBV / MA50 Signale (3/3 Kaufsignal)
- [x] SEPA Score 0-8 (Minervini Trend Template)
- [x] Composite Score 0-100 mit konfigurierbarer Gewichtung
- [x] Trend Stickyness (ADX-Proxy, 14-Tage Persistenz)
- [x] RS-Rating vs. S&P 500 (63-Tage relative Performance)
- [x] Signal-Qualität Backtesting (In-Sample, 220 Tage)
- [x] 52-Wochen-Hoch/Tief Balken (visuell)
- [x] Earnings-Kalender (Finnhub, ≤7d rot / ≤14d amber / >14d grau)
- [x] Buy-Point Analyse (10W-MA, 52W-Hoch, Konsolidierung)
- [x] US/DE Toggle (NYSE/Nasdaq + Xetra)
- [x] Zeitrahmen: 15m / 30m / 1h / 4h / 1T

### Markt & Makro
- [x] Marktphasen-Filter (Confirmed Uptrend → Correction, Score-Multiplikator)
- [x] Sektor-Rotation Heatmap (AI/Semis, Cloud, Infrastruktur, Growth, Biotech)
- [x] Top 10 Aktivste (US via Finnhub, DE via Twelve Data)
- [x] After-Hours / Pre-Market Movers
- [x] Makro-Tab: BTC/ETH/SOL, Gold/Silber/Öl, S&P/Nasdaq/VIX
- [x] Auto-Makro KI-Einschätzung (Claude Haiku)

### Verwaltung
- [x] Watchlist-System mit Modal (hinzufügen, entfernen, umbenennen, löschen)
- [x] Scan-Ergebnisse als Watchlist speichern (3/3 / ≥2/3 / Alle)
- [x] Score-Gewichtung Admin (4 Zeithorizont-Presets + manuell)
- [x] Journal mit Live P&L (Finnhub-basiert)
- [x] Export / Import (JSON: Journal, Watchlisten, Score-Gewichtung)
- [x] PIN-Schutz
- [x] GitHub Pages Hosting (ahsub.github.io/axel-scanner)

---

## 🔜 Geplante Erweiterungen (Priorität hoch)

### 1. Broker-Integration / Ticker-Export
**Ziel:** Scan-Ergebnisse direkt an Broker-Plattformen übergeben

#### TradingView
- [ ] Watchlist-Export als `.txt` im TradingView-Format (ein Ticker pro Zeile)
- [ ] Direktlink: `https://www.tradingview.com/chart/?symbol=NASDAQ:NVDA`
- [ ] "In TradingView öffnen" Button in jeder Scanner-Karte

#### Trade Republic
- [ ] Direktlink zu Aktie: `https://app.traderepublic.com/instrument/ISIN`
- [ ] ISIN-Lookup via Finnhub (`/stock/profile2`) für US und DE Aktien
- [ ] "In Trade Republic öffnen" Button in jeder Scanner-Karte

#### CapTrader / IBKR
- [ ] Watchlist-Export als `.csv` im IBKR-Format (Symbol, Exchange, Currency)
- [ ] IBKR Scanner-Import Format (XML oder CSV)
- [ ] Download-Button: "Als IBKR Watchlist exportieren"

#### Allgemein
- [ ] Export aller 3/3 Signale als CSV (Symbol, Score, SEPA, RS, Earnings)
- [ ] Export als PDF-Report für Investment-Club Meetings

---

## 🔜 Geplante Erweiterungen (Priorität mittel)

### 2. Scan-Verlauf & Vergleich
- [ ] Letzte 5 Scans speichern (localStorage)
- [ ] Vergleich: "Hat sich NVDA seit gestern verbessert?" (+/- Score Delta)
- [ ] Score-Trend Indikator (↑ steigend / → stabil / ↓ fallend)

### 3. Ticker-Namen & Stammdaten
- [ ] Vollständige Firmennamen via Finnhub (`/stock/profile2`)
- [ ] Sektor-Zuordnung automatisch (nicht manuell hardcoded)
- [ ] Logo/Icon in Karten-Header (optional)
- [ ] Für DE-Aktien: XETRA Name + ISIN

### 4. Push-Alerts (PWA)
- [ ] Web Push Notifications wenn Watchlist-Titel 3/3 + Score ≥70 erreicht
- [ ] KO-Abstand-Alert wenn Position <15% KO-Abstand
- [ ] PWA-Installation auf iPhone (Add to Home Screen)
- [ ] Tägliche Scan-Erinnerung (Morgens 9:00 Uhr)

### 5. Erweitertes Backtesting
- [ ] Zeithorizont wählbar: 10d / 20d / 40d Lookahead
- [ ] Signal-Kombination testen: z.B. nur 3/3 + SEPA≥6 + RS≥70
- [ ] Equity-Kurve visualisieren (wenn alle Signale gehandelt)
- [ ] Vergleich verschiedener Score-Gewichtungen historisch

---

## 💡 Ideen für spätere Versionen

- **Multi-User Support** — jeder Investment-Club-Mitglieder hat eigene Keys, gemeinsame Watchlisten über geteilte Links
- **Options-Modul** — Wheel Strategy Screener (CSP/CC) direkt integriert, Strike-Auswahl via Delta, IV-Rank Anzeige
- **Earnings Play Screener** — Titel mit Earnings in 7-14 Tagen + hohem IV + bullischem Setup
- **Relative Rotation Graph (RRG)** — Sektor-Momentum visuell als Rotation Chart
- **Automatischer Tages-Report** — täglich um 08:00 Uhr Auto-Scan der Top-50 + AI-Zusammenfassung per E-Mail

---

## 🔧 Technische Schulden / Bekannte Einschränkungen

- Twelve Data Free Tier: 800 Credits/Tag — bei 50 Titeln × 220 Tage = ~50 Credits/Scan
- DE-Scanner am Wochenende: letzte Freitagskurse (kein Intraday)
- Backtesting In-Sample (nicht Out-of-Sample) — keine Garantie für zukünftige Performance
- SEPA MA200 benötigt 220 Tage Daten — bei neuen Titeln (<1 Jahr) unvollständig
- Kein echter After-Hours Kurs für DE-Aktien (Xetra geschlossen ab 17:30)

---

## 📊 API-Übersicht

| API | Verwendung | Limit Free | Kosten Paid |
|---|---|---|---|
| Twelve Data | Scanner MACD/OBV/MA/SEPA | 800 Credits/Tag | $8/Monat |
| Finnhub | Movers, Earnings, Live P&L | 60 Req/Min | kostenlos reicht |
| Anthropic Claude | Auto-Makro KI | Pay-per-use | ~$0.01/Aufruf |
| Binance | Krypto Live-Preise | Unbegrenzt | kostenlos |
| Yahoo Finance | Rohstoffe via Proxy | Unbegrenzt | kostenlos |

---

*Letzte Aktualisierung: Mai 2026*
