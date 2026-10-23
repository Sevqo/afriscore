import { randomUUID, createHash } from "node:crypto";
import { dbGet, dbAll, dbRun, dbTransaction, isPostgres } from "../db";
import { getBusiness } from "./businessService";
import { grantConsent, hasActiveConsentScope } from "./consentService";
import { appendEvent } from "./ledgerService";
import { parseStatement, ParsedStatement, StatementParseError, StatementSourceType } from "./statement/parser";

/**
 * Business onboarding: owner consent -> statement upload -> normalized
 * transactions tagged with the business subject, its shortcode and the
 * statement they came from.
 *
 * The ingestion work is split into discrete steps so the Orbit orchestrator can
 * run them across queues:
 *   normalizeStatement()          parse + dedupe + write transactions (no ledger)
 *   ledgerStatementIngestion()    write the ingested rows to the hash chain
 *   ingestStatement()             the pre-Orbit synchronous composition
 *
 * Consent is checked before any file is parsed: no business data is read from
 * an uploaded file until an active grant exists for the business subject.
 */

/** Internal grantee representing the platform's own onboarding purpose. */
export const ONBOARDING_GRANTEE = "afriscore-platform";
export const ONBOARDING_SCOPES = ["statements", "business_profile"] as const;
export const ONBOARDING_PURPOSE = "business_onboarding";

export class OnboardingError extends Error {
  readonly code: OnboardingErrorCode;

  constructor(code: OnboardingErrorCode, message: string) {
    super(message);
    this.name = "OnboardingError";
    this.code = code;
  }
}

export type OnboardingErrorCode = "business_not_found" | "consent_required" | "invalid_shortcode" | "ingestion_failed";

export interface BusinessShortcode {
  id: string;
  business_id: string;
  type: string;
  shortcode: string;
  label?: string | null;
  created_at: string;
}

export interface StatementRecord {
  id: string;
  business_id: string;
  source_type: StatementSourceType;
  shortcode: string | null;
  file_name: string | null;
  content_sha256: string;
  period_start: string | null;
  period_end: string | null;
  status: "parsed" | "failed";
  error_code: string | null;
  error_message: string | null;
  row_count: number;
  imported_count: number;
  duplicate_count: number;
  uploaded_at: string;
}

export interface IngestStatementInput {
  sourceType: StatementSourceType;
  shortcode?: string;
  fileName?: string;
  content: string;
  label?: string;
}

export interface IngestStatementResult {
  statement: StatementRecord;
  transactionsImported: number;
  duplicatesSkipped: number;
  warnings: string[];
}

export interface NormalizeStatementResult {
  statement: StatementRecord;
  parsed: ParsedStatement;
  shortcode: string;
  imported: number;
  duplicates: number;
  warnings: string[];
}

export const PROVIDER_BY_SOURCE: Record<StatementSourceType, string> = {
  individual_mpesa: "mpesa",
  business_till: "mpesa_till",
  business_paybill: "mpesa_paybill",
  bank: "bank",
};

export const SHORTCODE_TYPE_BY_SOURCE: Record<StatementSourceType, string> = {
  individual_mpesa: "mpesa",
  business_till: "till",
  business_paybill: "paybill",
  bank: "bank",
};

/** Records the business owner's consent to platform processing. Must happen
 *  before the first statement upload; afterwards, uploads are refused. */
export async function recordOnboardingConsent(businessId: string, options: { purpose?: string; expiresAt?: string } = {}) {
  const business = await getBusiness(businessId);
  if (!business) throw new OnboardingError("business_not_found", "Business not found.");

  return grantConsent({
    subject_type: "business",
    subject_id: businessId,
    grantee: ONBOARDING_GRANTEE,
    purpose: options.purpose ?? ONBOARDING_PURPOSE,
    scope: [...ONBOARDING_SCOPES],
    expires_at: options.expiresAt,
  });
}

export async function listStatements(businessId: string): Promise<StatementRecord[]> {
  return dbAll<StatementRecord>(`SELECT * FROM statements WHERE business_id = ? ORDER BY uploaded_at DESC`, [businessId]);
}

export async function listShortcodes(businessId: string): Promise<BusinessShortcode[]> {
  return dbAll<BusinessShortcode>(`SELECT * FROM business_shortcodes WHERE business_id = ? ORDER BY created_at ASC`, [businessId]);
}

