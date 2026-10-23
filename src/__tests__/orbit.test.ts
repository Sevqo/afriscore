import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "http";
import { configureTestEnv, truncateAll, removeSqliteFile } from "./helpers";

const { sqlitePath } = configureTestEnv("orbit");

import { migrate, dbRun, dbAll } from "../db";
import { createApp } from "../app";
import { getLedger, verifyChainIntegrity } from "../services/ledgerService";
import { getWorkflowView } from "../orbit/orbitService";
import { getOrbitQueues } from "../orbit/queue";
import { drainOrbit } from "./orbit-test-utils";

const FIXTURES = path.join(__dirname, "../../test-fixtures");
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), "utf8");

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

async function createBusiness(name: string): Promise<string> {
  const res = await api("POST", "/v1/businesses", { body: { legal_name: name } });
  assert.strictEqual(res.status, 201);
  return res.body.id;
}

async function onboard(businessId: string): Promise<void> {
  const res = await api("POST", `/v1/businesses/${businessId}/onboarding/consent`, { body: {} });
  assert.strictEqual(res.status, 201);
}

async function uploadStatement(businessId: string, body: Record<string, unknown>) {
  const res = await api("POST", `/v1/businesses/${businessId}/statements`, { body });
  assert.strictEqual(res.status, 202, JSON.stringify(res.body));
  await drainOrbit();
  return res.body as { workflow_id: string; job_id: string; duplicate: boolean };
}

async function workflow(businessId: string, workflowId: string) {
  const view = await getWorkflowView(workflowId);
  assert.ok(view, `workflow ${workflowId} for ${businessId} not found`);
  return view!;
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
  await getOrbitQueues().close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  removeSqliteFile(sqlitePath);
});

