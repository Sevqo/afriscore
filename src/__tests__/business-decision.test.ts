import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "http";
import { configureTestEnv, truncateAll, removeSqliteFile } from "./helpers";

const { sqlitePath } = configureTestEnv("business-decision");

import { migrate, dbRun } from "../db";
import { createApp } from "../app";
import { createBusiness, Business } from "../services/businessService";
import {
  buildBusinessDecisionCard,
  computeRecommendedLimit,
  DecisionEvidence,
} from "../services/decisionCardService";
import { computeBusinessHealth, computeBusinessMetrics } from "../services/businessMetricsService";
import { getLedger, verifyChainIntegrity } from "../services/ledgerService";
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

/** Six months of steady, slightly growing, well-diversified inflow. */
function growingTransactions(): Transaction[] {
  const rows: Transaction[] = [];
  const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
  const buyers = ["ACME WHOLESALERS LTD", "JANE WANJIKU", "KENYA HARDWARE", "BRIGHT FUTURE SCHOOLS"];
  months.forEach((month, index) => {
    const monthlyInflow = 4000 + index * 100; // +2.5% per month, low volatility
    for (const buyer of buyers) {
      rows.push(txn({ amount: monthlyInflow / buyers.length, type: "credit", counterparty: buyer, occurred_at: iso(`${month}-05`) }));
    }
    rows.push(txn({ amount: monthlyInflow * 0.3, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso(`${month}-20`) }));
  });
  return rows;
}

/** Same monthly totals, but one buyer dominates the inflow mix. */
function concentratedTransactions(): Transaction[] {
  const rows: Transaction[] = [];
  const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
  months.forEach((month, index) => {
    const monthlyInflow = 4000 + index * 100;
    rows.push(txn({ amount: monthlyInflow * 0.8, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso(`${month}-05`) }));
    for (const buyer of ["JANE WANJIKU", "KENYA HARDWARE", "BRIGHT FUTURE SCHOOLS"]) {
      rows.push(txn({ amount: (monthlyInflow * 0.2) / 3, type: "credit", counterparty: buyer, occurred_at: iso(`${month}-12`) }));
    }
    rows.push(txn({ amount: monthlyInflow * 0.3, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso(`${month}-20`) }));
  });
  return rows;
}

