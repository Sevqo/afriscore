import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "http";
import { configureTestEnv, truncateAll, removeSqliteFile } from "./helpers";

const { sqlitePath } = configureTestEnv("business-dashboard");

import { migrate, dbRun } from "../db";
import { createApp } from "../app";
import { drainOrbit } from "./orbit-test-utils";
import { computeBusinessMetrics, computeBusinessHealth, buildBusinessTips } from "../services/businessMetricsService";
import { Transaction } from "../services/transactionService";

const FIXTURES = path.join(__dirname, "../../test-fixtures");
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), "utf8");
const NOW = new Date("2026-10-15T12:00:00.000Z");

function iso(date: string, hour = 9): string {
  return `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

function txn(overrides: Partial<Transaction> & Pick<Transaction, "amount" | "type" | "occurred_at">): Transaction {
  return {
    id: overrides.id ?? `txn-${Math.random().toString(36).slice(2)}`,
    account_id: "acc-1",
    business_id: "biz-1",
    external_id: overrides.external_id ?? `ext-${Math.random().toString(36).slice(2)}`,
    amount: overrides.amount,
    currency: "KES",
    type: overrides.type,
    counterparty: overrides.counterparty ?? null,
    category: overrides.category ?? (overrides.type === "credit" ? "sales" : "expenses"),
    status: overrides.status ?? "completed",
    source_provider: overrides.source_provider ?? "mpesa_till",
    raw_status: overrides.raw_status ?? "Completed",
    occurred_at: overrides.occurred_at,
    created_at: overrides.created_at ?? overrides.occurred_at,
  };
}

function healthyTransactions(): Transaction[] {
  return [
    // July
    txn({ amount: 3000, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-07-05") }),
    txn({ amount: 3000, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-07-20") }),
    txn({ amount: 2000, type: "credit", counterparty: "JANE WANJIKU", occurred_at: iso("2026-07-10") }),
    txn({ amount: 1000, type: "credit", counterparty: "KENYA HARDWARE", occurred_at: iso("2026-07-25") }),
    txn({ amount: 1500, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso("2026-07-12") }),
    // August
    txn({ amount: 3200, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-08-05") }),
    txn({ amount: 3000, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-08-18") }),
    txn({ amount: 2100, type: "credit", counterparty: "JANE WANJIKU", occurred_at: iso("2026-08-09") }),
    txn({ amount: 1100, type: "credit", counterparty: "KENYA HARDWARE", occurred_at: iso("2026-08-22") }),
    txn({ amount: 1500, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso("2026-08-14") }),
    // September
    txn({ amount: 3400, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-09-04") }),
    txn({ amount: 3100, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-09-19") }),
    txn({ amount: 2200, type: "credit", counterparty: "JANE WANJIKU", occurred_at: iso("2026-09-08") }),
    txn({ amount: 1200, type: "credit", counterparty: "KENYA HARDWARE", occurred_at: iso("2026-09-24") }),
    txn({ amount: 1500, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso("2026-09-13") }),
  ];
}

let server: Server;
let baseUrl: string;

async function api(method: string, urlPath: string, opts: { body?: unknown; apiKey?: string; admin?: boolean } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.admin !== false) headers["x-admin-token"] = process.env.AFRISCORE_ADMIN_TOKEN!;
  if (opts.apiKey) headers["x-api-key"] = opts.apiKey;
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, body: json };
}

describe("business dashboard metrics", () => {
  test("monthly cash flow buckets are complete and computed from settled rows only", () => {
    const transactions = [
      txn({ amount: 300, type: "credit", occurred_at: iso("2026-07-05") }),
      txn({ amount: 200, type: "credit", occurred_at: iso("2026-07-15") }),
      txn({ amount: 50, type: "debit", occurred_at: iso("2026-07-20") }),
      txn({ amount: 999, type: "credit", occurred_at: iso("2026-07-21"), status: "failed" }),
      txn({ amount: 999, type: "credit", occurred_at: iso("2026-07-22"), status: "pending" }),
    ];

    const metrics = computeBusinessMetrics(transactions, { now: NOW, months: 12 });
    assert.strictEqual(metrics.cash_flow.monthly.length, 12);
    const july = metrics.cash_flow.monthly.find((bucket) => bucket.month === "2026-07")!;
    assert.strictEqual(july.inflow, 500);
    assert.strictEqual(july.outflow, 50);
    assert.strictEqual(july.net, 450);
    assert.strictEqual(july.transaction_count, 3);
    assert.deepStrictEqual(metrics.window.data_months, ["2026-07"]);
    assert.strictEqual(metrics.totals.failed_count, 1);
  });

  test("revenue trend detects growth from the newer half of active months", () => {
    const transactions = [
      txn({ amount: 1000, type: "credit", occurred_at: iso("2026-05-05") }),
      txn({ amount: 1100, type: "credit", occurred_at: iso("2026-06-05") }),
      txn({ amount: 2000, type: "credit", occurred_at: iso("2026-07-05") }),
      txn({ amount: 2100, type: "credit", occurred_at: iso("2026-08-05") }),
    ];
    const metrics = computeBusinessMetrics(transactions, { now: NOW });
    assert.strictEqual(metrics.cash_flow.revenue_trend.available, true);
    assert.strictEqual(metrics.cash_flow.revenue_trend.direction, "growing");
    assert.ok((metrics.cash_flow.revenue_trend.change_pct ?? 0) > 0);
  });

  test("customer concentration, anchor-buyer flag and repeat ratio use inflow only", () => {
    const transactions = [
      txn({ amount: 3000, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-07-05") }),
      txn({ amount: 3000, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-07-20") }),
      txn({ amount: 2000, type: "credit", counterparty: "JANE WANJIKU", occurred_at: iso("2026-07-10") }),
      txn({ amount: 1000, type: "credit", counterparty: "ONE OFF BUYER", occurred_at: iso("2026-07-25") }),
      txn({ amount: 5000, type: "debit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso("2026-07-28") }),
    ];
    const metrics = computeBusinessMetrics(transactions, { now: NOW });
    assert.strictEqual(metrics.counterparties.top_customers[0].counterparty, "ACME WHOLESALERS LTD");
    assert.strictEqual(metrics.counterparties.top_customers[0].inflow, 6000);
    assert.strictEqual(metrics.counterparties.top_customers[0].share_of_inflow_pct, 66.7);
    assert.strictEqual(metrics.counterparties.anchor_buyer_risk, true);
    // Repeated ACME inflow (6000) out of 9000 total inflow.
    assert.strictEqual(metrics.counterparties.repeat_customer_ratio, 0.67);
  });

  test("supplier regularity counts repeat suppliers across active months", () => {
    const transactions = [
      txn({ amount: 1000, type: "credit", counterparty: "CUSTOMER A", occurred_at: iso("2026-07-05") }),
      txn({ amount: 1000, type: "credit", counterparty: "CUSTOMER B", occurred_at: iso("2026-08-05") }),
      txn({ amount: 1000, type: "credit", counterparty: "CUSTOMER C", occurred_at: iso("2026-09-05") }),
      txn({ amount: 400, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso("2026-07-10") }),
      txn({ amount: 400, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso("2026-08-10") }),
      txn({ amount: 400, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso("2026-09-10") }),
      txn({ amount: 200, type: "debit", counterparty: "ONE OFF SUPPLIER", occurred_at: iso("2026-08-15") }),
    ];
    const metrics = computeBusinessMetrics(transactions, { now: NOW });
    assert.strictEqual(metrics.counterparties.supplier.repeat_supplier_count, 1);
    assert.strictEqual(metrics.counterparties.supplier.regularity_score, 1);
    assert.strictEqual(metrics.counterparties.supplier.top_suppliers[0].counterparty, "NAIROBI SUPPLIES");
  });

  test("peak activity and average ticket are derived from credits", () => {
    const metrics = computeBusinessMetrics(healthyTransactions(), { now: NOW });
    assert.ok(metrics.cash_flow.peak_activity.busiest_weekday);
    assert.ok(metrics.cash_flow.peak_activity.busiest_hour !== null);
    assert.ok(metrics.cash_flow.peak_activity.average_ticket > 0);
  });
});

describe("business health score", () => {
  test("a healthy, growing business scores Strong with liquidity honestly excluded", () => {
    const metrics = computeBusinessMetrics(healthyTransactions(), { now: NOW });
    const health = computeBusinessHealth(metrics);

    assert.ok(health.score >= 80, `expected strong score, got ${health.score}`);
    assert.strictEqual(health.band, "strong");
    assert.ok(health.components.some((component) => component.key === "cash_flow_stability" && component.available));
    assert.ok(health.components.some((component) => component.key === "revenue_trend" && component.available));
    const liquidity = health.components.find((component) => component.key === "liquidity_buffer")!;
    assert.strictEqual(liquidity.available, false);
    assert.strictEqual(liquidity.score, null);
    assert.ok(health.excluded_components.includes("liquidity_buffer"));
    // Weighted score is renormalised over available inputs only.
    assert.strictEqual(health.method, "weighted_components_renormalised_over_available_inputs");
  });

  test("a declining, concentrated business with failed payments scores lower", () => {
    const transactions = [
      txn({ amount: 5000, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-07-05") }),
      txn({ amount: 4000, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-07-20") }),
      txn({ amount: 3000, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-08-05") }),
      txn({ amount: 1000, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-08-20") }),
      txn({ amount: 800, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-09-05") }),
      txn({ amount: 500, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-09-20") }),
      txn({ amount: 100, type: "debit", counterparty: "SUPPLIER", occurred_at: iso("2026-09-21"), status: "failed" }),
      txn({ amount: 100, type: "debit", counterparty: "SUPPLIER", occurred_at: iso("2026-09-22"), status: "failed" }),
      txn({ amount: 100, type: "debit", counterparty: "SUPPLIER", occurred_at: iso("2026-09-23"), status: "failed" }),
    ];
    const metrics = computeBusinessMetrics(transactions, { now: NOW });
    const health = computeBusinessHealth(metrics);

    assert.strictEqual(metrics.cash_flow.revenue_trend.direction, "declining");
    assert.strictEqual(metrics.counterparties.anchor_buyer_risk, true);
    assert.ok(health.score < 60, `expected a weak score, got ${health.score}`);
    assert.ok(health.band === "watch" || health.band === "at_risk");
    const discipline = health.components.find((component) => component.key === "payment_discipline")!;
    assert.ok((discipline.score as number) < 80, "failed payments must lower the discipline component");
  });

  test("exactly three tips are produced, derived from the business's own numbers", () => {
    const metrics = computeBusinessMetrics(healthyTransactions(), { now: NOW });
    const health = computeBusinessHealth(metrics);
    const tips = buildBusinessTips(metrics, health);

    assert.strictEqual(tips.length, 3);
    assert.strictEqual(new Set(tips).size, 3, "tips must be distinct");
    assert.ok(tips.some((tip) => tip.includes("ACME WHOLESALERS LTD")) || tips.some((tip) => tip.includes("customer")));
  });

  test("a concentrated business gets the diversification tip", () => {
    const transactions = [
      txn({ amount: 9000, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-07-05") }),
      txn({ amount: 9000, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-08-05") }),
      txn({ amount: 9000, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-09-05") }),
      txn({ amount: 1000, type: "credit", counterparty: "SMALL BUYER", occurred_at: iso("2026-09-10") }),
    ];
    const metrics = computeBusinessMetrics(transactions, { now: NOW });
    const tips = buildBusinessTips(metrics, computeBusinessHealth(metrics));
    assert.ok(
      tips.some((tip) => tip.includes("ONLY BUYER") && tip.toLowerCase().includes("diversifying")),
      `expected a diversification tip, got: ${tips.join(" | ")}`
    );
  });
});

describe("business dashboard endpoint", () => {
  before(async () => {
    await migrate();
    await truncateAll(dbRun);
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    removeSqliteFile(sqlitePath);
  });

  test("dashboard requires the business_profile consent scope", async () => {
    const biz = await api("POST", "/v1/businesses", { body: { legal_name: "Dashboard Consent Ltd", sector: "retail" } });
    const client = await api("POST", "/v1/clients", { body: { name: "dashboard-client" } });

    const blocked = await api("GET", `/v1/businesses/${biz.body.id}/business-profile`, { apiKey: client.body.api_key });
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual(blocked.body.error, "consent_required");
    assert.strictEqual(blocked.body.required_scope, "business_profile");
  });

  test("uploaded statements feed the dashboard, health score and tips", async () => {
    const biz = await api("POST", "/v1/businesses", { body: { legal_name: "Dashboard Data Ltd", sector: "retail" } });
    const businessId = biz.body.id as string;

    await api("POST", `/v1/businesses/${businessId}/onboarding/consent`, { body: {} });
    const till = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "business_till", shortcode: "777777", content: fixture("till-clean.csv") },
    });
    assert.strictEqual(till.status, 202);
    const bank = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "bank", content: fixture("bank-clean.csv") },
    });
    assert.strictEqual(bank.status, 202);
    await drainOrbit();

    const client = await api("POST", "/v1/clients", { body: { name: "dashboard-data-client" } });
    const consent = await api("POST", "/v1/consents", {
      body: {
        subject_type: "business",
        subject_id: businessId,
        grantee: "dashboard-data-client",
        purpose: "underwriting",
        scope: ["business_profile"],
      },
    });
    assert.strictEqual(consent.status, 201);

    const res = await api("GET", `/v1/businesses/${businessId}/business-profile`, { apiKey: client.body.api_key });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.business.id, businessId);
    assert.strictEqual(res.body.window.months, 12);
    assert.strictEqual(res.body.cash_flow.monthly.length, 12);
    assert.ok(res.body.totals.inflow > 0);
    assert.ok(res.body.counterparties.top_customers.length > 0);
    assert.strictEqual(res.body.health_score.components.length, 5);
    assert.ok(["strong", "stable", "watch", "at_risk"].includes(res.body.health_score.band));
    assert.strictEqual(res.body.tips.length, 3);
    assert.ok(res.body.tips.every((tip: string) => typeof tip === "string" && tip.length > 10));

    // Partner endpoints must be reachable with ONLY the API key — sibling
    // admin-only routers mounted on the same prefix must not intercept them.
    const partnerOnly = await api("GET", `/v1/businesses/${businessId}/business-profile`, {
      apiKey: client.body.api_key,
      admin: false,
    });
    assert.strictEqual(partnerOnly.status, 200, "a partner read must not require the admin token");

    // …while the operator routes on the same prefix still reject anonymous callers.
    const adminRoute = await api("GET", `/v1/businesses/${businessId}/links`, { admin: false });
    assert.strictEqual(adminRoute.status, 401, "admin-only sibling routes must stay protected");
  });

  test("an unknown business returns 404 only after consent is resolved", async () => {
    const client = await api("POST", "/v1/clients", { body: { name: "dashboard-missing-client" } });
    const randomId = "00000000-0000-0000-0000-000000000000";
    await api("POST", "/v1/consents", {
      body: {
        subject_type: "business",
        subject_id: randomId,
        grantee: "dashboard-missing-client",
        purpose: "underwriting",
        scope: ["business_profile"],
      },
    });
    const res = await api("GET", `/v1/businesses/${randomId}/business-profile`, { apiKey: client.body.api_key });
    assert.strictEqual(res.status, 404);
  });
});