describe("Orbit statement ingestion pipeline", () => {
  test("upload returns a workflow id immediately and the pipeline reaches READY", async () => {
    const businessId = await createBusiness("Orbit Pipeline Ltd");
    await onboard(businessId);

    const accepted = await uploadStatement(businessId, {
      source_type: "business_till",
      shortcode: "123456",
      content: fixture("till-clean.csv"),
    });

    assert.ok(accepted.workflow_id);
    assert.ok(accepted.job_id);
    assert.strictEqual(accepted.duplicate, false);

    const view = await workflow(businessId, accepted.workflow_id);
    assert.strictEqual(view.workflow.state, "READY");
    assert.deepStrictEqual(
      view.history.map((entry) => entry.to_state),
      ["PENDING", "CONSENT_VERIFIED", "PARSING", "NORMALIZING", "RECONCILING", "SCORING", "READY"]
    );

    const txns = await api("GET", `/v1/businesses/${businessId}/transactions`);
    assert.ok(txns.body.length >= 20, "statement rows were written");

    const ledger = await getLedger("business", businessId);
    const ingested = ledger.filter((entry) => entry.event_type === "business.transaction.ingested");
    assert.strictEqual(ingested.length, txns.body.length, "each ingested transaction has a ledger entry");
    assert.ok(ledger.some((entry) => entry.event_type === "profile.scored"), "scoring ran");

    const integrity = await verifyChainIntegrity("business", businessId);
    assert.strictEqual(integrity.valid, true);
    assert.strictEqual(integrity.anchored, true);
  });

  test("the same statement twice is dropped idempotently (no duplicate rows or ledger entries)", async () => {
    const businessId = await createBusiness("Orbit Idempotent Ltd");
    await onboard(businessId);

    const content = fixture("bank-clean.csv");
    const first = await uploadStatement(businessId, { source_type: "bank", content });
    const afterFirstTxns = (await api("GET", `/v1/businesses/${businessId}/transactions`)).body.length as number;
    const afterFirstLedger = (await getLedger("business", businessId)).filter(
      (entry) => entry.event_type === "business.transaction.ingested"
    ).length;

    // Identical upload: same workflow id, duplicate flagged, queue drops job.
    const second = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "bank", content },
    });
    assert.strictEqual(second.status, 202);
    assert.strictEqual(second.body.duplicate, true);
    assert.strictEqual(second.body.workflow_id, first.workflow_id);
    await drainOrbit();

    const afterSecondTxns = (await api("GET", `/v1/businesses/${businessId}/transactions`)).body.length as number;
    const afterSecondLedger = (await getLedger("business", businessId)).filter(
      (entry) => entry.event_type === "business.transaction.ingested"
    ).length;

    assert.strictEqual(afterSecondTxns, afterFirstTxns, "duplicate upload must not create transactions");
    assert.strictEqual(afterSecondLedger, afterFirstLedger, "duplicate upload must not duplicate ledger entries");
  });

  test("a corrupted statement fails through the DLQ without crashing the worker", async () => {
    const businessId = await createBusiness("Orbit Failure Ltd");
    await onboard(businessId);

    const corrupted = "this is not,a statement\nfoo,bar,baz\n1,2,3";
    const accepted = await uploadStatement(businessId, { source_type: "business_till", shortcode: "999999", content: corrupted });

    const view = await workflow(businessId, accepted.workflow_id);
    assert.strictEqual(view.workflow.state, "FAILED_PARSING");
    assert.ok(view.workflow.error_message, "failure reason recorded on the workflow");
    assert.ok(view.dead_letter.length >= 1, "job was moved to the dead-letter table");
    assert.ok(view.dead_letter[0].error_message.length > 0);

    // The failed upload is still audited as a failed statement row.
    const statements = await api("GET", `/v1/businesses/${businessId}/statements`);
    assert.strictEqual(statements.body[0].status, "failed");
    assert.ok(statements.body[0].error_code);

    // The chain is intact: the failure event was written without breaking it.
    const integrity = await verifyChainIntegrity("business", businessId);
    assert.strictEqual(integrity.valid, true);
    const ledger = await getLedger("business", businessId);
    assert.ok(ledger.some((entry) => entry.event_type === "workflow.failed"));
  });

  test("the admin observability endpoint returns state, history and DLQ errors", async () => {
    const businessId = await createBusiness("Orbit Observability Ltd");
    await onboard(businessId);
    const accepted = await uploadStatement(businessId, { source_type: "bank", content: fixture("bank-clean.csv") });

    const res = await api("GET", `/v1/orbit/workflows/${accepted.workflow_id}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.workflow.id, accepted.workflow_id);
    assert.strictEqual(res.body.workflow.state, "READY");
    assert.ok(Array.isArray(res.body.history));
    assert.ok(res.body.history.length >= 6);
    assert.ok(Array.isArray(res.body.dead_letter));

    const anonymous = await api("GET", `/v1/orbit/workflows/${accepted.workflow_id}`, { admin: false });
    assert.strictEqual(anonymous.status, 401);

    const missing = await api("GET", "/v1/orbit/workflows/wf_does_not_exist");
    assert.strictEqual(missing.status, 404);
  });
});

describe("Orbit receivables matching pipeline", () => {
  before(async () => {
    await migrate();
    await truncateAll(dbRun);
  });

  test("a simulated payment matches an invoice, recalculates DSO and writes the ledger", async () => {
    const businessId = await createBusiness("Orbit Matching Ltd");
    await onboard(businessId);

    // Build a small deterministic statement with one payer.
    const content = [
      "Receipt No.,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance",
      'OM1,2026-07-01 09:00:00,Customer payment from 254711111111 ACME LTD,Completed,"4,000.00",,4000.00',
      'OM2,2026-07-05 09:00:00,Customer payment from 254722222222 JANE WANJIKU,Completed,"2,000.00",,6000.00',
      'OM3,2026-08-20 09:00:00,Customer payment from 254711111111 ACME LTD,Completed,"1,500.00",,7500.00',
    ].join("\n");
    await uploadStatement(businessId, { source_type: "business_till", shortcode: "777777", content });

    const invoice = await api("POST", `/v1/businesses/${businessId}/invoices`, {
      body: { customer_reference: "ACME LTD", amount: 4321.5, due_date: new Date(Date.now() + 14 * 864e5).toISOString() },
    });
    assert.strictEqual(invoice.status, 201);

    // A fresh incoming payment (not in the statement) for exactly the invoice.
    const payment = await api("POST", `/v1/businesses/${businessId}/payments/simulate`, {
      body: { amount: 4321.5, reference: "QTESTPAY001", counterparty: "ACME LTD" },
    });
    assert.strictEqual(payment.status, 200);
    assert.ok(payment.body.workflow_id);

    await drainOrbit();

    const view = await workflow(businessId, payment.body.workflow_id);
    assert.strictEqual(view.workflow.state, "READY");

    const invoiceDetail = await api("GET", `/v1/businesses/${businessId}/invoices/${invoice.body.id}`);
    assert.strictEqual(invoiceDetail.body.invoice.status, "paid");
    assert.ok(invoiceDetail.body.payments.length >= 1);

    const ledger = await getLedger("business", businessId);
    assert.ok(ledger.some((entry) => entry.event_type === "payment.matched"), "match event written");
    assert.ok(ledger.some((entry) => entry.event_type === "invoice.paid"), "settlement written to the ledger");
    assert.ok(ledger.some((entry) => entry.event_type === "profile.scored"), "DSO recalc wrote a scoring event");

    const dsoEvent = await dbAll<{ event_data: string }>(
      `SELECT event_data FROM ledger WHERE event_type = 'profile.scored' AND subject_id = ? ORDER BY seq DESC LIMIT 1`,
      [businessId]
    );
    assert.ok(dsoEvent.length > 0);
    assert.ok(String(dsoEvent[0].event_data).includes("dso_days"));

    const integrity = await verifyChainIntegrity("business", businessId);
    assert.strictEqual(integrity.valid, true);
  });

  test("an unmatched payment is parked for review", async () => {
    const businessId = await createBusiness("Orbit Unmatched Ltd");
    await onboard(businessId);
    await uploadStatement(businessId, { source_type: "bank", content: fixture("bank-clean.csv") });

    // No invoices exist for this business, so nothing can match.
    const payment = await api("POST", `/v1/businesses/${businessId}/payments/simulate`, {
      body: { amount: 123456.78, reference: "QTESTPAY002", counterparty: "UNKNOWN PAYER" },
    });
    assert.strictEqual(payment.status, 200);
    await drainOrbit();

    const parked = await dbAll<{ id: string; reason: string; status: string }>(
      `SELECT id, reason, status FROM unmatched_payments WHERE business_id = ?`,
      [businessId]
    );
    assert.strictEqual(parked.length, 1);
    assert.strictEqual(parked[0].status, "open");
    assert.strictEqual(parked[0].reason, "no_matching_invoice");

    const view = await workflow(businessId, payment.body.workflow_id);
    assert.strictEqual(view.workflow.state, "READY");
    assert.ok(view.history.some((entry) => entry.to_state === "READY"));
  });

  test("a retried payment webhook is idempotent", async () => {
    const businessId = await createBusiness("Orbit Payment Retry Ltd");
    const first = await api("POST", `/v1/businesses/${businessId}/payments/simulate`, {
      body: { amount: 500, reference: "QRETRY0001" },
    });
    assert.strictEqual(first.status, 200);
    await drainOrbit();

    const second = await api("POST", `/v1/businesses/${businessId}/payments/simulate`, {
      body: { amount: 500, reference: "QRETRY0001" },
    });
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.duplicate, true);
    assert.strictEqual(second.body.workflow_id, first.body.workflow_id);
    await drainOrbit();

    const payments = await dbAll<{ id: string }>(`SELECT id FROM unmatched_payments WHERE business_id = ?`, [businessId]);
    assert.strictEqual(payments.length, 1, "the retried webhook must not create a second payment record");
  });
});