/** SQLite's INSERT OR IGNORE vs PostgreSQL's ON CONFLICT DO NOTHING. */
export function insertIgnoreTransactionsSql(): string {
  const columns = `(id, account_id, business_id, subject_type, external_id, amount, currency, type, counterparty, category, status, source_provider, raw_status, occurred_at, statement_id, shortcode, created_at)`;
  const values = `(@id, @account_id, @business_id, @subject_type, @external_id, @amount, @currency, @type, @counterparty, @category, @status, @source_provider, @raw_status, @occurred_at, @statement_id, @shortcode, @created_at)`;
  return isPostgres
    ? `INSERT INTO transactions ${columns} VALUES ${values} ON CONFLICT (account_id, external_id) DO NOTHING`
    : `INSERT OR IGNORE INTO transactions ${columns} VALUES ${values}`;
}

export async function ensureStatementShortcode(
  businessId: string,
  sourceType: StatementSourceType,
  shortcode: string,
  label?: string
): Promise<void> {
  await dbRun(
    `INSERT INTO business_shortcodes (id, business_id, type, shortcode, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id, type, shortcode) DO NOTHING`,
    [randomUUID(), businessId, SHORTCODE_TYPE_BY_SOURCE[sourceType], shortcode, label ?? null, new Date().toISOString()]
  );
}

