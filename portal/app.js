const DATA_URL = "../data/latest_bj_scan.json";
const WORKFLOW_STORAGE_KEY = "ahju-signal-dashboard-daily-v1";

let activeFilter = "all";
let scanData = null;
let workflow = loadWorkflow();

const fallbackData = { schema_version: "course_rules_v2", generatedAt: "", dataDate: "", article: {}, comparison: {}, sourceNotes: ["No current course-rules export."], candidates: [] };
const labels = {
  entry_confirmed: "Entry confirmed", watchlist: "Watchlist", needs_evidence: "Needs evidence",
  not_eligible: "Not eligible", unavailable: "Unavailable", pass: "Pass", fail: "Fail",
  unknown: "Unknown", pending: "Pending", candidate: "Candidate", observed: "Observed",
};

function defaultWorkflow() { return { version: 1, reviews: [], screenSnapshots: [], researchCandidates: [] }; }
function loadWorkflow() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKFLOW_STORAGE_KEY));
    return saved && saved.version === 1 ? { ...defaultWorkflow(), ...saved } : defaultWorkflow();
  } catch { return defaultWorkflow(); }
}
function saveWorkflow() {
  localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflow));
  if (scanData) renderSummary();
  renderWorkflow();
}
function workflowId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function fieldValue(id) { return document.querySelector(`#${id}`)?.value.trim() || ""; }
function latestWorkflowReview() { return workflow.reviews[0] || null; }
function workflowLabel(review) { return review ? `${review.marketState || "未能判定"} · ${review.workflowDate || "未填日期"}` : "未記錄"; }
function copyText(value, message) {
  const done = () => { const node = document.querySelector("#workflowStorage"); if (node) node.textContent = message; };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
  else fallbackCopy(value, done);
}
function fallbackCopy(value, done) { const area = document.createElement("textarea"); area.value = value; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); done(); }

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
  renderWorkflow();
}

function renderSummary() {
  const candidates = scanData.candidates || [];
  const metrics = [
    ["Entry confirmed", candidates.filter((item) => item.lesson3?.overallStatus === "entry_confirmed").length, "Daily close model"],
    ["Watchlist", candidates.filter((item) => item.lesson3?.overallStatus === "watchlist").length, "Awaiting trigger"],
    ["Needs evidence", candidates.filter((item) => item.lesson3?.overallStatus === "needs_evidence").length, "Strict Unknown policy"],
    ["Not eligible", candidates.filter((item) => item.lesson3?.overallStatus === "not_eligible").length, "Course gate failed"],
    ["Daily review", workflowLabel(latestWorkflowReview()), "本機流程記錄"],
    ["Screen snapshots", workflow.screenSnapshots.length, "已保存快照"],
    ["Research queue", workflow.researchCandidates.length, "候選記錄"],
  ];
  document.querySelector("#summaryGrid").innerHTML = metrics.map(([label, value, hint]) => `<article class="metric"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></article>`).join("");
}

