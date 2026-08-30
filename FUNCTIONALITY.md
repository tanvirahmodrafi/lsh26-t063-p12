# Punji — Full Functionality Reference

Context document for UI redesign work. Everything the app does today, its data model, APIs, and computation rules. The redesign must preserve every behavior listed here — element IDs and CSS classes referenced by `app.js` are load-bearing.

## Product summary

Punji is a personal ledger manager (Lofi-stack Hackathon 2026, problem P12, team LSH26-T063) for BDT budgets: track salary and expenses (including by receipt photo), see a monthly dashboard, get a forecast with concrete insights, and plan savings pockets with DPS interest comparison.

- Live: https://lsh26-t063-p12.vercel.app
- Stack: vanilla HTML/CSS/JS, no framework, no build step. Two Vercel serverless functions. Neon Postgres persistence. Dark-committed theme.

## Page structure (index.html)

- **Topbar**: 💰 Punji title · `#syncStatus` cloud indicator ("☁ saved / synced / offline") · `#caseSelect` dropdown (loads 1 of 25 sample cases from `data/P12_personal_ledger_public.json`) · `#resetBtn` (confirm → clears localStorage + rotates sync id → reload).
- **Tab nav** (`.tab` buttons with `data-tab`, panes `#tab-<name>.tabpane`, `.active` class toggles): dashboard, add, forecast, pockets, settings.

### Tab: Dashboard (`#tab-dashboard`)
- `#statRow` stat tiles: Spent this month (+% of salary) · Money left so far (green/red) · Last month total · Pace vs last month (▲/▼ vs pro-rated last month, red when ahead).
- Category chart `#catChart`: horizontal bar pairs per category — this month (blue `--series-1`) over last month (neutral `--series-0`), value labels at bar ends, category name with emoji icon (`catIcon()`), legend above (`#catMonthLabel` shows "April 2026 vs March 2026").
- `#topExpenses` table: 5 largest expenses this month (date, category+icon, shop, amount).
- Trend chart `#trendChart`: inline SVG, cumulative daily spend line for this month (blue, ends in a dot + current total label) vs last month (gray, full month), dashed salary reference line with label. `#trendLabel` subtitle. Day-1/day-N axis captions below.
- `#expTable`: all expenses sorted newest first, per-row ✎ edit (`data-edit`) and ✕ delete (`data-del`) buttons. `#expCount` shows count.

### Tab: Add Expense (`#tab-add`)
- Receipt card: `#receiptFile` file input (image) → client-side downscale to ≤1600px JPEG → POST to `/api/ocr` → `#ocrStatus` progress/errors; on success `#ocrResult` panel lists what was read (shop/date/amount/category guess in `#ocrReadList`) and the values pre-fill the form for correction. `#receiptPreview` shows the image (`#receiptPreviewWrap` unhidden).
- Form `#expForm`: `#expDate` (date), `#expCategory` (text + `#catList` datalist of the 10 categories), `#expShop`, `#expAmount` (number, min 0.01) → `#expSubmitBtn` ("Save expense", switches to "Update expense" in edit mode). `#saveMsg` shows "✓ Saved." for 2.5s. Saving resets the form and hides OCR panels.

### Tab: Forecast & Insights (`#tab-forecast`)
- `#forecastStats` tiles: Spent so far (day X of Y) · Expected rest of month · Projected month total · Expected left/SHORT at month end (green/red).
- `#insightsList`: 3–6 generated insights (`.insights li`, classes "", "warn", "bad" color the left border blue/yellow/red). Insights always name specific categories/shops/amounts.
- `#forecastTable`: per category — spent so far, last month, expected more, projected total. `#forecastMethod` explains the algorithm.

### Tab: Savings Pockets (`#tab-pockets`)
- `#pocketForm`: name `#pkName`, item `#pkItem`, target `#pkTarget`, monthly contribution `#pkContrib`.
- DPS rate card: `#dpsRate` number input (annual %), rule text.
- `#pocketCards`: one `.pocket` card per pocket — 🎯 name, item, delete (`data-delpocket`); grid of: Target · Monthly contribution · Expected completion (month + count, forecast-adjusted) · DPS value after that horizon · DPS interest earned · DPS reaches target in N months; notes: green "DPS gets you there N months earlier", and an affordability note (`ok`/`warn`/`bad`) driven by the forecast leftover.

