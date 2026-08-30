# CLAUDE.md — Punji (lsh26-t063-p12)

Hackathon submission: Lofi-stack Hackathon 2026, problem **P12 Personal Ledger Manager**, team **LSH26-T063**. Deadline-critical repo — the judged commit must exist before 22:00 on 2026-08-30, and the early-submission bonus counts from the **last** commit, so never commit without being asked.

## What this is

A BDT personal ledger web app: salary + expenses (manual or receipt-photo OCR with user correction), monthly dashboard, deterministic forecast with written insights, savings goals with exact DPS interest simulation. Read `FUNCTIONALITY.md` first — it is the complete, current reference for features, DOM hooks, data model, and computation rules.

## Stack & architecture

- **Frontend**: `index.html` + `style.css` + `app.js`. Vanilla only — no framework, no build step, **zero npm dependencies** (deliberate: LICENSES.md declares none, and event rules ban copyleft licenses; do not add libraries, CDN links, external fonts, or icon sets).
- **Backend**: two Vercel serverless functions in `api/`:
  - `ocr.js` — receipt reading via OpenRouter vision (env `OPENROUTER_API_KEY`)
  - `ledger.js` — per-browser ledger persistence in Neon Postgres via its HTTP SQL API, table `ledgers(id, state jsonb, updated_at)` (env `DATABASE_URL`)
- **Money is integer paisa everywhere.** The DPS rounding rule (half-up to the paisa) is from the challenge spec and unit-verified — never touch the arithmetic in `dpsInterest()`.
- `data/P12_personal_ledger_public.json` — organizer sample data (25 cases), wired to the sidebar "Demo case" selector.

## Commands

```bash
python3 -m http.server 8123        # local frontend (API calls fall back to production via API_BASE)
node --check app.js                # syntax check after every edit
vercel --prod --yes                # deploy (project is linked; env vars already set in Vercel)
```

Secrets live in `.env.local` (gitignored). Never print or commit them.

## Testing

Verify changes in a real browser, not by inspection. Playwright is available ad hoc:

```bash
NODE_PATH=/tmp/node_modules node <script>.mjs   # playwright@1.58.0 installed under /tmp
```

Standard battery: load demo case PUB-01 → all 5 tabs switch → add/edit/delete expense → OCR upload prefills form → forecast + insights render → pocket create/delete → exports download → 390px viewport has no horizontal overflow → zero console errors.

## Hard rules

1. **Do not rename or remove** any element id, `data-*` attribute, or JS-generated class — `FUNCTIONALITY.md` lists them all; `app.js` queries them.
2. **Do not alter computations** (forecast, insights, pockets, DPS, month logic) for presentation reasons.
3. Required submission files must stay present and accurate: `README.md`, `LICENSES.md`, `EVENT.md` (start code LSH26-8490-C900), `evaluation-manifest.json`.
4. Keep `FUNCTIONALITY.md` updated when features change.
5. Live URL https://lsh26-t063-p12.vercel.app is health-checked by judges at the deadline — after any deploy, curl the homepage and one API endpoint.
