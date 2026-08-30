"use strict";
/* Punji — P12 Personal Ledger Manager. All money handled as integer paisa. */

const CATEGORIES = ["Clothing","Education","Entertainment","Food","Groceries","Health","Mobile","Rent","Transport","Utilities"];
const CAT_EMOJI = { Clothing:"👕", Education:"📚", Entertainment:"🎬", Food:"🍜", Groceries:"🛒", Health:"💊", Mobile:"📱", Rent:"🏠", Transport:"🚌", Utilities:"💡" };
const catIcon = (c) => CAT_EMOJI[c] || "🧾";
const LS_KEY = "p12-ledger-v1";
// When served from a plain file server (local dev), the serverless functions
// don't exist locally — fall back to the production API.
const API_BASE = location.hostname.endsWith("vercel.app") ? "" : "https://lsh26-t063-p12.vercel.app";

// ---------- money helpers (integer paisa) ----------
function toPaisa(x) {
  if (x == null || x === "") return null;
  const n = Number(String(x).replace(/[^\d.-]/g, ""));
  if (!isFinite(n)) return null;
  return Math.round(n * 100);
}
function fmt(p) {
  const neg = p < 0;
  const abs = Math.abs(p);
  const taka = Math.floor(abs / 100);
  const paisa = abs % 100;
  let s = taka.toLocaleString("en-IN");
  if (paisa) s += "." + String(paisa).padStart(2, "0");
  return (neg ? "−৳" : "৳") + s;
}
// interest = bal * annualRate / 12 / 100, rounded HALF UP to the paisa.
// rateBp = rate * 100 as integer, so interest = bal*rateBp / 120000 exactly.
function dpsInterest(balPaisa, rateBp) {
  const num = balPaisa * rateBp;
  const den = 120000;
  return Math.floor((2 * num + den) / (2 * den));
}

// ---------- date helpers ----------
function ym(dateStr) { return dateStr.slice(0, 7); }
function prevMonth(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}
function addMonths(ymStr, n) {
  const [y, m] = ymStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
function daysInMonth(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function monthName(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// ---------- state ----------
let state = {
  caseId: null,
  today: new Date().toISOString().slice(0, 10),
  salary_p: 0,
  dpsRate: 9.0,
  expenses: [],   // {id, date, category, shop, amount_p}
  pockets: [],    // {id, name, item, target_p, contrib_p}
};
let nextId = 1;

// each browser gets its own ledger id, synced to Neon Postgres via /api/ledger
const syncId = (() => {
  let id = localStorage.getItem("p12-sync-id");
  if (!id) { id = "L" + Math.random().toString(36).slice(2, 12); localStorage.setItem("p12-sync-id", id); }
  return id;
})();
let syncTimer = null;
let editingId = null;
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function setSyncStatus(txt) {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.textContent = txt.replace("☁ ", "");
  el.dataset.state = txt.includes("offline") ? "off" : "ok";
}
function pushToCloud() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      setSyncStatus("☁ saving…");
      const r = await fetch(API_BASE + "/api/ledger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: syncId, state: { state, nextId } }),
      });
      setSyncStatus(r.ok ? "☁ saved" : "☁ offline");
    } catch (e) { setSyncStatus("☁ offline"); }
  }, 800);
}
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify({ state, nextId }));
  pushToCloud();
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const d = JSON.parse(raw); state = d.state; nextId = d.nextId || 1; }
  } catch (e) { /* fresh start */ }
}

function loadCase(c) {
  state = {
    caseId: c.case_id,
    today: c.today,
    salary_p: toPaisa(c.salary_bdt),
    dpsRate: Number(c.dps_annual_rate_percent),
    expenses: c.expenses.map(e => ({ id: e.id, date: e.date, category: e.category, shop: e.shop, amount_p: toPaisa(e.amount_bdt) })),
    pockets: (c.pockets || []).map(p => ({ id: p.id, name: p.name, item: p.item, target_p: toPaisa(p.target_bdt), contrib_p: toPaisa(p.monthly_contribution_bdt) })),
  };
  nextId = 1000;
  save();
  renderAll();
}

