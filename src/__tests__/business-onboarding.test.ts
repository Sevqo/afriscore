import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "http";
import { configureTestEnv, truncateAll, removeSqliteFile } from "./helpers";

const { sqlitePath } = configureTestEnv("business-onboarding");

import { migrate, dbRun } from "../db";
import { createApp } from "../app";
import { getLedger, verifyChainIntegrity } from "../services/ledgerService";
import { parseStatement, StatementParseError } from "../services/statement/parser";
import { parseCsv } from "../services/statement/csv";
import { drainOrbit } from "./orbit-test-utils";

const FIXTURES = path.join(__dirname, "../../test-fixtures");
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), "utf8");

let server: Server;
let baseUrl: string;

async function api(method: string, urlPath: string, opts: { body?: unknown } = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: { "Content-Type": "application/json", "x-admin-token": process.env.AFRISCORE_ADMIN_TOKEN! },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json as any };
}

async function createBusiness(name: string, sector = "retail"): Promise<string> {
  const res = await api("POST", "/v1/businesses", { body: { legal_name: name, sector, registration_number: `REG-${name.length}` } });
  assert.strictEqual(res.status, 201);
  return res.body.id;
}

async function onboard(businessId: string): Promise<string> {
  const res = await api("POST", `/v1/businesses/${businessId}/onboarding/consent`, { body: { purpose: "business_onboarding" } });
  assert.strictEqual(res.status, 201);
  return res.body.consent.id;
}

describe("statement parsing", () => {
  test("CSV reader handles quoted amounts and CRLF", () => {
    const rows = parseCsv('a,b\r\n"1,250.00",x\r\n');
    assert.deepStrictEqual(rows, [
      ["a", "b"],
      ["1,250.00", "x"],
    ]);
  });

  test("clean till statement normalizes into the canonical transaction shape", () => {
    const parsed = parseStatement("business_till", fixture("till-clean.csv"), { shortcode: "123456" });
    assert.strictEqual(parsed.sourceType, "business_till");
    assert.strictEqual(parsed.shortcode, "123456");
    assert.ok(parsed.rows.length >= 20);
    assert.ok(parsed.rows.some((row) => row.type === "credit"));
    assert.ok(parsed.rows.some((row) => row.type === "debit"));
    assert.ok(parsed.rows.some((row) => row.counterparty?.includes("ACME")));
    assert.ok(parsed.rows.every((row) => row.amount > 0 && row.occurred_at.endsWith("Z")));
    const spanDays = (new Date(parsed.periodEnd).getTime() - new Date(parsed.periodStart).getTime()) / 86_400_000;
    assert.ok(spanDays >= 30);
  });

  test("a statement with under 30 days of history is rejected explicitly", () => {
    assert.throws(
      () => parseStatement("business_till", fixture("till-sparse.csv"), { shortcode: "123456" }),
      (err: unknown) => err instanceof StatementParseError && err.code === "insufficient_history"
    );
  });

  test("bank statement parses debit and credit columns", () => {
    const parsed = parseStatement("bank", fixture("bank-clean.csv"));
    assert.ok(parsed.rows.length >= 10);
    assert.ok(parsed.rows.some((row) => row.type === "credit"));
    assert.ok(parsed.rows.some((row) => row.type === "debit"));
  });

  test("mixed till and bank statements normalize to the same row shape", () => {
    const till = parseStatement("business_till", fixture("till-clean.csv"), { shortcode: "123456" });
    const bank = parseStatement("bank", fixture("bank-clean.csv"));
    const keys = Object.keys(till.rows[0]).sort();
    assert.deepStrictEqual(Object.keys(bank.rows[0]).sort(), keys);
  });

  test("individual M-Pesa statement parses via the individual source", () => {
    const parsed = parseStatement("individual_mpesa", fixture("mpesa-individual.csv"));
    assert.ok(parsed.rows.length >= 8);
    assert.ok(parsed.rows.some((row) => row.counterparty?.includes("2547")));
  });

  test("parse failures are typed and specific", () => {
    assert.throws(
      () => parseStatement("business_till", fixture("bank-clean.csv"), { shortcode: "123456" }),
      (err: unknown) => err instanceof StatementParseError && err.code === "wrong_statement_type"
    );
    assert.throws(
      () => parseStatement("business_till", "", { shortcode: "123456" }),
      (err: unknown) => err instanceof StatementParseError && err.code === "unreadable_file"
    );
    assert.throws(
      () => parseStatement("business_paybill", fixture("till-clean.csv")),
      (err: unknown) => err instanceof StatementParseError && err.code === "missing_shortcode"
    );
  });
});

async function uploadStatement(businessId: string, body: Record<string, unknown>) {
  const res = await api("POST", `/v1/businesses/${businessId}/statements`, { body });
  assert.strictEqual(res.status, 202, JSON.stringify(res.body));
  await drainOrbit();
  return res.body as { workflow_id: string; job_id: string; duplicate: boolean };
}

async function statementRows(businessId: string): Promise<any[]> {
  const res = await api("GET", `/v1/businesses/${businessId}/statements`);
  assert.strictEqual(res.status, 200);
  return res.body;
}

