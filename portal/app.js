const DATA_URL = "../data/latest_bj_scan.json";

let activeFilter = "all";
let scanData = null;

const fallbackData = { schema_version: "course_rules_v1", generatedAt: "", dataDate: "", article: {}, comparison: {}, sourceNotes: ["No current course-rules export."], candidates: [] };
const labels = {
  entry_confirmed: "Entry confirmed", watchlist: "Watchlist", needs_evidence: "Needs evidence",
  not_eligible: "Not eligible", unavailable: "Unavailable", pass: "Pass", fail: "Fail",
  unknown: "Unknown", pending: "Pending", observed: "Observed",
};

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    scanData = await response.json();
  } catch (error) {
    scanData = window.BJ_SCAN_DATA || fallbackData;
  }
  render();
}

function render() {
  const article = scanData.article || {};
  document.querySelector("#runMeta").textContent = `Generated: ${formatDate(scanData.generatedAt)} | Data date: ${scanData.dataDate || "n/a"} | ${scanData.schema_version || "legacy"}`;
  document.querySelector("#articleLine").innerHTML = `Latest article: <a href="${h(article.url)}" target="_blank" rel="noreferrer">${h(article.date)} - ${h(article.title)}</a>`;
  const notes = Array.isArray(scanData.sourceNotes) ? scanData.sourceNotes.join(" ") : scanData.sourceNotes;
  document.querySelector("#sourceNotes").textContent = notes || scanData.comparison?.method || "-";
  renderSummary();
  renderCards();
  renderTable();
}

function renderSummary() {
  const candidates = scanData.candidates || [];
  const metrics = [
    ["Entry confirmed", candidates.filter((item) => item.lesson3?.overallStatus === "entry_confirmed").length, "Daily close model"],
    ["Watchlist", candidates.filter((item) => item.lesson3?.overallStatus === "watchlist").length, "Awaiting trigger"],
    ["Needs evidence", candidates.filter((item) => item.lesson3?.overallStatus === "needs_evidence").length, "Strict Unknown policy"],
    ["Not eligible", candidates.filter((item) => item.lesson3?.overallStatus === "not_eligible").length, "Course gate failed"],
  ];
  document.querySelector("#summaryGrid").innerHTML = metrics.map(([label, value, hint]) => `<article class="metric"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></article>`).join("");
}

function filteredCandidates() {
  const candidates = scanData.candidates || [];
  if (activeFilter === "new") return candidates.filter((item) => item.status === "new_watchlist");
  if (activeFilter === "stage2") return candidates.filter((item) => item.lesson3?.stage2?.overall === "pass");
  if (activeFilter === "actionable") return candidates.filter((item) => item.lesson3?.overallStatus === "entry_confirmed");
  return candidates;
}

function statusBadge(value) {
  const tone = value === "pass" || value === "entry_confirmed" ? "green" : value === "fail" || value === "not_eligible" ? "red" : "amber";
  return `<span class="badge ${tone}">${h(labels[value] || value || "Unknown")}</span>`;
}

function renderChecks(checks) {
  return (checks || []).map((item) => `<div><strong>${h(item.label)}:</strong> ${h(labels[item.status] || item.status)} · ${h(item.evidence)}</div>`).join("");
}

function chartUrl(value) {
  return value ? `../${String(value).replace(/^\.\//, "")}` : "";
}