// ---------- analytics ----------
function analyze() {
  const thisM = ym(state.today);
  const lastM = prevMonth(thisM);
  const dim = daysInMonth(thisM);
  const dayOf = Number(state.today.slice(8, 10));

  const byCat = {};
  let totalThis = 0, totalLast = 0;
  for (const e of state.expenses) {
    const m = ym(e.date);
    if (m !== thisM && m !== lastM) continue;
    if (!byCat[e.category]) byCat[e.category] = { thisM: 0, lastM: 0, thisCount: 0 };
    if (m === thisM && e.date <= state.today) { byCat[e.category].thisM += e.amount_p; byCat[e.category].thisCount++; totalThis += e.amount_p; }
    if (m === lastM) { byCat[e.category].lastM += e.amount_p; totalLast += e.amount_p; }
  }

  // Forecast per category:
  //  - category seen last month: projected = max(spent so far, avg(last month total, this-month run-rate))
  //  - new category this month:  projected = run-rate extrapolation
  const forecast = {};
  let expectedMore = 0;
  for (const [cat, v] of Object.entries(byCat)) {
    const runRate = dayOf > 0 ? Math.round((v.thisM * dim) / dayOf) : v.thisM;
    const lumpy = v.thisCount < 3; // few large payments (Rent, Utilities): don't run-rate extrapolate
    let projected;
    if (v.lastM > 0 && v.thisM > 0) {
      projected = lumpy ? Math.max(v.thisM, v.lastM) : Math.max(v.thisM, Math.round((v.lastM + runRate) / 2));
    }
    else if (v.lastM > 0) projected = v.lastM;           // not spent yet this month, expect a repeat
    else projected = runRate;                             // new category, extrapolate
    const more = Math.max(0, projected - v.thisM);
    forecast[cat] = { ...v, projected, more };
    expectedMore += more;
  }

  const projectedTotal = totalThis + expectedMore;
  const leftover = state.salary_p - projectedTotal;

  const thisExpenses = state.expenses.filter(e => ym(e.date) === thisM && e.date <= state.today);
  const largest = [...thisExpenses].sort((a, b) => b.amount_p - a.amount_p).slice(0, 5);

  return { thisM, lastM, dim, dayOf, byCat, forecast, totalThis, totalLast, expectedMore, projectedTotal, leftover, largest };
}

