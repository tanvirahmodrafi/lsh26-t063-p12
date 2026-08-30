# Punji — Personal Ledger Manager

Solution for **LofiStack Hackathon 2026 — P12**

## Project information

- **Team:** `LSH26-T063`
- **Team ID:** `LSH26-T063`
- **Problem:** `P12 — Personal Ledger Manager`
- **Repository:** <https://github.com/tanvirahmodrafi/lsh26-t063-p12>
- **Live application:** <https://lsh26-t063-p12.vercel.app>
- **Demo video:** Not provided

> Judges will evaluate only the exact commit SHA entered in the Final Submission Form.

## Solution summary

Punji is a responsive BDT personal ledger for recording salary, expenses and savings goals. It accepts manual expenses or receipt photos, presents month-level spending and explainable forecasts, and compares each savings plan with a DPS using exact paisa arithmetic.

## Requirements

| Requirement | Status | Where to verify |
|---|---|---|
| R1 — Record salary and expenses manually or from a receipt image, with correction before saving | Complete | **Settings → Financial settings** and **Add expense → Expense details / Receipt scanner**; `api/ocr.js` |
| R2 — Monthly dashboard with totals, salary comparison, category breakdown and largest expenses | Complete | **Overview** tab; spending KPIs, category chart, daily/trend charts and transaction tables |
| R3 — Forecast remaining spend and month-end balance with concrete insights | Complete | **Forecast** tab; forecast KPIs, category methodology, “Why this forecast?”, insights and what-if simulator |
| R4 — Savings pockets with completion estimates and DPS comparison | Complete | **Savings** tab; create a goal and review completion, affordability and DPS interest calculations |

## How to test the application

1. Open the [live application](https://lsh26-t063-p12.vercel.app).
2. In **Demo case**, select `PUB-01` and confirm replacement if prompted.
3. Check **Overview** for salary/spending totals, category comparison, transaction history and largest expenses.
4. Open **Add expense**, enter an expense or upload a receipt, verify/correct the detected values, then save it.
5. Edit a transaction and cancel it; delete a transaction and use the seven-second **Undo** action.
6. Open **Forecast** to inspect the month-end projection, written insights, category rules and what-if simulator.
7. Open **Savings**, create a goal and verify its plain-pocket completion date and DPS comparison.
8. Choose **Demo case → — none —** to unload sample data, or use **Reset data** and type `RESET` for a complete reset.

### Test or sample data

The 25 published P12 cases are bundled at `data/P12_personal_ledger_public.json`. Load any case from the sidebar **Demo case** selector. Test data in the same shape can also be entered manually through Settings, Add expense and Savings; selecting “— none —” creates a clean ledger dated to the current day.

## Run locally

### Requirements

- Python 3 (for a zero-configuration static server), or any static HTTP server
- A modern browser
- Optional for self-hosted serverless APIs: Node.js 20+, Vercel CLI, Neon Postgres and an OpenRouter API key

### Setup

```bash
git clone https://github.com/tanvirahmodrafi/lsh26-t063-p12.git
cd lsh26-t063-p12
python3 -m http.server 8123
```

Open <http://localhost:8123>. Local static development automatically uses the deployed APIs, so no private key is required to evaluate the published application.

For your own Vercel deployment, use `.env.example` as the variable-name reference, configure `OPENROUTER_API_KEY` and `DATABASE_URL` in the Vercel project, then deploy with `vercel --prod`. Never commit real credentials.

## Problem-solving approach

The team split P12 into deterministic financial rules and user-facing workflows. Money is stored as integer paisa, monthly analysis is derived from the active ledger date, forecasts expose the exact category rule and wait for a useful sample before extrapolating, and DPS interest follows the specified monthly half-up rounding. Published fixtures and targeted browser regression flows were used to validate load/reset, add/edit/delete, receipt correction, forecasts, goals and responsive layout.

## Technology used

- **Frontend:** Vanilla HTML, CSS and JavaScript; no framework or runtime dependency
- **Backend:** Vercel Node.js serverless functions using native `fetch`
- **Database:** Neon Postgres through its HTTP SQL API
- **Deployment:** Vercel
- **Other material tools:** OpenRouter vision API for receipt reading; browser/localStorage cache and offline fallback

See [`LICENSES.md`](LICENSES.md) for third-party materials and AI disclosure.

## Team contributions

| Registered member | GitHub username | Major contribution | Evidence |
|---|---|---|---|
| Tanvir | `tanvirahmodrafi` | Designed and implemented the complete product: ledger state and calculations, responsive UI, receipt OCR workflow, Neon persistence, forecast/insights, savings/DPS logic, exports, accessibility/safety hardening, deployment and testing | `app.js`, `index.html`, `style.css`, `api/ocr.js`, `api/ledger.js`, `FUNCTIONALITY.md`; repository commits by `tanvirahmodrafi` |

Commit count alone does not represent contribution.

## AI usage

- **Claude Code (Anthropic):** assisted with implementation, refactoring and documentation. Output was reviewed against P12 rules, syntax-checked and exercised in browser workflows.
- **OpenAI ChatGPT / Codex:** assisted with visual asset generation, code auditing, safety/accessibility fixes and submission documentation. Changes were reviewed through diffs, syntax checks and automated browser regressions.
- **OpenRouter vision models (Google Gemini 2.5 Flash Lite / Flash):** power receipt-field extraction at runtime. Detected values are shown to the user and remain editable before saving; readable and failed-scan paths were tested.

## Major design decisions

- **Integer paisa throughout:** prevents floating-point currency drift and supports exact DPS half-up rounding.
- **Explainable deterministic forecasts:** every category exposes its method and inputs; run-rate extrapolation requires day 7 and at least three category transactions to avoid alarming projections from one early expense.
- **User correction before OCR save:** receipt AI only prefills the form and never creates a transaction automatically.
- **Anonymous browser ledger:** a generated browser ID syncs to Neon while localStorage provides immediate loading and an offline fallback, avoiding account setup during evaluation.
- **No frontend dependencies:** keeps the judged source small, auditable and runnable with a basic static server.

## Known limitations

- There are no user accounts; clearing browser storage or changing browsers creates a different anonymous ledger.
- Receipt reading requires the configured external vision service and network access; manual entry remains available if it fails.
- Savings pockets model a forward plan, not historical deposits or withdrawals.
- Existing merchant names are normalized case-insensitively, but spelling mistakes still require user correction.
- Arbitrary fixture JSON is not uploaded directly; judges can use the 25 bundled cases or enter equivalent hidden-case values through the forms.

## Repository records

- [`EVENT.md`](EVENT.md) — event start code and pre-event-material declaration
- [`evaluation-manifest.json`](evaluation-manifest.json) — structured judging evidence
- [`LICENSES.md`](LICENSES.md) — frameworks, services, templates, assets and AI disclosure