export async function ensureStatementAccount(
  businessId: string,
  sourceType: StatementSourceType,
  shortcode: string
): Promise<{ id: string }> {
  const provider = PROVIDER_BY_SOURCE[sourceType];
  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM accounts WHERE business_id = ? AND provider = ? AND account_identifier = ?`,
    [businessId, provider, shortcode]
  );
  if (existing) return existing;

  const id = randomUUID();
  await dbRun(
    `INSERT INTO accounts (id, business_id, provider, account_identifier, status, connected_at)
     VALUES (?, ?, ?, ?, 'connected', ?)`,
    [id, businessId, provider, shortcode, new Date().toISOString()]
  );
  return { id };
}

export async function recordStatementRow(
  businessId: string,
  input: IngestStatementInput,
  parsed: ParsedStatement | null,
  error: StatementParseError | null
): Promise<StatementRecord> {
  const record: StatementRecord = {
    id: randomUUID(),
    business_id: businessId,
    source_type: input.sourceType,
    shortcode: input.shortcode ?? null,
    file_name: input.fileName ?? null,
    content_sha256: createHash("sha256").update(input.content).digest("hex"),
    period_start: parsed?.periodStart ?? null,
    period_end: parsed?.periodEnd ?? null,
    status: parsed ? "parsed" : "failed",
    error_code: error?.code ?? null,
    error_message: error?.message ?? null,
    row_count: parsed?.rows.length ?? 0,
    imported_count: 0,
    duplicate_count: 0,
    uploaded_at: new Date().toISOString(),
  };

  await dbRun(
    `INSERT INTO statements (id, business_id, source_type, shortcode, file_name, content_sha256, period_start, period_end, status, error_code, error_message, row_count, imported_count, duplicate_count, uploaded_at)
     VALUES (@id, @business_id, @source_type, @shortcode, @file_name, @content_sha256, @period_start, @period_end, @status, @error_code, @error_message, @row_count, @imported_count, @duplicate_count, @uploaded_at)`,
    record
  );

  return record;
}

/**
 * Parse the statement, dedupe by provider receipt id and write the rows.
 * Deliberately does NOT write to the ledger — the Orbit ledger worker owns
 * that step so ordering and idempotency are explicit.
 */
export async function normalizeStatement(businessId: string, input: IngestStatementInput): Promise<NormalizeStatementResult> {
  const business = await getBusiness(businessId);
  if (!business) throw new OnboardingError("business_not_found", "Business not found.");

  const consented = await hasActiveConsentScope("business", businessId, ONBOARDING_GRANTEE, "statements");
  if (!consented) {
    throw new OnboardingError("consent_required", "Business consent must be recorded before a statement can be read.");
  }

  if ((input.sourceType === "business_till" || input.sourceType === "business_paybill") && !input.shortcode?.trim()) {
    const error = new StatementParseError("missing_shortcode", "A till or paybill shortcode is required for this statement type.");
    await recordStatementRow(businessId, input, null, error);
    throw error;
  }

  let parsed: ParsedStatement;
  try {
    parsed = parseStatement(input.sourceType, input.content, { shortcode: input.shortcode });
  } catch (err) {
    if (err instanceof StatementParseError) {
      await recordStatementRow(businessId, input, null, err);
    }
    throw err;
  }

  const shortcode = parsed.shortcode ?? `stmt-${businessId}`;
  await ensureStatementShortcode(businessId, input.sourceType, shortcode, input.label);
  const account = await ensureStatementAccount(businessId, input.sourceType, shortcode);
  const statement = await recordStatementRow(businessId, input, parsed, null);

  let imported = 0;
  let duplicates = 0;
  const sql = insertIgnoreTransactionsSql();

  try {
    await dbTransaction(async () => {
      for (const row of parsed.rows) {
        const result = await dbRun(sql, {
          id: randomUUID(),
          account_id: account.id,
          business_id: businessId,
          subject_type: "business",
          external_id: row.external_id,
          amount: row.amount,
          currency: "KES",
          type: row.type,
          counterparty: row.counterparty,
          category: row.category,
          status: row.status,
          source_provider: PROVIDER_BY_SOURCE[input.sourceType],
          raw_status: row.raw_status,
          occurred_at: row.occurred_at,
          statement_id: statement.id,
          shortcode,
          created_at: new Date().toISOString(),
        });

        if (result.changes === 0) {
          duplicates++;
          continue;
        }
        imported++;
      }

      await dbRun(`UPDATE statements SET imported_count = ?, duplicate_count = ? WHERE id = ?`, [imported, duplicates, statement.id]);
    });
  } catch (err) {
    await dbRun(`UPDATE statements SET status = 'failed', error_code = ?, error_message = ? WHERE id = ?`, [
      "ingestion_failed",
      err instanceof Error ? err.message : "Ingestion failed.",
      statement.id,
    ]);
    throw new OnboardingError("ingestion_failed", "The statement could not be stored; no partial data was committed.");
  }

  return { statement: { ...statement, imported_count: imported, duplicate_count: duplicates }, parsed, shortcode, imported, duplicates, warnings: parsed.warnings };
}

/**
 * Ledger idempotency: has this exact event already been written?
 * The event payload carries a stable id (transaction id / statement id), so a
 * retried ledger job is a no-op instead of a duplicate chain entry.
 */
async function ledgerHasEvent(subjectType: "business" | "person", subjectId: string, eventType: string, needle: string): Promise<boolean> {
  const row = await dbGet<{ found: number }>(
    `SELECT 1 AS found FROM ledger WHERE subject_type = ? AND subject_id = ? AND event_type = ? AND event_data LIKE ? LIMIT 1`,
    [subjectType, subjectId, eventType, `%${needle}%`]
  );
  return !!row;
}

/** Writes the ingested statement + its transactions to the hash chain, once. */
export async function ledgerStatementIngestion(businessId: string, statementId: string): Promise<{ ledgered: number; skipped: number }> {
  const statement = await dbGet<StatementRecord>(`SELECT * FROM statements WHERE id = ?`, [statementId]);
  if (!statement) throw new Error(`statement_not_found: ${statementId}`);

  const rows = await dbAll<{ id: string; amount: number; type: string; status: string; occurred_at: string }>(
    `SELECT id, amount, type, status, occurred_at FROM transactions WHERE statement_id = ?`,
    [statementId]
  );

  let ledgered = 0;
  let skipped = 0;
  for (const txn of rows) {
    const already = await ledgerHasEvent("business", businessId, "business.transaction.ingested", `"transaction_id":"${txn.id}"`);
    if (already) {
      skipped++;
      continue;
    }
    await appendEvent("business", businessId, "business.transaction.ingested", {
      transaction_id: txn.id,
      statement_id: statementId,
      source_type: statement.source_type,
      shortcode: statement.shortcode,
      amount: txn.amount,
      direction: txn.type,
      status: txn.status,
      occurred_at: txn.occurred_at,
    });
    ledgered++;
  }

  const summaryAlready = await ledgerHasEvent("business", businessId, "statement.ingested", `"statement_id":"${statementId}"`);
  if (!summaryAlready) {
    await appendEvent("business", businessId, "statement.ingested", {
      statement_id: statementId,
      source_type: statement.source_type,
      shortcode: statement.shortcode,
      period_start: statement.period_start,
      period_end: statement.period_end,
      rows: statement.row_count,
      imported: statement.imported_count,
      duplicates: statement.duplicate_count,
    });
  }

  return { ledgered, skipped };
}

/**
 * Pre-Orbit synchronous composition (normalize + ledger). Kept for callers that
 * need a one-shot ingest; the API upload path now uses the Orbit workflow.
 */
export async function ingestStatement(businessId: string, input: IngestStatementInput): Promise<IngestStatementResult> {
  const normalized = await normalizeStatement(businessId, input);
  await ledgerStatementIngestion(businessId, normalized.statement.id);

  return {
    statement: normalized.statement,
    transactionsImported: normalized.imported,
    duplicatesSkipped: normalized.duplicates,
    warnings: normalized.warnings,
  };
}
