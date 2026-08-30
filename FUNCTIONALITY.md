# Punji — Full Functionality Reference

Context document for anyone working on this app. Everything it does, its data model, APIs, and computation rules. Element IDs and CSS classes referenced by `app.js` are load-bearing — keep them intact.

## Product summary

Punji is a personal ledger manager (Lofi-stack Hackathon 2026, problem P12, team LSH26-T063) for BDT budgets: track salary and expenses (including by receipt photo), see a monthly dashboard, get a forecast with concrete insights, and plan savings goals with DPS interest comparison.

- Live: https://lsh26-t063-p12.vercel.app
- Repo: https://github.com/tanvirahmodrafi/lsh26-t063-p12
- Stack: vanilla HTML/CSS/JS, no framework, no build step, zero npm dependencies. Two Vercel serverless functions. Neon Postgres persistence. Dark-committed premium fintech theme with a brand background image.

## Layout (index.html)

Desktop app shell: fixed left **sidebar** (236px, translucent + backdrop blur over `assets/bg.jpg`) + main content column (max 1240px). Under 800px the sidebar becomes a top bar with horizontally scrolling tabs.

- **Sidebar**: brand (`assets/logo.png` mark + "Punji / Personal ledger"), nav (`.tab` buttons with `data-tab` → panes `#tab-<name>.tabpane`, `.active` toggles both), footer: `#syncStatus` (dot + saved/synced/offline, `data-state` colors the dot), "Demo case" `#caseSelect` (25 sample cases from `data/P12_personal_ledger_public.json`, options appended by JS), `#resetBtn` (confirm → clears localStorage + rotates sync id → reload).
- Every pane has a page header: uppercase eyebrow, h1, subtitle; Dashboard also has a "+ Add expense" button that clicks the Add tab.

### Overview (`#tab-dashboard`)
- **Financial health status** `#healthStatus` (`#healthStatusLabel` pill + `#healthStatusText`, `data-tone` good/warn/bad/neutral) — deterministic: salary≤0 → "Salary not set"; leftover<0 → "Projected deficit"; leftover/salary ≥0.20 → "On track"; ≥0.08 → "Watch spending"; else "At risk". Supporting sentence uses real amounts; appends pocket fundability when goals exist. Sits directly under `#statRow`.
- `#statRow` — 4 JS-generated metric cards (`.stat` > `.label/.value/.sub`, `.good/.bad` on value): spent (+% of salary; first card accent-highlighted), money left, last month total, pace vs last month (▲/▼ vs pro-rated).
- **Spending trend** `#trendChart` — inline SVG: cumulative daily lines, this month (blue, endpoint dot + total) vs last month (gray, full), dashed salary line. Draw-on animation (`.trend-line` stroke-dash, `.trend-end` fade). `#trendLabel` exists hidden (legacy hook).
- **Daily spending** `#dailyChart` — SVG bar per day (`.dbar`, grow-up animation), today's bar accent-colored, peak labeled, tooltips via `<title>`.
- **Spending by category** `#catChart` — per category: emoji + name, blue this-month bar over thin gray last-month bar (`.bar-group/.bar-pair/.bar.this/.bar.last/.bar-label`), grow-from-left animation. `#catMonthLabel` = "April 2026 vs March 2026".
- **Largest expenses** `#topExpenses` — top 5 this month (compact table).
- **Transactions** `#expTable` + `#expCount` — all expenses newest-first with ✎ `data-edit` and ✕ `data-del` icon buttons; hover rows; designed empty state row.

### Add expense (`#tab-add`)
- Form card `#expForm`: `#expDate` + `#expCategory` (datalist `#catList`) on one row, `#expShop`, hero amount input `#expAmount` (৳ prefix), `#expSubmitBtn` ("Save expense" / "Update expense" in edit mode), `#saveMsg`.
- Receipt scanner card: dropzone label wrapping `#receiptFile` (input covers the zone invisibly) → client-side downscale to ≤1600px JPEG → POST `/api/ocr` → `#ocrStatus` (spinner while non-empty) → `#ocrResult` "Detected from receipt" panel (`#ocrReadList`) + values prefill the form for correction. `#receiptPreview` in `#receiptPreviewWrap`. On smaller screens the scanner card orders first.

