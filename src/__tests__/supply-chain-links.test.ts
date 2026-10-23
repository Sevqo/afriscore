import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "http";
import { configureTestEnv, truncateAll, removeSqliteFile } from "./helpers";

const { sqlitePath } = configureTestEnv("supply-chain-links");

import { migrate, dbRun } from "../db";
import { createApp } from "../app";
import { drainOrbit } from "./orbit-test-utils";
import { computeBusinessMetrics } from "../services/businessMetricsService";
import { computeSupplyChainReadiness } from "../services/supplyChainService";
import { ReceivablesSummary } from "../services/receivablesService";
import { getLedger, verifyChainIntegrity } from "../services/ledgerService";
import { Transaction } from "../services/transactionService";

const FIXTURES = path.join(__dirname, "../../test-fixtures");
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), "utf8");
const NOW = new Date("2026-10-15T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString();
const daysAhead = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString();

function iso(date: string): string {
  return `${date}T09:00:00.000Z`;
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

function receivablesWith(matchedRatio: number | null, openValue = 5000): ReceivablesSummary {
  return {
    open_invoice_count: matchedRatio === null ? 0 : 2,
    open_invoice_value: openValue,
    overdue_invoice_count: 0,
    dso_days: 42,
    average_days_to_pay: 30,
    matched_payment_ratio: matchedRatio,
    window_days: 365,
    method: "test",
  };
}

const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

/** Repeat, regular anchor buyer + regular supplier. */
function anchorTransactions(): Transaction[] {
  const rows: Transaction[] = [];
  MONTHS.forEach((month) => {
    rows.push(txn({ amount: 6000, type: "credit", counterparty: "ACME WHOLESALERS LTD", occurred_at: iso(`${month}-05`) }));
    rows.push(txn({ amount: 2000, type: "credit", counterparty: "JANE WANJIKU", occurred_at: iso(`${month}-12`) }));
    rows.push(txn({ amount: 2000, type: "credit", counterparty: "KENYA HARDWARE", occurred_at: iso(`${month}-18`) }));
    rows.push(txn({ amount: 1500, type: "debit", counterparty: "NAIROBI SUPPLIES", occurred_at: iso(`${month}-22`) }));
  });
  return rows;
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

async function createBusiness(name: string): Promise<string> {
  const res = await api("POST", "/v1/businesses", { body: { legal_name: name, sector: "retail" } });
  assert.strictEqual(res.status, 201);
  return res.body.id;
}

async function createPerson(name: string): Promise<string> {
  const res = await api("POST", "/v1/persons", { body: { full_name: name, national_id: "33334444" } });
  assert.strictEqual(res.status, 201);
  return res.body.id;
}

async function onboard(businessId: string): Promise<void> {
  const res = await api("POST", `/v1/businesses/${businessId}/onboarding/consent`, { body: {} });
  assert.strictEqual(res.status, 201);
}

async function grantConsent(businessId: string, clientName: string, scope: string[]): Promise<string> {
  const res = await api("POST", "/v1/consents", {
    body: { subject_type: "business", subject_id: businessId, grantee: clientName, purpose: "underwriting", scope },
  });
  assert.strictEqual(res.status, 201);
  return res.body.id;
}

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

describe("supply-chain readiness signals", () => {
  test("a repeat, regular buyer above threshold is an anchor candidate, not a concentration warning", () => {
    const metrics = computeBusinessMetrics(anchorTransactions(), { now: NOW });
    const readiness = computeSupplyChainReadiness(metrics, receivablesWith(1));

    assert.strictEqual(readiness.anchor_buyer.candidate, "ACME WHOLESALERS LTD");
    assert.strictEqual(readiness.anchor_buyer.signal, "verified_anchor_candidate");
    assert.strictEqual(readiness.anchor_buyer.repeat_payments, 6);
    assert.strictEqual(readiness.anchor_buyer.active_months, 6);
    assert.strictEqual(readiness.concentration_warning, false, "a verified anchor is an opportunity, not a warning");
    assert.strictEqual(readiness.supplier_regularity.signal, "established");
    assert.strictEqual(readiness.receivable_verifiability.signal, "verifiable");
    assert.ok(readiness.summary.length > 0);
  });

  test("a dominant one-off buyer is flagged as concentration risk", () => {
    const rows = [
      txn({ amount: 70000, type: "credit", counterparty: "ONLY BUYER", occurred_at: iso("2026-09-05") }),
      txn({ amount: 10000, type: "credit", counterparty: "SMALL BUYER", occurred_at: iso("2026-08-05") }),
      txn({ amount: 10000, type: "credit", counterparty: "OTHER BUYER", occurred_at: iso("2026-07-05") }),
      txn({ amount: 10000, type: "credit", counterparty: "THIRD BUYER", occurred_at: iso("2026-06-05") }),
    ];
    const metrics = computeBusinessMetrics(rows, { now: NOW });
    const readiness = computeSupplyChainReadiness(metrics, null);

    assert.strictEqual(readiness.anchor_buyer.signal, "concentration_risk");
    assert.strictEqual(readiness.concentration_warning, true);
    assert.strictEqual(readiness.receivable_verifiability.signal, "no_invoice_data");
    assert.ok(readiness.summary.toLowerCase().includes("concentration warning"));
  });

  test("receivable verifiability distinguishes verified, partial and unverified invoices", () => {
    const metrics = computeBusinessMetrics(anchorTransactions(), { now: NOW });
    assert.strictEqual(computeSupplyChainReadiness(metrics, receivablesWith(1)).receivable_verifiability.signal, "verifiable");
    assert.strictEqual(computeSupplyChainReadiness(metrics, receivablesWith(0.5)).receivable_verifiability.signal, "partial");
    assert.strictEqual(computeSupplyChainReadiness(metrics, receivablesWith(0)).receivable_verifiability.signal, "unverifiable");
    assert.strictEqual(computeSupplyChainReadiness(metrics, null).receivable_verifiability.signal, "no_invoice_data");
  });

  test("supplier relationships without repeat payments are reported as none", () => {
    const rows = anchorTransactions().filter((row) => row.type === "credit");
    const metrics = computeBusinessMetrics(rows, { now: NOW });
    const readiness = computeSupplyChainReadiness(metrics, null);
    assert.strictEqual(readiness.supplier_regularity.signal, "none");
    assert.strictEqual(readiness.supplier_regularity.repeat_supplier_count, 0);
  });
});

describe("supply chain on dashboard and decision card", () => {
  test("dashboard and decision card expose readiness and ledger the signals", async () => {
    const businessId = await createBusiness("Supply Chain Ltd");
    await onboard(businessId);
    const upload = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "business_till", shortcode: "666666", content: fixture("till-clean.csv") },
    });
    assert.strictEqual(upload.status, 202);
    await drainOrbit();

    const invoice = await api("POST", `/v1/businesses/${businessId}/invoices`, {
      body: { customer_reference: "ACME WHOLESALERS LTD", amount: 4000, issue_date: daysAgo(20), due_date: daysAhead(10) },
    });
    assert.strictEqual(invoice.status, 201);
    await api("POST", `/v1/businesses/${businessId}/invoices/${invoice.body.id}/payments`, {
      body: { amount: 1000, method: "mpesa" },
    });

    const client = await api("POST", "/v1/clients", { body: { name: "supply-chain-client" } });
    await grantConsent(businessId, "supply-chain-client", ["business_profile"]);

    const dashboard = await api("GET", `/v1/businesses/${businessId}/business-profile`, { apiKey: client.body.api_key });
    assert.strictEqual(dashboard.status, 200);
    const readiness = dashboard.body.supply_chain_readiness;
    assert.ok(readiness);
    assert.ok(["verified_anchor_candidate", "concentration_risk", "no_anchor"].includes(readiness.anchor_buyer.signal));
    assert.ok(readiness.summary.length > 0);
    assert.ok(readiness.receivable_verifiability.matched_payment_ratio !== null);

    const card = await api("POST", `/v1/businesses/${businessId}/decision-card`, { apiKey: client.body.api_key });
    assert.strictEqual(card.status, 201);
    assert.ok(card.body.supply_chain_readiness);
    assert.strictEqual(card.body.supply_chain_readiness.anchor_buyer.signal, readiness.anchor_buyer.signal);

    const ledger = await getLedger("business", businessId);
    assert.strictEqual(ledger.filter((entry) => entry.event_type === "decision.metric_recorded").length, 8);
  });
});