function buildInsights(a) {
  const out = []; // {text, cls}
  const pace = a.dayOf / a.dim;

  // 1. biggest pace increase vs last month
  let bestCat = null, bestDelta = 0;
  for (const [cat, v] of Object.entries(a.byCat)) {
    if (v.lastM <= 0 || v.thisCount < 2) continue; // one-shot payments aren't a "pace"
    const lastByNow = Math.round(v.lastM * pace);
    const delta = v.thisM - lastByNow;
    if (delta > bestDelta) { bestDelta = delta; bestCat = { cat, v, lastByNow }; }
  }
  if (bestCat) {
    out.push({ cls: "warn", text: `<strong>${bestCat.cat}</strong> is running hot: ${fmt(bestCat.v.thisM)} spent by day ${a.dayOf}, versus about ${fmt(bestCat.lastByNow)} at the same point last month — <strong>${fmt(bestDelta)} ahead of pace</strong>.` });
  }
  // 2. biggest drop vs last month
  let dropCat = null, dropDelta = 0;
  for (const [cat, v] of Object.entries(a.byCat)) {
    if (v.lastM <= 0 || v.thisM <= 0) continue; // not-yet-paid isn't "saving"
    const lastByNow = Math.round(v.lastM * pace);
    const delta = lastByNow - v.thisM;
    if (delta > dropDelta && v.lastM > a.totalLast * 0.05) { dropDelta = delta; dropCat = { cat, v, lastByNow }; }
  }
  if (dropCat) {
    out.push({ cls: "", text: `You're saving on <strong>${dropCat.cat}</strong>: only ${fmt(dropCat.v.thisM)} so far, about <strong>${fmt(dropDelta)} less</strong> than the ${fmt(dropCat.lastByNow)} you'd spent by day ${a.dayOf} last month.` });
  }
  // 3. largest single expense
  if (a.largest.length) {
    const L = a.largest[0];
    const pct = state.salary_p > 0 ? Math.round((L.amount_p * 100) / state.salary_p) : 0;
    out.push({ cls: "", text: `Your single biggest expense this month is <strong>${fmt(L.amount_p)}</strong> at <strong>${L.shop}</strong> (${L.category}) — ${pct}% of your ${fmt(state.salary_p)} salary.` });
  }
  // 4. top category share
  const cats = Object.entries(a.byCat).filter(([, v]) => v.thisM > 0).sort((x, y) => y[1].thisM - x[1].thisM);
  if (cats.length && a.totalThis > 0) {
    const [cat, v] = cats[0];
    const pct = Math.round((v.thisM * 100) / a.totalThis);
    out.push({ cls: "", text: `<strong>${cat}</strong> is your largest category at ${fmt(v.thisM)} — <strong>${pct}%</strong> of everything spent this month.` });
  }
  // 5. pocket affordability
  const totalContrib = state.pockets.reduce((s, p) => s + p.contrib_p, 0);
  if (totalContrib > 0) {
    if (a.leftover >= totalContrib) {
      out.push({ cls: "", text: `Your ${state.pockets.length} savings pocket(s) need <strong>${fmt(totalContrib)}</strong>/month and the forecast leaves you <strong>${fmt(a.leftover)}</strong> — the plan is fully funded with ${fmt(a.leftover - totalContrib)} to spare.` });
    } else if (a.leftover > 0) {
      out.push({ cls: "warn", text: `Your pockets need <strong>${fmt(totalContrib)}</strong>/month but the forecast leaves only <strong>${fmt(a.leftover)}</strong> — you're <strong>${fmt(totalContrib - a.leftover)} short</strong>; completion dates below are adjusted for that.` });
    } else {
      out.push({ cls: "bad", text: `The forecast ends the month <strong>${fmt(-a.leftover)} in the red</strong>, so the ${fmt(totalContrib)}/month pocket plan can't be funded at the current spending pace.` });
    }
  }
  // 6. month-end position
  if (a.leftover < 0) {
    out.push({ cls: "bad", text: `At the current pace you'll end ${monthName(a.thisM)} about <strong>${fmt(-a.leftover)} short</strong>: projected spend ${fmt(a.projectedTotal)} vs salary ${fmt(state.salary_p)}.` });
  }
  return out.slice(0, 6);
}

// pocket math
function pocketPlan(p, a) {
  const rateBp = Math.round(state.dpsRate * 100);
  const totalContrib = state.pockets.reduce((s, q) => s + q.contrib_p, 0);
  let effContrib = p.contrib_p;
  let note = null, noteCls = "ok";
  if (a.leftover <= 0) {
    note = "Forecast leaves nothing to save this month — dates assume you restore the planned contribution.";
    noteCls = "bad";
  } else if (a.leftover < totalContrib) {
    effContrib = Math.max(1, Math.floor((p.contrib_p * a.leftover) / totalContrib));
    note = `Forecast leftover ${fmt(a.leftover)} can't cover all pockets — this one's affordable share is ${fmt(effContrib)}/month, so the date is pushed out.`;
    noteCls = "warn";
  } else {
    note = `Fully affordable: forecast leftover ${fmt(a.leftover)} covers the ${fmt(totalContrib)}/month total plan.`;
  }

  const planMonths = Math.ceil(p.target_p / p.contrib_p);
  const doneYm = addMonths(a.thisM, planMonths);

  // forecast-adjusted pace, folded into the note (kept sane for display)
  if (effContrib < p.contrib_p) {
    const adjMonths = Math.ceil(p.target_p / effContrib);
    const adjLabel = adjMonths > 120
      ? "over 10 years at that pace"
      : `${monthName(addMonths(a.thisM, adjMonths))} (${adjMonths} mo)`;
    note += ` At that pace this goal lands ${adjLabel}.`;
  }

  // DPS simulation over the plan horizon with the planned contribution
  let bal = 0, dpsMonthsToTarget = null, totalInterest = 0;
  for (let m = 1; m <= Math.max(planMonths, 1); m++) {
    bal += p.contrib_p;
    const i = dpsInterest(bal, rateBp);
    bal += i; totalInterest += i;
    if (dpsMonthsToTarget === null && bal >= p.target_p) dpsMonthsToTarget = m;
  }
  return { planMonths, adjMonths: planMonths, doneYm, dpsFinal: bal, dpsInterestTotal: totalInterest, dpsMonthsToTarget, note, noteCls, effContrib };
}

