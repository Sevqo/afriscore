"use strict";

/**
 * AfriScore business-track local dashboard.
 *
 * Plain dependency-free JavaScript: this page is served by the API itself
 * (same origin), calls the documented /v1 endpoints, and never bypasses auth
 * or consent. Credentials are kept only in this browser's localStorage.
 */

const $ = (id) => document.getElementById(id);

const STORAGE = {
  businessId: "afriscore.businessId",
  apiKey: "afriscore.apiKey",
  adminToken: "afriscore.adminToken",
};

const state = {
  businessId: localStorage.getItem(STORAGE.businessId) || "",
  apiKey: localStorage.getItem(STORAGE.apiKey) || "",
  adminToken: localStorage.getItem(STORAGE.adminToken) || "",
};

const money = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtMoney(value) {
  return `KES ${money.format(Number(value ?? 0))}`;
}

function fmtPct(value) {
  return `${percent.format(Number(value ?? 0))}%`;
}

function syncInputs() {
  $("business-id").value = state.businessId;
  $("api-key").value = state.apiKey;
  $("admin-token").value = state.adminToken;
}

function persist() {
  state.businessId = $("business-id").value.trim();
  state.apiKey = $("api-key").value.trim();
  state.adminToken = $("admin-token").value.trim();
  localStorage.setItem(STORAGE.businessId, state.businessId);
  localStorage.setItem(STORAGE.apiKey, state.apiKey);
  localStorage.setItem(STORAGE.adminToken, state.adminToken);
}

let errorTimer = null;
function clearError() {
  $("error").hidden = true;
  $("error").textContent = "";
}
function showError(message) {
  const box = $("error");
  box.hidden = false;
  box.textContent = message;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(clearError, 12000);
}

