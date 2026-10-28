import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "http";
import { configureTestEnv, truncateAll, removeSqliteFile } from "./helpers";

const { sqlitePath } = configureTestEnv("receivables");

import { migrate, dbRun } from "../db";
import { createApp } from "../app";
import { drainOrbit } from "./orbit-test-utils";
import { getLedger } from "../services/ledgerService";

const FIXTURES = path.join(__dirname, "../../test-fixtures");
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), "utf8");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString();
const daysAhead = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString();

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

async function createBusiness(name = "Receivables Ltd"): Promise<string> {
  const res = await api("POST", "/v1/businesses", { body: { legal_name: name } });
  assert.strictEqual(res.status, 201);
  return res.body.id as string;
}

async function onboard(businessId: string): Promise<void> {
  const res = await api("POST", `/v1/businesses/${businessId}/onboarding/consent`, { body: {} });
  assert.strictEqual(res.status, 201);
}

async function createInvoice(businessId: string, body: Record<string, unknown>): Promise<any> {
  const res = await api("POST", `/v1/businesses/${businessId}/invoices`, {
    body: { customer_reference: "Test Customer", amount: 10000, ...body },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

async function grantProfileConsent(businessId: string, clientName: string): Promise<void> {
  const res = await api("POST", "/v1/consents", {
    body: {
      subject_type: "business",
      subject_id: businessId,
      grantee: clientName,
      purpose: "underwriting",
      scope: ["business_profile"],
    },
  });
  assert.strictEqual(res.status, 201);
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

describe("receivables lifecycle", () => {
  test("draft invoices are excluded from collection until sent", async () => {
    const businessId = await createBusiness("Draft Invoices Ltd");
    const draft = await createInvoice(businessId, {
      status: "draft",
      amount: 5000,
      due_date: daysAhead(14),
    });
    assert.strictEqual(draft.status, "draft");

    const summary = await api("GET", `/v1/businesses/${businessId}/receivables/summary`);
    assert.strictEqual(summary.status, 200);
    assert.strictEqual(summary.body.receivables.open_invoice_count, 0, "drafts are not receivables yet");

    const sent = await api("POST", `/v1/businesses/${businessId}/invoices/${draft.id}/send`);
    assert.strictEqual(sent.status, 200);
    assert.strictEqual(sent.body.status, "sent");

    const after = await api("GET", `/v1/businesses/${businessId}/receivables/summary`);
    assert.strictEqual(after.body.receivables.open_invoice_count, 1);

    const invalid = await api("POST", `/v1/businesses/${businessId}/invoices/${draft.id}/send`);
    assert.strictEqual(invalid.status, 409);
    assert.strictEqual(invalid.body.error, "invoice_not_draft");
  });

  test("partial payments accumulate into a paid invoice with ledger entries", async () => {
    const businessId = await createBusiness("Partial Payments Ltd");
    const invoice = await createInvoice(businessId, { amount: 10000, due_date: daysAhead(30) });

    const first = await api("POST", `/v1/businesses/${businessId}/invoices/${invoice.id}/payments`, {
      body: { amount: 4000, method: "mpesa", reference: "QPAY1" },
    });
    assert.strictEqual(first.status, 201);
    assert.strictEqual(first.body.fully_paid, false);
    assert.strictEqual(first.body.invoice.status, "partially_paid");
    assert.strictEqual(first.body.invoice.paid_amount, 4000);

    const detail = await api("GET", `/v1/businesses/${businessId}/invoices/${invoice.id}`);
    assert.strictEqual(detail.body.payments.length, 1);

    const second = await api("POST", `/v1/businesses/${businessId}/invoices/${invoice.id}/payments`, {
      body: { amount: 6000, method: "bank", reference: "BNK1" },
    });
    assert.strictEqual(second.status, 201);
    assert.strictEqual(second.body.fully_paid, true);
    assert.strictEqual(second.body.invoice.status, "paid");
    assert.ok(second.body.invoice.paid_at);

    const overpay = await api("POST", `/v1/businesses/${businessId}/invoices/${invoice.id}/payments`, {
      body: { amount: 1, method: "manual" },
    });
    assert.strictEqual(overpay.status, 400);
    assert.strictEqual(overpay.body.error, "amount_exceeds_balance");

    const ledger = await getLedger("business", businessId);
    assert.strictEqual(ledger.filter((entry) => entry.event_type === "invoice.payment_recorded").length, 2);
  });

  test("payments larger than the outstanding balance are rejected", async () => {
    const businessId = await createBusiness("Overpayment Ltd");
    const invoice = await createInvoice(businessId, { amount: 1000, due_date: daysAhead(5) });
    const res = await api("POST", `/v1/businesses/${businessId}/invoices/${invoice.id}/payments`, {
      body: { amount: 1500, method: "mpesa" },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "amount_exceeds_balance");
  });

  test("overdue status is derived from the due date", async () => {
    const businessId = await createBusiness("Overdue Ltd");
    const invoice = await createInvoice(businessId, {
      amount: 3000,
      issue_date: daysAgo(60),
      due_date: daysAgo(30),
    });
    const listed = await api("GET", `/v1/businesses/${businessId}/invoices`);
    const found = listed.body.find((entry: any) => entry.id === invoice.id);
    assert.strictEqual(found.status, "overdue");

    const summary = await api("GET", `/v1/businesses/${businessId}/receivables/summary`);
    assert.strictEqual(summary.body.receivables.overdue_invoice_count, 1);
    assert.strictEqual(summary.body.receivables.open_invoice_value, 3000);
  });

  test("DSO and average days to pay are computed from invoices, not cash flow", async () => {
    const businessId = await createBusiness("DSO Ltd");
    const paidInvoice = await createInvoice(businessId, {
      amount: 10000,
      issue_date: daysAgo(100),
      due_date: daysAgo(70),
    });
    await api("POST", `/v1/businesses/${businessId}/invoices/${paidInvoice.id}/payments`, {
      body: { amount: 10000, method: "bank" },
    });
    await createInvoice(businessId, { amount: 5000, issue_date: daysAgo(50), due_date: daysAhead(10) });

    const summary = await api("GET", `/v1/businesses/${businessId}/receivables/summary`);
    const receivables = summary.body.receivables;
    assert.strictEqual(receivables.open_invoice_count, 1);
    assert.strictEqual(receivables.open_invoice_value, 5000);
    // 5000 open / 15000 invoiced in the 365-day window * 365 = 121.7 days.
    assert.ok(Math.abs(receivables.dso_days - 121.7) < 1, `unexpected DSO ${receivables.dso_days}`);
    assert.ok(Math.abs(receivables.average_days_to_pay - 100) < 1, `unexpected average days to pay ${receivables.average_days_to_pay}`);
    assert.ok(receivables.method.includes("open_receivables"));
  });

  test("with no invoices, receivables is null and never fabricated", async () => {
    const businessId = await createBusiness("No Invoices Ltd");
    const summary = await api("GET", `/v1/businesses/${businessId}/receivables/summary`);
    assert.strictEqual(summary.status, 200);
    assert.strictEqual(summary.body.receivables, null);
    assert.ok(summary.body.note.includes("not fabricated"));
  });
});

describe("automatic payment matching", () => {
  async function businessWithTransactions(name: string): Promise<string> {
    const businessId = await createBusiness(name);
    await onboard(businessId);
    const upload = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "business_till", shortcode: "999999", content: fixture("till-clean.csv") },
    });
    assert.strictEqual(upload.status, 202);
    await drainOrbit();
    return businessId;
  }

  test("full settlement matches an invoice and claims the transaction", async () => {
    const businessId = await businessWithTransactions("Auto Match Ltd");
    const txns = await api("GET", `/v1/businesses/${businessId}/transactions`);
    const credit = txns.body.find((txn: any) => txn.type === "credit" && txn.status === "completed");
    assert.ok(credit);

    const invoice = await createInvoice(businessId, {
      amount: credit.amount,
      customer_reference: credit.counterparty ?? "Customer",
      due_date: daysAhead(30),
    });

    const match = await api("POST", `/v1/businesses/${businessId}/receivables/match`);
    assert.strictEqual(match.status, 200);
    assert.ok(match.body.settled_invoices >= 1);

    const detail = await api("GET", `/v1/businesses/${businessId}/invoices/${invoice.id}`);
    assert.strictEqual(detail.body.invoice.status, "paid");
    assert.ok(detail.body.payments.length >= 1);
    assert.ok(detail.body.payments.some((payment: any) => payment.transaction_id === credit.id));

    const queue = await api("GET", `/v1/businesses/${businessId}/receivables/review-queue`);
    assert.ok(!queue.body.transactions.some((txn: any) => txn.id === credit.id), "matched payment must leave the review queue");
  });

  test("a smaller payment with an agreeing counterparty becomes a partial receipt", async () => {
    // Deliberately small, controlled statement: one repeat payer whose
    // payments can never fully settle the invoice below.
    const content = [
      "Receipt No.,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance",
      'RPA1,2026-07-01 09:00:00,Customer payment from 254711111111 ACME LTD,Completed,"2,000.00",,2000.00',
      'RPA2,2026-07-05 09:00:00,Customer payment from 254722222222 JANE WANJIKU,Completed,"3,000.00",,5000.00',
      'RPA3,2026-08-20 09:00:00,Customer payment from 254711111111 ACME LTD,Completed,"2,500.00",,7500.00',
    ].join("\n");

    const businessId = await createBusiness("Partial Auto Match Ltd");
    await onboard(businessId);
    const upload = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "business_till", shortcode: "444444", content },
    });
    assert.strictEqual(upload.status, 202);
    await drainOrbit();

    const invoice = await createInvoice(businessId, {
      amount: 9000,
      customer_reference: "ACME LTD",
      due_date: daysAhead(30),
    });

    const match = await api("POST", `/v1/businesses/${businessId}/receivables/match`);
    assert.strictEqual(match.status, 200);
    assert.ok(match.body.partially_paid_invoices >= 1, JSON.stringify(match.body));

    const detail = await api("GET", `/v1/businesses/${businessId}/invoices/${invoice.id}`);
    assert.strictEqual(detail.body.invoice.status, "partially_paid");
    assert.ok(detail.body.invoice.paid_amount > 0);
  });

  test("unmatched incoming payments appear in the review queue", async () => {
    const businessId = await businessWithTransactions("Review Queue Ltd");
    const queue = await api("GET", `/v1/businesses/${businessId}/receivables/review-queue`);
    assert.strictEqual(queue.status, 200);
    assert.ok(queue.body.count > 0);
    assert.ok(queue.body.transactions.every((txn: any) => txn.reason === "no_open_invoice_match"));
  });
});