// ---------- rendering ----------
const $ = (s) => document.querySelector(s);

function statTile(label, value, sub, cls = "") {
  return `<div class="stat"><div class="label">${label}</div><div class="value ${cls}">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
}

function renderDashboard(a) {
  const spentPct = state.salary_p > 0 ? Math.round((a.totalThis * 100) / state.salary_p) : 0;
  const remaining = state.salary_p - a.totalThis;
  const deltaVsLast = a.totalLast > 0 ? a.totalThis - Math.round(a.totalLast * (a.dayOf / a.dim)) : null;
  $("#statRow").innerHTML =
    statTile(`Spent in ${monthName(a.thisM)}`, fmt(a.totalThis), `${spentPct}% of ${fmt(state.salary_p)} salary`) +
    statTile("Money left (so far)", fmt(remaining), `salary minus spend to date`, remaining >= 0 ? "good" : "bad") +
    statTile("Last month total", fmt(a.totalLast), monthName(a.lastM)) +
    (deltaVsLast === null ? "" :
      statTile("Pace vs last month", (deltaVsLast >= 0 ? "▲ " : "▼ ") + fmt(Math.abs(deltaVsLast)),
        deltaVsLast >= 0 ? "ahead of last month's pace" : "behind last month's pace",
        deltaVsLast > 0 ? "bad" : "good"));

  $("#catMonthLabel").textContent = `— ${monthName(a.thisM)} vs ${monthName(a.lastM)}`;
  const cats = Object.entries(a.byCat).sort((x, y) => (y[1].thisM) - (x[1].thisM));
  const maxV = Math.max(1, ...cats.map(([, v]) => Math.max(v.thisM, v.lastM)));
  $("#catChart").innerHTML = cats.map(([cat, v]) => {
    const w1 = Math.max(0.5, (v.thisM * 100) / maxV);
    const w0 = Math.max(0.5, (v.lastM * 100) / maxV);
    return `<div class="bar-group"><div class="cat">${catIcon(cat)} ${cat}</div><div class="bar-pair">
      <div class="bar this" style="width:${w1}%"><span class="bar-label">${fmt(v.thisM)}</span></div>
      <div class="bar last" style="width:${w0}%"></div>
    </div></div>`;
  }).join("") || `<p class="muted">No expenses yet — add one or load a sample case.</p>`;

  $("#topExpenses tbody").innerHTML = a.largest.map(e =>
    `<tr><td>${e.date}</td><td>${catIcon(e.category)} ${e.category}</td><td>${e.shop}</td><td class="num">${fmt(e.amount_p)}</td></tr>`
  ).join("") || `<tr><td class="muted">Nothing this month yet.</td></tr>`;

  renderTrend(a);

  const all = [...state.expenses].sort((x, y) => y.date.localeCompare(x.date));
  $("#expCount").textContent = `(${all.length})`;
  $("#expTable tbody").innerHTML = all.map(e =>
    `<tr><td>${e.date}</td><td>${catIcon(e.category)} ${e.category}</td><td>${e.shop}</td><td class="num">${fmt(e.amount_p)}</td>
     <td><button class="edit-btn" data-edit="${e.id}" title="edit">✎</button>
         <button class="del-btn" data-del="${e.id}" title="delete">✕</button></td></tr>`
  ).join("");
}

// cumulative daily spend, this month vs last, as an inline SVG line chart
function renderTrend(a) {
  const el = $("#trendChart");
  if (!el) return;
  const cum = (ymStr, upToDay) => {
    const days = daysInMonth(ymStr);
    const daily = new Array(days + 1).fill(0);
    for (const e of state.expenses) {
      if (ym(e.date) !== ymStr) continue;
      const d = Number(e.date.slice(8, 10));
      if (upToDay && d > upToDay) continue;
      daily[d] += e.amount_p;
    }
    const out = [];
    let run = 0;
    const lim = upToDay || days;
    for (let d = 1; d <= lim; d++) { run += daily[d]; out.push(run); }
    return out;
  };
  const thisSeries = cum(a.thisM, a.dayOf);
  const lastSeries = cum(a.lastM, null);
  const maxY = Math.max(1, ...thisSeries, ...lastSeries, state.salary_p);
  const W = 560, H = 170, PAD = 8, DAYS = Math.max(a.dim, lastSeries.length);
  const x = (d) => PAD + ((d - 1) / (DAYS - 1)) * (W - 2 * PAD);
  const y = (v) => H - PAD - (v / maxY) * (H - 2 * PAD);
  const path = (s) => s.map((v, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const salaryY = y(state.salary_p).toFixed(1);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cumulative spending, this month vs last month">
    <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="var(--baseline)" stroke-width="1"/>
    <line x1="${PAD}" y1="${salaryY}" x2="${W - PAD}" y2="${salaryY}" stroke="var(--baseline)" stroke-width="1" stroke-dasharray="4 4"/>
    <text x="${W - PAD}" y="${Number(salaryY) < 14 ? Number(salaryY) + 12 : Number(salaryY) - 4}" text-anchor="end" font-size="10" fill="var(--muted)">salary ${fmt(state.salary_p)}</text>
    <path d="${path(lastSeries)}" fill="none" stroke="var(--series-0)" stroke-width="2" stroke-linejoin="round"/>
    <path d="${path(thisSeries)}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round"/>
    ${thisSeries.length ? `<circle cx="${x(thisSeries.length)}" cy="${y(thisSeries[thisSeries.length - 1])}" r="3.5" fill="var(--series-1)"/>
    <text x="${Math.min(x(thisSeries.length) + 6, W - 70)}" y="${Math.max(12, y(thisSeries[thisSeries.length - 1]) - 6)}" font-size="10" fill="var(--ink-2)">${fmt(thisSeries[thisSeries.length - 1])}</text>` : ""}
    <text x="${PAD}" y="${H - PAD + 0}" font-size="0"> </text>
  </svg>
  <div class="muted" style="display:flex;justify-content:space-between"><span>day 1</span><span>day ${DAYS}</span></div>`;
}