const BUSINESS: Business = {
  id: "biz-1",
  legal_name: "Pure Mapping Ltd",
  jurisdiction: "KE",
  status: "verified",
  trust_score: 80,
  is_sandbox: false,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

function cardFor(transactions: Transaction[], overrides: Partial<{ shortcodes: string[]; receivables: null; statementsCount: number }> = {}) {
  const metrics = computeBusinessMetrics(transactions, { now: NOW });
  const health = computeBusinessHealth(metrics);
  return {
    metrics,
    health,
    card: buildBusinessDecisionCard({
      business: BUSINESS,
      metrics,
      health,
      shortcodes: overrides.shortcodes ?? ["123456"],
      receivables: overrides.receivables ?? null,
      statementsCount: overrides.statementsCount ?? 3,
      now: NOW,
    }),
  };
}

let server: Server;
let baseUrl: string;

async function api(method: string, urlPath: string, opts: { body?: unknown; apiKey?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-admin-token": process.env.AFRISCORE_ADMIN_TOKEN! };
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

describe("decision card mapping", () => {
  test("a healthy growing business gets a positive, auditable card", () => {
    const { card, health, metrics } = cardFor(growingTransactions());

    assert.strictEqual(card.subject.type, "business");
    assert.strictEqual(card.subject.name, "Pure Mapping Ltd");
    assert.strictEqual(card.business_name, "Pure Mapping Ltd");
    assert.strictEqual(card.currency, "KES");
    assert.strictEqual(card.health_band, health.band);
    assert.strictEqual(card.business_health_score, health.score);
    assert.strictEqual(card.months_of_history, metrics.totals.months_of_history);
    assert.deepStrictEqual(card.shortcodes, ["123456"]);
    assert.strictEqual(card.receivables, null, "no invoice data must be null, never invented");

    assert.strictEqual(card.risk_band, "low");
    assert.strictEqual(card.verdict, "approve");
    assert.ok(card.recommended_limit > 0);
    assert.strictEqual(card.recommended_limit % 1000, 0, "limits are rounded down to KES 1,000");
    assert.ok(card.confidence.overall > 0 && card.confidence.overall <= 1);
    assert.strictEqual(card.confidence.reconciliation_score, null);
    assert.strictEqual(card.confidence.months_of_history, 6);
    assert.ok(card.evidence.length >= 3);
    assert.deepStrictEqual(
      card.evidence.slice(0, 3).map((evidence: DecisionEvidence) => evidence.key),
      ["monthly_inflow_avg", "business_health_score", "revenue_trend"]
    );
    assert.ok(card.methodology.limit_formula.includes("avg_monthly_inflow"));
  });

  test("concentration and failed payments reduce the recommended limit", () => {
    const baseline = cardFor(growingTransactions());
    const concentratedCard = cardFor(concentratedTransactions());

    // Same monthly inflow totals; only the buyer mix (and thus concentration) differs.
    assert.ok(concentratedCard.metrics.counterparties.anchor_buyer_risk);
    assert.ok(
      concentratedCard.card.recommended_limit < baseline.card.recommended_limit,
      `concentration haircut must lower the limit (baseline ${baseline.card.recommended_limit}, concentrated ${concentratedCard.card.recommended_limit})`
    );

    const withFailures = growingTransactions();
    for (let i = 0; i < 4; i++) {
      withFailures.push(txn({ amount: 100, type: "debit", status: "failed", occurred_at: iso("2026-09-2" + i) }));
    }
    const failedCard = cardFor(withFailures);
    assert.ok(failedCard.metrics.totals.failed_ratio > 0.05);
    assert.ok(failedCard.card.adverse_indicators.includes("failed_payment_ratio_above_5pct"));
    assert.ok(failedCard.card.recommended_limit < baseline.card.recommended_limit, "failed-payment haircut must lower the limit");
  });

  test("three or more adverse indicators move the risk band one step riskier and change the verdict", () => {
    const transactions: Transaction[] = [];
    // Declining inflow from one dominant buyer, plus failed payments.
    const values = [9000, 8000, 7000, 6000, 5000, 4000];
    values.forEach((value, index) => {
      transactions.push(
        txn({ amount: value, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso(`2026-0${index + 4}-05`) })
      );
    });
    for (let i = 0; i < 3; i++) {
      transactions.push(txn({ amount: 100, type: "debit", status: "failed", occurred_at: iso("2026-09-2" + i) }));
    }

    const { card, health, metrics } = cardFor(transactions);
    assert.strictEqual(metrics.cash_flow.revenue_trend.direction, "declining");
    assert.ok(card.adverse_indicators.length >= 3);
    assert.notStrictEqual(card.risk_band, "low");
    assert.strictEqual(card.risk_band, health.band === "watch" ? "high" : card.risk_band);
    assert.notStrictEqual(card.verdict, "approve");
  });

  test("limit formula is deterministic and bounded", () => {
    const { card, metrics, health } = cardFor(growingTransactions());
    const expected = computeRecommendedLimit(metrics, health, card.risk_band);
    assert.strictEqual(card.recommended_limit, expected);
    assert.ok(computeRecommendedLimit(metrics, { ...health, score: 0, band: "at_risk" }, "high") <= 10_000_000);
  });

  test("confidence never fabricates reconciliation when no invoice data exists", () => {
    const { card } = cardFor(growingTransactions());
    assert.strictEqual(card.confidence.reconciliation_score, null);
    assert.strictEqual(card.confidence.method, "data_completeness_only (no invoice reconciliation data)");
    assert.ok(card.confidence.data_completeness > 0);
  });
});

describe("decision card endpoint and ledger wiring", () => {
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

  test("requires business_profile consent", async () => {
    const biz = await createBusiness({ legal_name: "Decision Consent Ltd" });
    const client = await api("POST", "/v1/clients", { body: { name: "decision-consent-client" } });
    const res = await api("POST", `/v1/businesses/${biz.id}/decision-card`, { apiKey: client.body.api_key });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.required_scope, "business_profile");
  });

  test("the local dashboard UI is served from the API origin", async () => {
    const page = await fetch(`${baseUrl}/dashboard/`);
    assert.strictEqual(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes("AfriScore"));
    assert.ok(html.includes("Lender card"));

    const script = await fetch(`${baseUrl}/dashboard/app.js`);
    assert.strictEqual(script.status, 200);
    assert.ok((await script.text()).includes("decision-card"));
  });

  test("issuing a card writes every metric and the decision to the ledger", async () => {
    const biz = await createBusiness({ legal_name: "Ledgered Decisions Ltd" });
    await api("POST", `/v1/businesses/${biz.id}/onboarding/consent`, { body: {} });
    const upload = await api("POST", `/v1/businesses/${biz.id}/statements`, {
      body: { source_type: "business_till", shortcode: "888888", content: fixture("till-clean.csv") },
    });
    assert.strictEqual(upload.status, 201);

    const client = await api("POST", "/v1/clients", { body: { name: "lender-client" } });
    await api("POST", "/v1/consents", {
      body: {
        subject_type: "business",
        subject_id: biz.id,
        grantee: "lender-client",
        purpose: "underwriting",
        scope: ["business_profile"],
      },
    });

    const issued = await api("POST", `/v1/businesses/${biz.id}/decision-card`, { apiKey: client.body.api_key });
    assert.strictEqual(issued.status, 201);
    const card = issued.body;
    assert.ok(card.audit_trail_ref, "decision card must carry a ledger audit reference");
    assert.ok(card.recommended_limit > 0);
    assert.deepStrictEqual(card.shortcodes, ["888888"]);
    assert.strictEqual(card.receivables, null);
    assert.ok(card.evidence.length >= 3);

    const ledger = await getLedger("business", biz.id);
    const metricEntries = ledger.filter((entry) => entry.event_type === "decision.metric_recorded");
    const decisionEntries = ledger.filter((entry) => entry.event_type === "decision.issued");
    assert.strictEqual(metricEntries.length, 8, "every derived metric is ledgered (including supply-chain signals)");
    assert.strictEqual(decisionEntries.length, 1);
    assert.strictEqual(decisionEntries[0].id, card.audit_trail_ref, "audit ref must identify the decision entry");

    const integrity = await verifyChainIntegrity("business", biz.id);
    assert.strictEqual(integrity.valid, true);
    assert.strictEqual(integrity.anchored, true);

    const second = await api("POST", `/v1/businesses/${biz.id}/decision-card`, { apiKey: client.body.api_key });
    assert.strictEqual(second.status, 201);
    assert.notStrictEqual(second.body.audit_trail_ref, card.audit_trail_ref);
    const ledgerAfter = await getLedger("business", biz.id);
    assert.strictEqual(ledgerAfter.filter((entry) => entry.event_type === "decision.issued").length, 2);
  });
});