### Forecast (`#tab-forecast`)
- `#forecastStats` — 4 metric cards: spent so far (day X of Y), expected rest, projected total, expected left/SHORT (green/red).
- **Salary allocation** `#budgetBar` in `#budgetCard` — stacked bar: spent | expected rest | leftover (green) or over-salary (red), staggered grow animation, legend with amounts. Card hides when salary ≤ 0.
- **What-if simulator** `#whatIfCard` (`#whatIfCategory` select showing reducible amount per category, `#whatIfAmount`, `#whatIfRun`, `#whatIfReset`, `#whatIfResult`) — non-persistent: effectiveReduction = min(requested, projected − spentSoFar) for the chosen category; simulated projected total and leftover shown side-by-side vs current, with a cap notice when the request exceeds reducible spend and a pocket-affordability line (turns green when the simulated leftover covers all contributions). Touches no state, storage, or cloud.
- **Why this forecast?** `#forecastExplain` / `#forecastExplainList` — one `<details>` per category (sorted by projection): method label + plain-language rule (variable / lumpy / repeat-of-last-month / new via `explainMethod()`, a read-only mirror of the engine's classification), tx count, spent, last month, run rate where applicable, final projection. Complements, never replaces, `#forecastMethod`.
- **Insights** `#insightsList` — 3–6 generated cards (`.insights li`, `.warn`/`.bad`; status dot + left border blue/amber/red). Always name specific categories/shops/amounts.
- **Category forecast** `#forecastTable` — spent/last/expected-more/projected per category; projected column visually strongest. `#forecastMethod` inside a labeled "Methodology" panel.

### Savings (`#tab-pockets`)
- `#pocketForm` (`#pkName #pkItem #pkTarget #pkContrib`) + DPS card (`#dpsRate`).
- `#pocketCards` — goal cards (`.pocket`, delete via `data-delpocket`): target, monthly contribution, expected completion (month + count), DPS value after that horizon, DPS interest earned, DPS-reaches-target month; green "DPS gets you there N months earlier" note when true; affordability note (`.note ok/warn/bad`).

### Settings (`#tab-settings`)
- `#salaryInput`, `#todayInput` (ledger date drives "this month" + forecast split), `#exportPdf` (builds `#printReport` — a light-themed monthly report with health status, KPIs, category table, top expenses, savings goals — then `window.print()` for the browser's Save-as-PDF; report is print-media-only and lives outside `.shell`), `#exportCsv` (client-side blob download).

## Data model (all money = integer paisa)

```js
state = {
  caseId, today: "YYYY-MM-DD", salary_p, dpsRate,
  expenses: [{ id, date, category, shop, amount_p }],
  pockets:  [{ id, name, item, target_p, contrib_p }],
}
```
- Categories: Clothing 👕 Education 📚 Entertainment 🎬 Food 🍜 Groceries 🛒 Health 💊 Mobile 📱 Rent 🏠 Transport 🚌 Utilities 💡 (free text allowed; unknown → 🧾).
- `fmt()` renders ৳ with en-IN grouping; negative = −৳. `tabular-nums` everywhere money appears.

## Persistence & sync

- localStorage `p12-ledger-v1` (instant paint + offline fallback); anonymous per-browser id `p12-sync-id`.
- Cloud: debounced (800ms) PUT `{id, state}` to `/api/ledger`; boot GET prefers the cloud copy. Status → `#syncStatus`.
- `API_BASE`: empty on *.vercel.app, else `https://lsh26-t063-p12.vercel.app` (local static server fallback; both functions send CORS `*` and handle OPTIONS).

## Serverless APIs

- `POST /api/ocr` `{image: dataURL}` → `{shop, date, amount_bdt, category, model, raw}` — OpenRouter vision (Gemini 2.5 Flash Lite, Flash fallback). Env: `OPENROUTER_API_KEY`.
- `GET/PUT /api/ledger` — JSONB row per ledger id in Neon `ledgers` table via Neon HTTP SQL API (no driver). Env: `DATABASE_URL`.

## Computation rules (do not change)

- **Months**: "this month" = month of `state.today`; expenses dated after `today` are excluded from this-month totals.
- **Forecast per category**: variable (≥3 tx this month) → `max(spentSoFar, round(avg(lastMonthTotal, runRate)))`, runRate = spent ÷ dayOfMonth × daysInMonth; lumpy (<3 tx) → `max(spentSoFar, lastMonthTotal)`; only-last-month → repeat; new → runRate. Leftover = salary − (spent + Σ expected-more).
- **Insights**: pace-increase (≥2 tx only), pace-decrease (spent > 0 only), largest single expense (+% of salary), largest category share, pocket affordability vs leftover, month-end shortfall. Up to 6.
- **Pockets**: completion months = `ceil(target ÷ contribution)`, date = thisMonth + months; DPS simulated over that same horizon with the planned contribution. If forecast leftover < Σ contributions, the note states each pocket's proportional affordable share and the forecast-adjusted landing (">10 years" wording past 120 months); leftover ≤ 0 → bad note.
- **DPS** (exact spec rule): monthly `balance += deposit; interest = round_half_up(balance × rate ÷ 12 ÷ 100)` to the paisa, joins balance. Integer arithmetic: rateBp = rate×100; interest = ⌊(2·bal·rateBp + 120000) ÷ 240000⌋.

## Design system (style.css)

- Tokens: page `#0b0d10`, card `#15191f`, card-2 `#191e25`, ink `#f5f7fa`/`#a7adb7`/muted `#6f7782`, accent `#4f8ef7`, series-1 `#3987e5`, series-0 `#6b6a64`, good `#0ca30c`, warning `#fab219`, critical `#d03b3b`. Cards 14px radius, controls 10px, buttons 40px (`.btn primary/secondary/subtle-danger`).
- Background: `assets/bg.jpg` fixed cover behind a left-to-right dark gradient overlay (`body::before/::after`, z-index −1).
- Animations (120–900ms, all CSS, `prefers-reduced-motion` respected): tab panes rise, stat cards stagger, category bars `growX`, daily bars `growY`, budget segments cascade, trend lines `drawLine` + endpoint `fadeIn`, OCR spinner, OCR result rise.
- Empty states: `.empty-msg` / `.empty-cell` centered muted messages for trend, category chart, tables, pockets.

## Hard constraints for any change

1. Keep every element id, `data-*` hook, and JS-generated class named above.
2. No external resources (CDN/fonts/libs) — licensing rules ban copyleft; LICENSES.md declares zero dependencies.
3. No build step — plain static files + `api/` functions.
4. Charts: legend for 2-series, one axis, text never in series color.
5. Responsive: no horizontal page overflow at 390px.