function renderForecast(a) {
  $("#forecastStats").innerHTML =
    statTile("Spent so far", fmt(a.totalThis), `day ${a.dayOf} of ${a.dim}, ${monthName(a.thisM)}`) +
    statTile("Expected rest of month", fmt(a.expectedMore), "from category forecasts") +
    statTile("Projected month total", fmt(a.projectedTotal), `vs ${fmt(state.salary_p)} salary`) +
    statTile(a.leftover >= 0 ? "Expected left at month end" : "Expected SHORT at month end",
      fmt(Math.abs(a.leftover)), a.leftover >= 0 ? "on track" : "over salary", a.leftover >= 0 ? "good" : "bad");

  $("#insightsList").innerHTML = buildInsights(a).map(i => `<li class="${i.cls}">${i.text}</li>`).join("")
    || `<li>Add expenses (or load a sample case) to get insights.</li>`;

  const rows = Object.entries(a.forecast).sort((x, y) => y[1].projected - x[1].projected);
  $("#forecastTable tbody").innerHTML = rows.map(([cat, v]) =>
    `<tr><td>${cat}</td><td class="num">${fmt(v.thisM)}</td><td class="num">${fmt(v.lastM)}</td>
     <td class="num">${fmt(v.more)}</td><td class="num">${fmt(v.projected)}</td></tr>`).join("");
  $("#forecastMethod").textContent =
    `Method: variable categories (3+ transactions) project to max(spent so far, average of last month's total and this month's run-rate — spent ÷ ${a.dayOf} days × ${a.dim} days). One-shot categories like Rent project to max(spent so far, last month). Categories seen only last month are expected to repeat; new categories use the run-rate.`;
}

