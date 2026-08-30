# 💰 Punji — Personal Ledger Manager

**Team:** LSH26-T063 · **Problem:** P12 · **Event:** Lofi-stack Hackathon 2026

A personal ledger manager for tracking salary, expenses and savings goals in BDT — with receipt-photo reading, a monthly dashboard, a data-driven forecast with written insights, and savings pockets with DPS comparison.

## The four required items — where to find them

1. **Salary + expenses with receipt OCR** — *Settings* tab sets salary; *Add Expense* tab accepts manual entry or a photo of a bill/receipt. The amount, date and shop are read from the image, shown to the user ("What we read from the receipt"), pre-filled into the form, and can be corrected before saving.
2. **Monthly dashboard** — *Dashboard* tab: total spent vs salary, category breakdown (this month vs last month), largest expenses, and pace vs last month.
3. **Forecast + insights** — *Forecast & Insights* tab: expected spending for the rest of the month, expected leftover/shortfall at month end, and 3–6 insights that name specific categories, shops and amounts (never generic advice).
4. **Savings pockets** — *Savings Pockets* tab: pockets with name, item, target and monthly contribution. Each shows an expected completion date tied to the forecast (dates push out when the forecast leftover can't fund the full plan) and what a DPS at the stated rate would return over that time.

## How to run

Static frontend + one serverless function, no build step.

```bash
# local (frontend only — OCR needs the API function)
python3 -m http.server 8123   # then open http://localhost:8123

# full local / deploy (Vercel)
npm i -g vercel
vercel env add OPENROUTER_API_KEY   # key for the OCR vision model
vercel dev                          # local with working OCR
vercel --prod                       # deploy
```

Use the **"load sample case"** dropdown (top right) to load any of the 25 public cases from `data/P12_personal_ledger_public.json`.

## How it works

- **Money math** — all amounts are integer paisa; no floating-point currency errors.
- **DPS rule** — implemented exactly as specified: each month `balance += deposit`, then `interest = balance × rate ÷ 12 ÷ 100` rounded **half-up to the paisa**, added to the balance (compounding).
- **Forecast method** — per category: variable categories (3+ transactions this month) project to `max(spent so far, avg(last month total, this month run-rate))`; one-shot categories (Rent, a single utility bill) project to `max(spent so far, last month total)`; categories seen only last month are expected to repeat; new categories extrapolate their run-rate.
- **Pocket completion** — `ceil(target ÷ contribution)` months; if the forecast leftover can't cover the sum of all pocket contributions, each pocket's affordable share is scaled down proportionally and its date pushed out (shown with a warning).
- **Receipt OCR** — `/api/ocr` serverless function sends the image to a vision model via OpenRouter (Gemini 2.5 Flash Lite, with Flash as fallback) and returns shop/date/amount/category. The raw reading is always displayed for user verification before saving.

## Beyond the four requirements

- **Financial health status** — a deterministic verdict ("On track / Watch spending / At risk / Projected deficit") derived from the forecast, with real amounts in the supporting sentence.
- **"Why this forecast?"** — per-category explainability: which rule fired (variable / lumpy / repeat / new), the transaction count, run rate and inputs behind every projected number.
- **What-if simulator** — non-persistent scenario tool: pick a category, reduce future spend, see the projected month-end balance change (capped so simulated spend never drops below what's already spent).
- **PDF monthly report** — one-click, print-stylesheet-based report (health status, KPIs, category table, top expenses, savings goals with DPS interest) via the browser's Save-as-PDF; CSV export for raw expenses.
- **Charts & polish** — animated cumulative trend, daily spending bars, salary-allocation bar, category comparison bars; premium dark UI, responsive to 390px.

## What's mocked / limitations

- Each browser gets an anonymous ledger id and its data is persisted to Neon Postgres via `/api/ledger` (localStorage doubles as an instant-paint cache and offline fallback). No accounts/login by design.
- Pockets track the plan from "this month" forward; past pocket balances aren't modeled.
- OCR category is a guess; the user confirms before saving.

## Next steps

- Multi-month history view; pocket balance tracking with actual deposits; shared/family ledgers; PWA offline mode.

## Team

- Tanvir (tanvirahmod.cn@gmail.com)

## Tech stack

Vanilla HTML/CSS/JS (no framework, no build), Vercel serverless functions (Node), Neon Postgres for persistence (HTTP SQL API, no driver dependency), OpenRouter vision API for OCR.