### Tab: Settings (`#tab-settings`)
- `#salaryInput` (BDT), `#todayInput` (date — drives "this month" and forecast day split).
- Export card: `#exportJson` (full ledger JSON), `#exportCsv` (expenses CSV) — client-side blob downloads.

## Data model (all money = integer paisa)

```js
state = {
  caseId, today: "YYYY-MM-DD", salary_p, dpsRate,
  expenses: [{ id, date, category, shop, amount_p }],
  pockets:  [{ id, name, item, target_p, contrib_p }],
}
```
- Categories: Clothing 👕 Education 📚 Entertainment 🎬 Food 🍜 Groceries 🛒 Health 💊 Mobile 📱 Rent 🏠 Transport 🚌 Utilities 💡 (free text also allowed; unknown → 🧾).
- `fmt()` renders ৳ with en-IN digit grouping; negative = −৳.

## Persistence & sync

- localStorage key `p12-ledger-v1` (instant paint + offline fallback), anonymous per-browser id `p12-sync-id`.
- Cloud: debounced (800ms) PUT `{id, state}` to `/api/ledger`; on boot GET prefers the cloud copy. Status surfaces in `#syncStatus`.
- `API_BASE`: empty on *.vercel.app, otherwise `https://lsh26-t063-p12.vercel.app` (local dev fallback; functions send CORS `*`).

## Serverless APIs

- `POST /api/ocr` `{image: dataURL}` → `{shop, date, amount_bdt, category, model, raw}` — OpenRouter vision (Gemini 2.5 Flash Lite, Flash fallback). Env: `OPENROUTER_API_KEY`.
- `GET/PUT /api/ledger` — JSONB row per ledger id in Neon (`ledgers` table), via Neon HTTP SQL API. Env: `DATABASE_URL`.

## Computation rules (do not change)

- **Months**: "this month" = month of `state.today`; "last month" = previous calendar month. Expenses dated after `today` are ignored in this-month totals.
- **Forecast per category**: variable (≥3 transactions this month) → `max(spentSoFar, round(avg(lastMonthTotal, runRate)))` where runRate = spent ÷ dayOfMonth × daysInMonth; lumpy (<3 tx) → `max(spentSoFar, lastMonthTotal)`; only-last-month → repeat `lastMonthTotal`; new category → runRate. Leftover = salary − (spentSoFar + Σ expected-more).
- **Insights** (pick up to 6): pace-increase category (≥2 tx only), pace-decrease category (spent > 0 only), largest single expense (+% of salary), largest category share, pocket affordability vs leftover (funded / short by X / in the red), month-end shortfall.
- **Pockets**: plain months = `ceil(target ÷ contribution)`; if forecast leftover < Σ contributions, each pocket's affordable share scales proportionally and months = `ceil(target ÷ share)` (capped 600) with a warn note; leftover ≤ 0 → "bad" note. Completion month = thisMonth + months.
- **DPS simulation** (exact spec rule): monthly `balance += deposit; interest = round_half_up(balance × annualRate ÷ 12 ÷ 100) to the paisa; balance += interest`. Integer arithmetic: rateBp = rate×100, interest = ⌊(2·bal·rateBp + 120000) ÷ 240000⌋. Report value after the horizon, total interest, and first month balance ≥ target.

## Current design tokens (style.css)

Dark-only: page `#0d0d0d`, surface `#1a1a19`, ink `#fff`/`#c3c2b7`/muted `#898781`, grid `#2c2c2a`, border `rgba(255,255,255,.1)`, series-1 blue `#3987e5`, series-0 neutral `#6b6a64`, good `#0ca30c`, warning `#fab219`, critical `#d03b3b`. System font stack. Status/series colors follow a validated accessible palette — keep series identity colors and good/warn/critical semantics if restyling.

## Hard constraints for any redesign

1. Keep every element id and `data-*` hook above — `app.js` queries them.
2. No external resources (CDN fonts/icons/libs) — licensing rules ban copyleft and we declare zero dependencies.
3. Charts: keep legend for 2-series charts, don't color text with series colors, one axis only.
4. Must stay responsive (judges may open on any screen; `.grid2` collapses at 800px).
5. No build step — plain files served statically.