function renderCards() {
  const grid = document.querySelector("#candidateGrid");
  const candidates = filteredCandidates();
  if (!candidates.length) { grid.innerHTML = `<div class="empty">No candidates match this course-rule filter.</div>`; return; }
  grid.innerHTML = candidates.map((item) => {
    const lesson = item.lesson3 || {};
    const plan = item.lesson4ModelPlan || {};
    const indicators = lesson.stage2?.indicators || {};
    return `<article class="card"><div class="card-head"><div><div class="ticker">${h(item.ticker)}</div><div class="company">${h(item.company || "")}</div></div>${statusBadge(lesson.overallStatus)}</div>
      <div class="badge-row">${statusBadge(lesson.stage2?.overall)}<span class="badge blue">${h(lesson.pattern?.candidateType || "No pattern candidate")}</span></div>
      <p class="evidence"><strong>Evidence:</strong> ${h(item.evidenceDate || "-")} | ${h(item.evidenceOrigin || "-")}</p>
      <div class="levels"><div class="level"><span>Current</span><strong>${priceText(indicators.currentPrice)}</strong></div><div class="level"><span>Pivot</span><strong>${priceText(lesson.pivot)}</strong></div><div class="level"><span>Model stop</span><strong>${priceText(plan.initialStop)} (${pctText(plan.stopDistancePct)})</strong></div></div>
      <div class="trade-plan"><div class="level"><span>1R</span><strong>${priceText(plan.targets?.oneR)}</strong></div><div class="level"><span>2R</span><strong>${priceText(plan.targets?.twoR)}</strong></div><div class="level"><span>3R</span><strong>${priceText(plan.targets?.threeR)}</strong></div><div class="level"><span>Max Risk</span><strong>USD250</strong></div><div class="level"><span>Qty</span><strong>${valueOrDash(plan.quantitySuggested)}</strong></div><div class="level"><span>Allocation</span><strong>${h(plan.targets?.partialExitAllocation || "Unknown")}</strong></div></div>
      <div class="analysis-list"><div><strong>Stage 2:</strong> ${h(labels[lesson.stage2?.overall] || "Unknown")}</div>${renderChecks(lesson.stage2?.checks)}<div><strong>Buy methods:</strong></div>${renderChecks(lesson.entryMethods)}<div><strong>Sell into Weakness:</strong> ${h(plan.sellIntoWeakness?.courseUse || plan.reason || "Unavailable")}</div><div><strong>Sell into Strength:</strong> ${h(plan.sellIntoStrength?.courseUse || plan.reason || "Unavailable")}</div></div>
      <p class="evidence">${h(item.articleEvidence || "")}</p><p class="evidence">${h(item.chartEvidence || "")}</p><div class="action">${h(lesson.overallLabel || "Unavailable")}</div><p class="caveat">${h((lesson.reasons || []).join(" "))}</p>${item.chartUrl ? `<a class="chart-link" href="${h(chartUrl(item.chartUrl))}" target="_blank" rel="noreferrer">Open chart evidence</a>` : ""}</article>`;
  }).join("");
}

function renderTable() {
  const rows = filteredCandidates();
  if (!rows.length) { document.querySelector("#candidateTable").innerHTML = `<tr><td colspan="11">No candidates match this filter.</td></tr>`; return; }
  document.querySelector("#candidateTable").innerHTML = rows.map((item) => {
    const lesson = item.lesson3 || {};
    const plan = item.lesson4ModelPlan || {};
    const indicators = lesson.stage2?.indicators || {};
    return `<tr><td><strong>${h(item.ticker)}</strong><br>${h(item.company || "")}</td><td>${statusBadge(lesson.overallStatus)}</td><td>${statusBadge(lesson.stage2?.overall)}</td><td>${h(lesson.pattern?.candidateType || "-")}<br>${h(lesson.pattern?.confirmation || "unknown")}</td><td>${priceText(indicators.currentPrice)}</td><td>${priceText(lesson.pivot)}</td><td>${pctText(lesson.distanceToPivotPct)}</td><td>${priceText(plan.initialStop)}<br>${pctText(plan.stopDistancePct)}</td><td>${priceText(plan.targets?.twoR)} / ${priceText(plan.targets?.threeR)}</td><td>${valueOrDash(plan.quantitySuggested)}</td><td>${h((lesson.reasons || []).join(" "))}</td></tr>`;
  }).join("");
}

function formatDate(value) { if (!value) return "n/a"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-HK", { hour12: false }); }
function valueOrDash(value) { return value === undefined || value === null || value === "" ? "-" : value; }
function h(value) { return String(value === undefined || value === null ? "" : value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function priceText(value) { if (value === undefined || value === null || value === "") return "-"; const number = Number(value); return Number.isFinite(number) ? number.toFixed(number >= 100 ? 2 : 3) : value; }
function pctText(value) { if (value === undefined || value === null || value === "") return "-"; const number = Number(value); return Number.isFinite(number) ? `${number.toFixed(1)}%` : value; }

document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.filter; document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active")); button.classList.add("active"); renderCards(); renderTable(); }));
loadData();