function renderPockets(a) {
  $("#dpsRate").value = state.dpsRate;
  $("#pocketCards").innerHTML = state.pockets.map(p => {
    const plan = pocketPlan(p, a);
    const savedPct = 0; // pockets start empty in this model
    const dpsBeat = plan.dpsMonthsToTarget && plan.dpsMonthsToTarget < plan.adjMonths;
    return `<div class="pocket">
      <div class="pocket-head"><h3>🎯 ${p.name}</h3><span class="item">${p.item}</span>
        <button class="del-btn" data-delpocket="${p.id}" title="delete pocket">✕</button></div>
      <div class="progress"><div style="width:${savedPct}%"></div></div>
      <div class="pocket-grid">
        <div><div class="k">Target</div><div class="v">${fmt(p.target_p)}</div></div>
        <div><div class="k">Monthly contribution</div><div class="v">${fmt(p.contrib_p)}</div></div>
        <div><div class="k">Expected completion</div><div class="v">${monthName(plan.doneYm)} (${plan.adjMonths} mo)</div></div>
        <div><div class="k">DPS @ ${state.dpsRate}% — value after ${plan.adjMonths} mo</div><div class="v">${fmt(plan.dpsFinal)}</div></div>
        <div><div class="k">DPS interest earned</div><div class="v">+${fmt(plan.dpsInterestTotal)}</div></div>
        <div><div class="k">DPS reaches target in</div><div class="v">${plan.dpsMonthsToTarget ? plan.dpsMonthsToTarget + " mo (" + monthName(addMonths(a.thisM, plan.dpsMonthsToTarget)) + ")" : "beyond horizon"}</div></div>
      </div>
      ${dpsBeat ? `<div class="note ok">A DPS gets you there ${plan.adjMonths - plan.dpsMonthsToTarget} month(s) earlier than a plain pocket.</div>` : ""}
      <div class="note ${plan.noteCls}">${plan.note}</div>
    </div>`;
  }).join("") || `<div class="card muted">No pockets yet — create one above or load a sample case.</div>`;
}

function renderSettings() {
  $("#salaryInput").value = (state.salary_p / 100).toFixed(2);
  $("#todayInput").value = state.today;
}

function renderAll() {
  const a = analyze();
  renderDashboard(a);
  renderForecast(a);
  renderPockets(a);
  renderSettings();
}