describe("business onboarding flow", () => {
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

  test("no statement is parsed before business consent exists", async () => {
    const businessId = await createBusiness("Consent First Ltd");
    const blocked = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "business_till", shortcode: "111111", content: fixture("till-clean.csv") },
    });
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual(blocked.body.error, "consent_required");
    assert.strictEqual(blocked.body.required_scope, "statements");

    await onboard(businessId);
    const accepted = await uploadStatement(businessId, {
      source_type: "business_till",
      shortcode: "111111",
      content: fixture("till-clean.csv"),
    });
    assert.ok(accepted.workflow_id, "upload returns a workflow id immediately");

    const rows = await statementRows(businessId);
    assert.ok(rows[0].imported_count >= 20, "the async pipeline imported the rows");
  });

  test("ingested rows are canonical, tagged and deduplicated on re-upload", async () => {
    const businessId = await createBusiness("Tagger Ltd");
    await onboard(businessId);

    await uploadStatement(businessId, {
      source_type: "business_till",
      shortcode: "222222",
      content: fixture("till-clean.csv"),
      file_name: "statement.csv",
    });
    const imported = (await statementRows(businessId))[0].imported_count as number;
    assert.ok(imported > 0);

    const txns = await api("GET", `/v1/businesses/${businessId}/transactions`);
    assert.strictEqual(txns.status, 200);
    const firstTxn = txns.body[0];
    assert.strictEqual(firstTxn.subject_type, "business");
    assert.strictEqual(firstTxn.shortcode, "222222");
    assert.strictEqual(firstTxn.source_provider, "mpesa_till");
    assert.ok(firstTxn.statement_id);

    // Identical re-upload: same workflow, duplicate flagged, no new rows.
    const second = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "business_till", shortcode: "222222", content: fixture("till-clean.csv") },
    });
    assert.strictEqual(second.status, 202);
    assert.strictEqual(second.body.duplicate, true);
    await drainOrbit();

    const txnsAfter = await api("GET", `/v1/businesses/${businessId}/transactions`);
    assert.strictEqual(txnsAfter.body.length, imported, "duplicate upload must not create transactions");
  });

  test("a failed upload fails gracefully through Orbit and is still audited", async () => {
    const businessId = await createBusiness("Sparse History Ltd");
    await onboard(businessId);

    const accepted = await uploadStatement(businessId, {
      source_type: "business_till",
      shortcode: "333333",
      content: fixture("till-sparse.csv"),
    });
    assert.ok(accepted.workflow_id);

    const workflowRes = await api("GET", `/v1/orbit/workflows/${accepted.workflow_id}`);
    assert.strictEqual(workflowRes.status, 200);
    assert.strictEqual(workflowRes.body.workflow.state, "FAILED_PARSING");
    assert.ok(workflowRes.body.dead_letter.length >= 1);

    const rows = await statementRows(businessId);
    assert.strictEqual(rows[0].status, "failed");
    assert.strictEqual(rows[0].error_code, "insufficient_history");
  });

  test("every imported transaction is written to the hash-chained ledger", async () => {
    const businessId = await createBusiness("Ledgered Business Ltd");
    await onboard(businessId);
    await uploadStatement(businessId, { source_type: "bank", content: fixture("bank-clean.csv") });
    const imported = (await statementRows(businessId))[0].imported_count as number;
    assert.ok(imported > 0);

    const ledger = await getLedger("business", businessId);
    const ingested = ledger.filter((entry) => entry.event_type === "business.transaction.ingested");
    assert.strictEqual(ingested.length, imported, "one ledger entry per ingested data point");

    const integrity = await verifyChainIntegrity("business", businessId);
    assert.strictEqual(integrity.valid, true);
    assert.strictEqual(integrity.anchored, true);
  });

  test("revoking business consent stops further statement reads", async () => {
    const businessId = await createBusiness("Revoke Business Ltd");
    const consentId = await onboard(businessId);
    await uploadStatement(businessId, { source_type: "bank", content: fixture("bank-clean.csv") });

    const revoked = await api("DELETE", `/v1/consents/${consentId}`);
    assert.strictEqual(revoked.status, 200);

    const blocked = await api("POST", `/v1/businesses/${businessId}/statements`, {
      body: { source_type: "bank", content: fixture("bank-clean.csv") },
    });
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual(blocked.body.error, "consent_required");
  });

  test("the individual/person flow is unaffected by business onboarding", async () => {
    const person = await api("POST", "/v1/persons", { body: { full_name: "Separate Person", national_id: "90909090" } });
    assert.strictEqual(person.status, 201);
    const verified = await api("POST", `/v1/persons/${person.body.id}/verify`);
    assert.strictEqual(verified.status, 200);
    assert.strictEqual(verified.body.person.status, "verified");
  });

  test("shortcodes are registered per business and listed", async () => {
    const businessId = await createBusiness("Shortcode Ltd");
    await onboard(businessId);
    await uploadStatement(businessId, {
      source_type: "business_till",
      shortcode: "444444",
      content: fixture("till-clean.csv"),
    });
    await uploadStatement(businessId, { source_type: "bank", content: fixture("bank-clean.csv") });

    const shortcodes = await api("GET", `/v1/businesses/${businessId}/shortcodes`);
    assert.strictEqual(shortcodes.status, 200);
    const types = shortcodes.body.map((s: any) => s.type).sort();
    assert.deepStrictEqual(types, ["bank", "till"]);
  });
});