describe("receivables feed the dashboard and decision card", () => {
  test("dashboard and decision card expose real receivables when invoices exist", async () => {
    const businessId = await createBusiness("Receivables Dashboard Ltd");
    await onboard(businessId);
    const upload = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "business_till", shortcode: "555555", content: fixture("till-clean.csv") },
    });
    assert.strictEqual(upload.status, 202);
    await drainOrbit();

    const invoice = await createInvoice(businessId, {
      amount: 4000,
      issue_date: daysAgo(20),
      due_date: daysAhead(10),
    });
    await api("POST", `/v1/businesses/${businessId}/invoices/${invoice.id}/payments`, {
      body: { amount: 1500, method: "mpesa" },
    });

    const client = await api("POST", "/v1/clients", { body: { name: "receivables-client" } });
    await grantProfileConsent(businessId, "receivables-client");

    const dashboard = await api("GET", `/v1/businesses/${businessId}/business-profile`, {
      apiKey: client.body.api_key,
    });
    assert.strictEqual(dashboard.status, 200);
    assert.strictEqual(dashboard.body.receivables.open_invoice_count, 1);
    assert.strictEqual(dashboard.body.receivables.open_invoice_value, 2500);
    assert.ok(dashboard.body.receivables.dso_days !== null);
    assert.strictEqual(dashboard.body.receivables.matched_payment_ratio, 0, 'Manual receipts are not independently matched transaction evidence');

    const card = await api("POST", `/v1/businesses/${businessId}/decision-card`, { apiKey: client.body.api_key });
    assert.strictEqual(card.status, 201);
    assert.ok(card.body.receivables, "decision card must carry receivables when invoice data exists");
    assert.strictEqual(card.body.receivables.open_invoice_value, 2500);
    assert.ok(card.body.confidence.reconciliation_score !== null, "reconciliation confidence becomes available with invoice data");
  });

  test("the individual/person flow still works alongside the business track", async () => {
    const person = await api("POST", "/v1/persons", { body: { full_name: "Untouched Person", national_id: "77778888" } });
    assert.strictEqual(person.status, 201);
    const verified = await api("POST", `/v1/persons/${person.body.id}/verify`);
    assert.strictEqual(verified.status, 200);
    assert.strictEqual(verified.body.person.status, "verified");
  });
});