describe("dual-mode linked profiles", () => {
  test("linking is explicit, idempotent and never merges data", async () => {
    const businessId = await createBusiness("Linked Business Ltd");
    const personId = await createPerson("Linked Person");

    const beforeBusinessLedger = await getLedger("business", businessId);
    const beforePersonLedger = await getLedger("person", personId);

    const first = await api("POST", `/v1/businesses/${businessId}/links`, { body: { person_id: personId } });
    assert.strictEqual(first.status, 201);
    assert.strictEqual(first.body.created, true);

    const duplicate = await api("POST", `/v1/businesses/${businessId}/links`, { body: { person_id: personId } });
    assert.strictEqual(duplicate.status, 200);
    assert.strictEqual(duplicate.body.created, false);

    const links = await api("GET", `/v1/businesses/${businessId}/links`);
    assert.strictEqual(links.body.length, 1);
    assert.strictEqual(links.body[0].person_id, personId);

    const view = await api("GET", `/v1/businesses/${businessId}/linked-profiles`);
    assert.strictEqual(view.status, 200);
    assert.strictEqual(view.body.linked, true);
    assert.strictEqual(view.body.business.id, businessId);
    assert.strictEqual(view.body.persons.length, 1);
    assert.strictEqual(view.body.persons[0].id, personId);
    assert.ok(view.body.isolation_note.includes("separate ledgers"));

    // Ledgers grew only by the explicit link events, and both still verify.
    const afterBusinessLedger = await getLedger("business", businessId);
    const afterPersonLedger = await getLedger("person", personId);
    assert.strictEqual(afterBusinessLedger.length, beforeBusinessLedger.length + 1);
    assert.strictEqual(afterPersonLedger.length, beforePersonLedger.length + 1);
    assert.strictEqual((await verifyChainIntegrity("business", businessId)).valid, true);
    assert.strictEqual((await verifyChainIntegrity("person", personId)).valid, true);

    // Business transaction stream is unaffected by linking.
    const txns = await api("GET", `/v1/businesses/${businessId}/transactions`);
    assert.strictEqual(txns.body.length, 0);

    const unlinked = await api("DELETE", `/v1/businesses/${businessId}/links/${personId}`);
    assert.strictEqual(unlinked.status, 200);
    assert.strictEqual((await api("GET", `/v1/businesses/${businessId}/links`)).body.length, 0);
    assert.strictEqual((await api("DELETE", `/v1/businesses/${businessId}/links/${personId}`)).status, 404);
  });

  test("linking validates both subjects", async () => {
    const businessId = await createBusiness("Validation Link Ltd");
    const missingPerson = await api("POST", `/v1/businesses/${businessId}/links`, {
      body: { person_id: "00000000-0000-0000-0000-000000000000" },
    });
    assert.strictEqual(missingPerson.status, 404);
    assert.strictEqual(missingPerson.body.error, "person_not_found");

    const personId = await createPerson("Valid Person");
    const missingBusiness = await api("POST", "/v1/businesses/00000000-0000-0000-0000-000000000000/links", {
      body: { person_id: personId },
    });
    assert.strictEqual(missingBusiness.status, 404);
  });

  test("consent stays per-subject even when profiles are linked", async () => {
    const businessId = await createBusiness("Consent Isolation Ltd");
    const personId = await createPerson("Consent Person");
    await api("POST", `/v1/businesses/${businessId}/links`, { body: { person_id: personId } });

    const client = await api("POST", "/v1/clients", { body: { name: "linked-consent-client" } });
    const businessConsent = await grantConsent(businessId, "linked-consent-client", ["business_profile"]);
    const personConsent = await api("POST", "/v1/consents", {
      body: {
        subject_type: "person",
        subject_id: personId,
        grantee: "linked-consent-client",
        purpose: "underwriting",
        scope: ["trust_score"],
      },
    });
    assert.strictEqual(personConsent.status, 201);

    const businessBefore = await api("GET", `/v1/businesses/${businessId}/business-profile`, { apiKey: client.body.api_key });
    const personBefore = await api("GET", `/v1/persons/${personId}/trust-record`, { apiKey: client.body.api_key });
    assert.strictEqual(businessBefore.status, 200);
    assert.strictEqual(personBefore.status, 200);

    // Revoking the business grant must not affect the person's profile.
    await api("DELETE", `/v1/consents/${businessConsent}`);
    const businessAfter = await api("GET", `/v1/businesses/${businessId}/business-profile`, { apiKey: client.body.api_key });
    const personAfter = await api("GET", `/v1/persons/${personId}/trust-record`, { apiKey: client.body.api_key });
    assert.strictEqual(businessAfter.status, 403, "revoked business consent blocks business reads");
    assert.strictEqual(personAfter.status, 200, "linked person profile is unaffected by business consent");
  });

  test("with no link the profiles are isolated by default", async () => {
    const businessId = await createBusiness("Unlinked Business Ltd");
    const personId = await createPerson("Unlinked Person");

    const view = await api("GET", `/v1/businesses/${businessId}/linked-profiles`);
    assert.strictEqual(view.body.linked, false);
    assert.strictEqual(view.body.persons.length, 0);

    const client = await api("POST", "/v1/clients", { body: { name: "unlinked-client" } });
    await grantConsent(businessId, "unlinked-client", ["business_profile"]);
    const personRead = await api("GET", `/v1/persons/${personId}/trust-record`, { apiKey: client.body.api_key });
    assert.strictEqual(personRead.status, 403, "business consent never grants person access");
  });
});