function renderWorkflow() {
  const latest = latestWorkflowReview();
  const storage = document.querySelector("#workflowStorage");
  if (storage) storage.textContent = latest ? `最近保存：${formatDate(latest.savedAt)}` : "未有本機流程記錄";
  const metrics = document.querySelector("#workflowMetrics");
  if (metrics) metrics.innerHTML = `<div><span>最新市況</span><strong>${h(latest?.marketState || "未記錄")}</strong></div><div><span>篩選快照</span><strong>${workflow.screenSnapshots.length}</strong></div><div><span>研究候選</span><strong>${workflow.researchCandidates.length}</strong></div>`;
  renderReviewList();
  renderScreenList();
  renderResearchList();
}
function renderReviewList() {
  const node = document.querySelector("#reviewList"); if (!node) return;
  node.innerHTML = workflow.reviews.length ? workflow.reviews.slice(0, 5).map((item) => `<div class="workflow-row"><div><strong>${h(workflowLabel(item))}</strong><small>${h(item.workflowTimeframe || "未選時間框架")} · ${item.closeReview ? "已完成收市後回顧" : "未完成收市後回顧"}${item.note ? ` · ${h(item.note)}` : ""}</small></div><button class="workflow-delete" type="button" data-delete="reviews" data-id="${h(item.id)}">刪除</button></div>`).join("") : `<p class="workflow-empty">尚未保存每日流程。</p>`;
}
function renderScreenList() {
  const node = document.querySelector("#screenList"); if (!node) return;
  node.innerHTML = workflow.screenSnapshots.length ? workflow.screenSnapshots.slice(0, 5).map((item) => `<div class="workflow-row"><div><strong>${h(item.name || "未命名快照")}</strong><small>${h(item.source || "未填來源")} · ${item.candidateCount === "" ? "候選數量未填" : `${h(item.candidateCount)} 隻`} · ${h(item.filters)}</small></div><button class="workflow-delete" type="button" data-delete="screenSnapshots" data-id="${h(item.id)}">刪除</button></div>`).join("") : `<p class="workflow-empty">尚未保存篩選快照。</p>`;
}
function renderResearchList() {
  const node = document.querySelector("#researchList"); if (!node) return;
  node.innerHTML = workflow.researchCandidates.length ? workflow.researchCandidates.slice(0, 8).map((item) => `<div class="workflow-row"><div><strong>${h(item.symbol)} · ${h(item.status)}</strong><small>${h(item.side)} · ${h(item.tags || "未填 Tags")} · Last EOD ${h(item.lastEodPrice || "未填")}</small></div><div class="workflow-row-actions"><button class="workflow-copy" type="button" data-copy-research="${h(item.id)}">複製 DE-0 資料</button><button class="workflow-delete" type="button" data-delete="researchCandidates" data-id="${h(item.id)}">刪除</button></div></div>`).join("") : `<p class="workflow-empty">尚未保存研究候選。</p>`;
}
function clearWorkflowForm(ids) { ids.forEach((id) => { const node = document.querySelector(`#${id}`); if (node) node.value = ""; }); }
function saveDailyReview() {
  const review = { id: workflowId("review"), workflowDate: fieldValue("workflowDate"), asOf: fieldValue("workflowAsOf"), marketState: fieldValue("workflowMarketState"), workflowTimeframe: fieldValue("workflowTimeframe"), closeReview: Boolean(document.querySelector("#workflowCloseReview")?.checked), note: fieldValue("workflowNote"), savedAt: new Date().toISOString() };
  if (!review.workflowDate || !review.asOf || !review.marketState || !review.workflowTimeframe) return;
  workflow.reviews.unshift(review); workflow.reviews = workflow.reviews.slice(0, 30); saveWorkflow();
  clearWorkflowForm(["workflowDate", "workflowAsOf", "workflowMarketState", "workflowTimeframe", "workflowNote"]);
  const checkbox = document.querySelector("#workflowCloseReview"); if (checkbox) checkbox.checked = false;
}
function saveScreenSnapshot() {
  const candidateCount = fieldValue("screenCandidateCount");
  if (!fieldValue("screenName") || !fieldValue("screenFilters") || (candidateCount && (!/^\d+$/.test(candidateCount) || Number(candidateCount) < 0))) return;
  workflow.screenSnapshots.unshift({ id: workflowId("screen"), name: fieldValue("screenName"), source: fieldValue("screenSource"), filters: fieldValue("screenFilters"), candidateCount, savedAt: new Date().toISOString() }); workflow.screenSnapshots = workflow.screenSnapshots.slice(0, 50); saveWorkflow();
  clearWorkflowForm(["screenName", "screenSource", "screenFilters", "screenCandidateCount"]);
}
function saveResearchCandidate() {
  const price = fieldValue("researchLastEodPrice");
  if (!fieldValue("researchSymbol") || (price && !Number.isFinite(Number(price)))) return;
  workflow.researchCandidates.unshift({ id: workflowId("research"), symbol: fieldValue("researchSymbol"), tags: fieldValue("researchTags"), side: fieldValue("researchSide"), lastEodPrice: price, status: fieldValue("researchStatus"), savedAt: new Date().toISOString() }); workflow.researchCandidates = workflow.researchCandidates.slice(0, 100); saveWorkflow();
  clearWorkflowForm(["researchSymbol", "researchTags", "researchLastEodPrice"]);
}
function copyResearchCandidate(id) {
  const item = workflow.researchCandidates.find((candidate) => candidate.id === id); if (!item) return;
  copyText(JSON.stringify({ handoff: "DE-0 candidate", source: "Signal Dashboard daily workflow", input: { symbol: item.symbol, side: item.side, setupTag: item.tags, lastEodPrice: item.lastEodPrice, researchStatus: item.status }, instructions: "候選資料未完成 DE-0 Input Gate；由 Codex 只作研究，不得把缺失資料當成已核實。" }, null, 2), "DE-0 候選資料已複製");
}
function bindWorkflow() {
  document.querySelector("#saveReviewButton")?.addEventListener("click", saveDailyReview);
  document.querySelector("#saveScreenButton")?.addEventListener("click", saveScreenSnapshot);
  document.querySelector("#saveResearchButton")?.addEventListener("click", saveResearchCandidate);
  document.querySelector(".workflow-panel")?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) { const type = deleteButton.dataset.delete; workflow[type] = workflow[type].filter((item) => item.id !== deleteButton.dataset.id); saveWorkflow(); return; }
    const copyButton = event.target.closest("[data-copy-research]"); if (copyButton) copyResearchCandidate(copyButton.dataset.copyResearch);
  });
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
      <div class="trade-plan"><div class="level"><span>Confirm close</span><strong>${priceText(plan.execution?.confirmationClose)}</strong></div><div class="level"><span>Course 2R / 3R</span><strong>${priceText(plan.courseReferenceLevels?.twoR)} / ${priceText(plan.courseReferenceLevels?.threeR)}</strong></div><div class="level"><span>Initial resistance</span><strong>${priceText(plan.initialProfitReview?.resistance?.price)}</strong><small>${h(plan.initialProfitReview?.resistance?.status || "Unknown")}</small></div><div class="level"><span>Execution R/R</span><strong>${plan.initialProfitReview?.executionRewardRisk == null ? "-" : `${valueOrDash(plan.initialProfitReview.executionRewardRisk)}x`}</strong></div><div class="level"><span>Profit-protection stop</span><strong>${priceText(plan.profitProtection?.price)}</strong></div><div class="level"><span>Qty @ USD250</span><strong>${valueOrDash(plan.quantitySuggested)}</strong></div></div>
      <div class="analysis-list"><div><strong>Stage 2:</strong> ${h(labels[lesson.stage2?.overall] || "Unknown")}</div>${renderChecks(lesson.stage2?.checks)}<div><strong>Buy methods:</strong></div>${renderChecks(lesson.entryMethods)}${renderChecks([plan.entryGate, plan.initialProfitReview?.validation].filter(Boolean))}<div><strong>Resistance:</strong> ${h(plan.initialProfitReview?.resistance?.evidence || "Unknown")}</div><div><strong>Profit protection:</strong> ${h(plan.profitProtection?.evidence || "Unknown")}</div><div><strong>Current course action:</strong> ${h(plan.currentAction || "Unknown")}</div><div><strong>Sell into Weakness:</strong> ${h(plan.sellIntoWeakness?.courseUse || plan.reason || "Unavailable")}</div><div><strong>Sell into Strength:</strong> ${h(plan.sellIntoStrength?.courseUse || plan.reason || "Unavailable")}</div></div>
      <p class="evidence">${h(item.articleEvidence || "")}</p><p class="evidence">${h(item.chartEvidence || "")}</p><div class="action">${h(lesson.overallLabel || "Unavailable")}</div><p class="caveat">${h((lesson.reasons || []).join(" "))}</p>${item.chartUrl ? `<a class="chart-link" href="${h(chartUrl(item.chartUrl))}" target="_blank" rel="noreferrer">Open chart evidence</a>` : ""}</article>`;
  }).join("");
}

function renderTable() {
  const rows = filteredCandidates();
  if (!rows.length) { document.querySelector("#candidateTable").innerHTML = `<tr><td colspan="13">No candidates match this filter.</td></tr>`; return; }
  document.querySelector("#candidateTable").innerHTML = rows.map((item) => {
    const lesson = item.lesson3 || {};
    const plan = item.lesson4ModelPlan || {};
    const indicators = lesson.stage2?.indicators || {};
    return `<tr><td><strong>${h(item.ticker)}</strong><br>${h(item.company || "")}</td><td>${statusBadge(lesson.overallStatus)}</td><td>${statusBadge(lesson.stage2?.overall)}</td><td>${h(lesson.pattern?.candidateType || "-")}<br>${h(lesson.pattern?.confirmation || "unknown")}</td><td>${priceText(indicators.currentPrice)}</td><td>${priceText(lesson.pivot)}</td><td>${pctText(lesson.distanceToPivotPct)}</td><td>${priceText(plan.initialStop)}<br>${pctText(plan.stopDistancePct)}</td><td>${priceText(plan.courseReferenceLevels?.twoR)} / ${priceText(plan.courseReferenceLevels?.threeR)}</td><td>${priceText(plan.initialProfitReview?.resistance?.price)}<br>${h(plan.initialProfitReview?.resistance?.status || "Unknown")}</td><td>${plan.initialProfitReview?.executionRewardRisk == null ? "-" : `${valueOrDash(plan.initialProfitReview.executionRewardRisk)}x`}</td><td>${valueOrDash(plan.quantitySuggested)}</td><td>${h((lesson.reasons || []).join(" "))}</td></tr>`;
  }).join("");
}

function formatDate(value) { if (!value) return "n/a"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-HK", { hour12: false }); }
function valueOrDash(value) { return value === undefined || value === null || value === "" ? "-" : value; }
function h(value) { return String(value === undefined || value === null ? "" : value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function priceText(value) { if (value === undefined || value === null || value === "") return "-"; const number = Number(value); return Number.isFinite(number) ? number.toFixed(number >= 100 ? 2 : 3) : value; }
function pctText(value) { if (value === undefined || value === null || value === "") return "-"; const number = Number(value); return Number.isFinite(number) ? `${number.toFixed(1)}%` : value; }

document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.filter; document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active")); button.classList.add("active"); renderCards(); renderTable(); }));
bindWorkflow();
loadData();