async function callApi(method, path, { body, auth } = {}) {
  persist();
  const headers = { "Content-Type": "application/json" };
  if (auth === "admin") {
    if (!state.adminToken) throw new Error("Admin token is required for onboarding calls.");
    headers["x-admin-token"] = state.adminToken;
  } else if (auth === "apikey") {
    if (!state.apiKey) throw new Error("API key is required for lender/owner reads.");
    headers["x-api-key"] = state.apiKey;
  }

  const response = await fetch(`/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* empty body */
  }

  if (!response.ok) {
    const code = payload?.error || `http_${response.status}`;
    const detail = payload?.message || "";
    const requestId = payload?.request_id ? ` (request ${payload.request_id})` : "";
    throw new Error(`${code}${detail ? `: ${detail}` : ""}${requestId}`);
  }
  return payload;
}

/* ---------------- Tab navigation ---------------- */

function selectView(view) {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.view === view);
  }
  for (const section of document.querySelectorAll(".view")) {
    section.classList.toggle("active", section.id === `view-${view}`);
  }
}

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => selectView(tab.dataset.view));
}

/* ---------------- Onboarding ---------------- */

$("create-business").addEventListener("click", async () => {
  clearError();
  try {
    const business = await callApi("POST", "/businesses", {
      auth: "admin",
      body: { legal_name: $("legal-name").value.trim(), sector: $("sector").value.trim() },
    });
    state.businessId = business.id;
    $("business-id").value = business.id;
    persist();
    $("create-result").innerHTML = `Created <code>${escapeHtml(business.id)}</code> (${escapeHtml(business.status)}).`;
  } catch (error) {
    showError(error.message);
  }
});

$("record-consent").addEventListener("click", async () => {
  clearError();
  try {
    if (!state.businessId) throw new Error("Create or paste a business id first.");
    const result = await callApi("POST", `/businesses/${encodeURIComponent(state.businessId)}/onboarding/consent`, {
      auth: "admin",
      body: {},
    });
    $("consent-result").innerHTML = `Consent <code>${escapeHtml(result.consent.id)}</code> active (scopes: statements, business_profile).`;
  } catch (error) {
    showError(error.message);
  }
});

$("upload-statement").addEventListener("click", async () => {
  clearError();
  try {
    if (!state.businessId) throw new Error("Create or paste a business id first.");
    const file = $("statement-file").files?.[0];
    const content = file ? await file.text() : $("statement-content").value;
    if (!content || content.trim().length < 10) throw new Error("Choose a CSV file or paste statement content.");
    const sourceType = $("source-type").value;
    const result = await callApi("POST", `/businesses/${encodeURIComponent(state.businessId)}/statements`, {
      auth: "admin",
      body: {
        source_type: sourceType,
        shortcode: sourceType.startsWith("business_") ? $("shortcode").value.trim() : undefined,
        file_name: file ? file.name : undefined,
        content,
      },
    });
    $("upload-result").innerHTML =
      `Ingested <strong>${escapeHtml(result.transactions_imported)}</strong> transaction(s), ` +
      `skipped ${escapeHtml(result.duplicates_skipped)} duplicate(s). ` +
      `Period ${escapeHtml(String(result.period_start).slice(0, 10))} → ${escapeHtml(String(result.period_end).slice(0, 10))}. ` +
      (result.warnings?.length ? `<span class="warn">${escapeHtml(result.warnings.length)} row warning(s).</span>` : "");
    selectView("owner");
    await loadDashboard();
  } catch (error) {
    showError(error.message);
  }
});

/* ---------------- Owner dashboard ---------------- */

function healthBadge(band, label) {
  return `<span class="badge ${escapeHtml(band)}">${escapeHtml(label || band)}</span>`;
}

function renderComponents(components) {
  return components
    .map((component) => {
      const available = component.available && component.score !== null;
      const score = available ? Number(component.score) : 0;
      return `
        <div class="component">
          <div class="head">
            <span>${escapeHtml(component.label)} <span class="muted small">(${Math.round(component.weight * 100)}%)</span></span>
            <span>${available ? `${score}/100` : `<span class="muted">unavailable</span>`}</span>
          </div>
          <div class="bar"><span style="width:${Math.max(2, score)}%"></span></div>
          <div class="muted small">${escapeHtml(component.detail)}${
            component.reason ? ` <span class="warn">(${escapeHtml(component.reason)})</span>` : ""
          }</div>
        </div>`;
    })
    .join("");
}

function renderMonthly(monthly) {
  const rows = monthly
    .map(
      (bucket) => `
        <tr>
          <td>${escapeHtml(bucket.month)}</td>
          <td class="num">${fmtMoney(bucket.inflow)}</td>
          <td class="num">${fmtMoney(bucket.outflow)}</td>
          <td class="num ${bucket.net < 0 ? "danger" : ""}">${fmtMoney(bucket.net)}</td>
        </tr>`
    )
    .join("");
  return `<table><thead><tr><th>Month</th><th class="num">Inflow</th><th class="num">Outflow</th><th class="num">Net</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDashboard(dashboard) {
  const { business, cash_flow: cash, counterparties, totals, health_score: health, tips, window } = dashboard;

  const customers = counterparties.top_customers
    .map(
      (entry) => `<tr>
        <td>${escapeHtml(entry.counterparty)}</td>
        <td class="num">${fmtMoney(entry.inflow)}</td>
        <td class="num">${escapeHtml(entry.transaction_count)}</td>
        <td class="num">${fmtPct(entry.share_of_inflow_pct)}</td>
      </tr>`
    )
    .join("");

  const suppliers = counterparties.supplier.top_suppliers
    .map(
      (entry) => `<tr>
        <td>${escapeHtml(entry.counterparty)}</td>
        <td class="num">${fmtMoney(entry.outflow)}</td>
        <td class="num">${escapeHtml(entry.payment_count)}</td>
      </tr>`
    )
    .join("");

  const activeMonths = Math.max(1, totals.months_of_history);
  const monthlyInflowAvg = totals.inflow / activeMonths;
  const trend = cash.revenue_trend;

  $("dashboard-output").innerHTML = `
    <div class="panel">
      <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
        <div>
          <h2 style="margin:0">${escapeHtml(business.legal_name)}</h2>
          <p class="muted small">${escapeHtml(business.sector || "sector not set")} · status ${escapeHtml(business.status)} · trust score ${escapeHtml(business.trust_score)} · ${escapeHtml(window.months)}-month window</p>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <strong style="font-size:1.6rem">${health.score}</strong>${healthBadge(health.band, health.band_label)}
        </div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="label">Inflow</div><div class="value">${fmtMoney(totals.inflow)}</div></div>
      <div class="stat"><div class="label">Outflow</div><div class="value">${fmtMoney(totals.outflow)}</div></div>
      <div class="stat"><div class="label">Net cash</div><div class="value ${totals.net < 0 ? "danger" : ""}">${fmtMoney(totals.net)}</div></div>
      <div class="stat"><div class="label">Avg monthly inflow</div><div class="value">${fmtMoney(monthlyInflowAvg)}</div></div>
      <div class="stat"><div class="label">Active months</div><div class="value">${escapeHtml(totals.months_of_history)}</div></div>
      <div class="stat"><div class="label">Avg ticket</div><div class="value">${fmtMoney(cash.peak_activity.average_ticket)}</div></div>
    </div>

    <div class="split">
      <div class="panel">
        <h3>Cash flow by month</h3>
        ${renderMonthly(cash.monthly)}
        <p class="muted small">
          Inflow volatility: ${cash.inflow_volatility === null ? "not enough months" : fmtPct(cash.inflow_volatility * 100)}
          · Trend: <strong>${escapeHtml(trend.direction)}</strong>${trend.change_pct === null ? "" : ` (${fmtPct(trend.change_pct)})`}
          · Busiest: ${escapeHtml(cash.peak_activity.busiest_weekday || "n/a")} ${cash.peak_activity.busiest_hour === null ? "" : `around ${String(cash.peak_activity.busiest_hour).padStart(2, "0")}:00`}
        </p>
      </div>

      <div class="panel">
        <h3>Health score components</h3>
        ${renderComponents(health.components)}
        ${health.excluded_components.length ? `<p class="muted small">Excluded (no data captured): ${escapeHtml(health.excluded_components.join(", "))}</p>` : ""}
      </div>
    </div>

    <div class="split">
      <div class="panel">
        <h3>Top customers${counterparties.anchor_buyer_risk ? ` <span class="badge elevated">anchor-buyer risk</span>` : ""}</h3>
        <table><thead><tr><th>Counterparty</th><th class="num">Inflow</th><th class="num">Payments</th><th class="num">Share</th></tr></thead><tbody>${customers || `<tr><td colspan="4" class="muted">No inflow yet.</td></tr>`}</tbody></table>
        <p class="muted small">Repeat customers: ${fmtPct(counterparties.repeat_customer_ratio * 100)} of inflow · ${counterparties.anchor_buyer_risk ? "one buyer is above 40% of inflow" : "concentration under the 40% threshold"}</p>
      </div>

      <div class="panel">
        <h3>Suppliers</h3>
        <table><thead><tr><th>Supplier</th><th class="num">Outflow</th><th class="num">Payments</th></tr></thead><tbody>${suppliers || `<tr><td colspan="3" class="muted">No outgoing payments yet.</td></tr>`}</tbody></table>
        <p class="muted small">Repeat suppliers: ${escapeHtml(counterparties.supplier.repeat_supplier_count)} · regularity ${fmtPct(counterparties.supplier.regularity_score * 100)}</p>
      </div>
    </div>

    <div class="panel">
      <h3>Three things worth acting on</h3>
      <ul class="clean">${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>
    </div>
  `;
}

async function loadDashboard() {
  clearError();
  try {
    if (!state.businessId) throw new Error("Set a business id first.");
    const dashboard = await callApi("GET", `/businesses/${encodeURIComponent(state.businessId)}/business-profile`, {
      auth: "apikey",
    });
    renderDashboard(dashboard);
  } catch (error) {
    showError(error.message);
  }
}

$("load-dashboard").addEventListener("click", loadDashboard);

/* ---------------- Lender card ---------------- */

function renderLenderCard(card) {
  const topEvidence = card.evidence.slice(0, 3);
  const receivables = card.receivables
    ? `<div class="stat-grid">
         <div class="stat"><div class="label">Open invoices</div><div class="value">${escapeHtml(card.receivables.open_invoice_count)}</div></div>
         <div class="stat"><div class="label">Open value</div><div class="value">${fmtMoney(card.receivables.open_invoice_value)}</div></div>
         <div class="stat"><div class="label">DSO</div><div class="value">${card.receivables.dso_days === null ? "n/a" : `${escapeHtml(card.receivables.dso_days)} days`}</div></div>
         <div class="stat"><div class="label">Matched to receipts</div><div class="value">${card.receivables.matched_payment_ratio === null ? "n/a" : fmtPct(card.receivables.matched_payment_ratio * 100)}</div></div>
       </div>`
    : `<p class="muted">No invoice data — receivables and DSO are intentionally not estimated.</p>`;

  $("lender-output").innerHTML = `
    <div class="panel">
      <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start">
        <div>
          <h2 style="margin:0">${escapeHtml(card.business_name)}</h2>
          <p class="muted small">${escapeHtml(card.shortcodes.join(" · ") || "no shortcodes")} · ${escapeHtml(card.months_of_history)} month(s) of history · generated ${escapeHtml(card.generated_at)}</p>
        </div>
        <div style="text-align:right">
          <div class="badge ${escapeHtml(card.verdict)}">${escapeHtml(card.verdict)}</div>
          <div style="font-size:1.8rem;font-weight:700;margin-top:0.3rem">${fmtMoney(card.recommended_limit)}</div>
          <div class="muted small">recommended limit · risk <span class="badge ${escapeHtml(card.risk_band)}">${escapeHtml(card.risk_band)}</span></div>
        </div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="label">Health score</div><div class="value">${escapeHtml(card.business_health_score)} ${healthBadge(card.health_band, card.health_band)}</div></div>
      <div class="stat"><div class="label">Confidence</div><div class="value">${fmtPct(card.confidence.overall * 100)}</div></div>
      <div class="stat"><div class="label">Data completeness</div><div class="value">${fmtPct(card.confidence.data_completeness * 100)}</div></div>
      <div class="stat"><div class="label">Reconciliation</div><div class="value">${card.confidence.reconciliation_score === null ? "n/a" : fmtPct(card.confidence.reconciliation_score * 100)}</div></div>
      <div class="stat"><div class="label">Avg monthly inflow</div><div class="value">${fmtMoney(card.monthly_inflow_avg)}</div></div>
      <div class="stat"><div class="label">Top customer share</div><div class="value">${fmtPct(card.top_customer_concentration)}</div></div>
    </div>

    <div class="split">
      <div class="panel">
        <h3>Top 3 evidence lines</h3>
        <ul class="clean">
          ${topEvidence
            .map(
              (evidence) => `<li><strong>${escapeHtml(evidence.label)}:</strong> ${escapeHtml(evidence.value)}${
                evidence.key === "revenue_trend" || evidence.key === "top_customer_concentration" || evidence.key === "inflow_volatility" || evidence.key === "repeat_customers" || evidence.key === "data_completeness" ? "%" : ""
              } <span class="badge ${evidence.impact === "positive" ? "low" : evidence.impact === "negative" ? "high" : "stable"}">${escapeHtml(evidence.impact)}</span><br /><span class="muted small">${escapeHtml(evidence.detail)}</span></li>`
            )
            .join("")}
        </ul>
      </div>

      <div class="panel">
        <h3>Receivables</h3>
        ${receivables}
        <p class="muted small">Trend: ${escapeHtml(card.revenue_trend.direction)}${card.revenue_trend.change_pct === null ? "" : ` (${fmtPct(card.revenue_trend.change_pct)})`} · volatility ${card.inflow_volatility === null ? "n/a" : fmtPct(card.inflow_volatility * 100)}</p>
      </div>
    </div>

    <div class="panel">
      <h3>Adverse indicators</h3>
      ${
        card.adverse_indicators.length
          ? `<ul class="clean">${card.adverse_indicators.map((indicator) => `<li class="warn">${escapeHtml(indicator)}</li>`).join("")}</ul>`
          : `<p class="muted">None observed in the window.</p>`
      }
      <p class="muted small">Ledger audit reference (decision entry): <span class="audit">${escapeHtml(card.audit_trail_ref)}</span></p>
      <details><summary class="muted small">Methodology</summary>
        <p class="muted small">Score source: ${escapeHtml(card.methodology.score_source)}</p>
        <p class="muted small">Limit: ${escapeHtml(card.methodology.limit_formula)}</p>
        <p class="muted small">Risk band: ${escapeHtml(card.methodology.risk_band_mapping)}</p>
        <p class="muted small">Confidence: ${escapeHtml(card.confidence.method)}</p>
      </details>
    </div>
  `;
}

$("issue-card").addEventListener("click", async () => {
  clearError();
  try {
    if (!state.businessId) throw new Error("Set a business id first.");
    const card = await callApi("POST", `/businesses/${encodeURIComponent(state.businessId)}/decision-card`, { auth: "apikey" });
    renderLenderCard(card);
  } catch (error) {
    showError(error.message);
  }
});

/* ---------------- Init ---------------- */

syncInputs();
selectView("onboarding");