// ---------- events ----------
function setupEvents() {
  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tabpane").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    $("#tab-" + t.dataset.tab).classList.add("active");
  }));

  $("#catList").innerHTML = CATEGORIES.map(c => `<option value="${c}">`).join("");

  $("#expForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const rec = {
      date: $("#expDate").value,
      category: $("#expCategory").value.trim(),
      shop: $("#expShop").value.trim(),
      amount_p: toPaisa($("#expAmount").value),
    };
    if (editingId) {
      const e = state.expenses.find(x => x.id === editingId);
      if (e) Object.assign(e, rec);
      editingId = null;
      $("#expSubmitBtn").textContent = "Save expense";
    } else {
      state.expenses.push({ id: "U" + (nextId++), ...rec });
    }
    save(); renderAll();
    $("#saveMsg").textContent = "✓ Saved.";
    setTimeout(() => { $("#saveMsg").textContent = ""; }, 2500);
    ev.target.reset();
    $("#ocrResult").classList.add("hidden");
    $("#receiptPreviewWrap").classList.add("hidden");
  });

  $("#pocketForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    state.pockets.push({
      id: "SP-U" + (nextId++),
      name: $("#pkName").value.trim(),
      item: $("#pkItem").value.trim(),
      target_p: toPaisa($("#pkTarget").value),
      contrib_p: toPaisa($("#pkContrib").value),
    });
    save(); renderAll(); ev.target.reset();
  });

  $("#dpsRate").addEventListener("change", () => { state.dpsRate = Number($("#dpsRate").value) || 0; save(); renderAll(); });
  $("#salaryInput").addEventListener("change", () => { state.salary_p = toPaisa($("#salaryInput").value) || 0; save(); renderAll(); });
  $("#todayInput").addEventListener("change", () => { state.today = $("#todayInput").value; save(); renderAll(); });

  document.body.addEventListener("click", (ev) => {
    const del = ev.target.dataset.del;
    const delP = ev.target.dataset.delpocket;
    const edit = ev.target.dataset.edit;
    if (del) { state.expenses = state.expenses.filter(e => e.id !== del); save(); renderAll(); }
    if (delP) { state.pockets = state.pockets.filter(p => p.id !== delP); save(); renderAll(); }
    if (edit) {
      const e = state.expenses.find(x => x.id === edit);
      if (e) {
        editingId = edit;
        $("#expDate").value = e.date;
        $("#expCategory").value = e.category;
        $("#expShop").value = e.shop;
        $("#expAmount").value = (e.amount_p / 100).toFixed(2);
        $("#expSubmitBtn").textContent = "Update expense";
        document.querySelector('[data-tab="add"]').click();
      }
    }
  });

  $("#exportJson").addEventListener("click", () => {
    download("punji-ledger.json", JSON.stringify({ state, nextId }, null, 2), "application/json");
  });
  $("#exportCsv").addEventListener("click", () => {
    const rows = [["id","date","category","shop","amount_bdt"],
      ...state.expenses.map(e => [e.id, e.date, e.category, e.shop, (e.amount_p / 100).toFixed(2)])];
    download("punji-expenses.csv", rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  });

  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Clear all data?")) return;
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem("p12-sync-id"); // fresh cloud ledger too
    location.reload();
  });

  // receipt OCR
  $("#receiptFile").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    // downscale + JPEG-compress so large phone photos stay under upload limits
    const dataUrl = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        res(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
    $("#receiptPreview").src = dataUrl;
    $("#receiptPreviewWrap").classList.remove("hidden");
    $("#ocrStatus").textContent = "Reading receipt…";
    $("#ocrResult").classList.add("hidden");
    try {
      const resp = await fetch(API_BASE + "/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("json")) throw new Error("API returned " + resp.status + " (not JSON) — is the API deployed/reachable?");
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error || "OCR failed");
      $("#ocrStatus").textContent = "";
      $("#ocrReadList").innerHTML = [
        `Shop: <strong>${d.shop ?? "— not readable —"}</strong>`,
        `Date: <strong>${d.date ?? "— not readable —"}</strong>`,
        `Amount: <strong>${d.amount_bdt != null ? "৳" + d.amount_bdt : "— not readable —"}</strong>`,
        `Category guess: <strong>${d.category ?? "—"}</strong>`,
      ].map(x => `<li>${x}</li>`).join("");
      $("#ocrResult").classList.remove("hidden");
      if (d.shop) $("#expShop").value = d.shop;
      if (d.date) $("#expDate").value = d.date;
      if (d.amount_bdt != null) $("#expAmount").value = d.amount_bdt;
      if (d.category) $("#expCategory").value = d.category;
    } catch (e) {
      $("#ocrStatus").textContent = "⚠ Could not read the receipt (" + e.message + "). Fill the form manually.";
    }
  });

  // sample cases
  fetch("data/P12_personal_ledger_public.json")
    .then(r => r.json())
    .then(d => {
      window.__cases = d.cases;
      $("#caseSelect").innerHTML += d.cases.map((c, i) =>
        `<option value="${i}">${c.case_id} — salary ${c.salary_bdt}</option>`).join("");
    })
    .catch(() => { /* sample data optional */ });
  $("#caseSelect").addEventListener("change", (ev) => {
    const i = ev.target.value;
    if (i !== "" && window.__cases) loadCase(window.__cases[Number(i)]);
  });
}

async function init() {
  load();               // localStorage first — instant paint
  setupEvents();
  renderAll();
  try {                 // then prefer the cloud copy if one exists
    const r = await fetch(`${API_BASE}/api/ledger?id=${syncId}`);
    if (r.ok) {
      const d = await r.json();
      if (d.state && d.state.state) {
        state = d.state.state;
        nextId = d.state.nextId || nextId;
        localStorage.setItem(LS_KEY, JSON.stringify({ state, nextId }));
        renderAll();
      }
      setSyncStatus("☁ synced");
    } else setSyncStatus("☁ offline");
  } catch (e) { setSyncStatus("☁ offline"); }
}
init();
