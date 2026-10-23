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
 * Consent is checked BEFORE the statement is parsed: no business data is
 * read from an uploaded file until an active grant exists for the business
 * subject. Every imported transaction is written to the trust ledger inside
 * the same DB transaction as the rows themselves, so the ledger can never
 * claim a data point that was not stored (or vice versa).
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

const PROVIDER_BY_SOURCE: Record<StatementSourceType, string> = {
  individual_mpesa: "mpesa",
  business_till: "mpesa_till",
  business_paybill: "mpesa_paybill",
  bank: "bank",
};

const SHORTCODE_TYPE_BY_SOURCE: Record<StatementSourceType, string> = {
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
function insertIgnoreTransactionsSql(): string {
  const columns = `(id, account_id, business_id, subject_type, external_id, amount, currency, type, counterparty, category, status, source_provider, raw_status, occurred_at, statement_id, shortcode, created_at)`;
  const values = `(@id, @account_id, @business_id, @subject_type, @external_id, @amount, @currency, @type, @counterparty, @category, @status, @source_provider, @raw_status, @occurred_at, @statement_id, @shortcode, @created_at)`;
  return isPostgres
    ? `INSERT INTO transactions ${columns} VALUES ${values} ON CONFLICT (account_id, external_id) DO NOTHING`
    : `INSERT OR IGNORE INTO transactions ${columns} VALUES ${values}`;
}

async function ensureShortcode(businessId: string, sourceType: StatementSourceType, shortcode: string, label?: string): Promise<void> {
  await dbRun(
    `INSERT INTO business_shortcodes (id, business_id, type, shortcode, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id, type, shortcode) DO NOTHING`,
    [randomUUID(), businessId, SHORTCODE_TYPE_BY_SOURCE[sourceType], shortcode, label ?? null, new Date().toISOString()]
  );
}

async function ensureAccount(businessId: string, sourceType: StatementSourceType, shortcode: string): Promise<{ id: string }> {
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

async function recordStatement(
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
 * Parses a statement and stores the normalized rows for a business.
 *
 * Failure modes are explicit `StatementParseError`s (unreadable file, wrong
 * statement type, < 30 days of history, missing shortcode) — the failed
 * upload is still recorded for audit, and the caller gets a 400 with a
 * machine-readable code rather than a stack trace.
 */
export async function ingestStatement(businessId: string, input: IngestStatementInput): Promise<IngestStatementResult> {
  const business = await getBusiness(businessId);
  if (!business) throw new OnboardingError("business_not_found", "Business not found.");

  const consented = await hasActiveConsentScope("business", businessId, ONBOARDING_GRANTEE, "statements");
  if (!consented) {
    throw new OnboardingError("consent_required", "Business consent must be recorded before a statement can be read.");
  }

  if ((input.sourceType === "business_till" || input.sourceType === "business_paybill") && !input.shortcode?.trim()) {
    const error = new StatementParseError("missing_shortcode", "A till or paybill shortcode is required for this statement type.");
    await recordStatement(businessId, input, null, error);
    throw error;
  }

  let parsed: ParsedStatement;
  try {
    parsed = parseStatement(input.sourceType, input.content, { shortcode: input.shortcode });
  } catch (err) {
    if (err instanceof StatementParseError) {
      await recordStatement(businessId, input, null, err);
    }
    throw err;
  }

  const shortcode = parsed.shortcode ?? `stmt-${businessId}`;
  await ensureShortcode(businessId, input.sourceType, shortcode, input.label);
  const account = await ensureAccount(businessId, input.sourceType, shortcode);
  const statement = await recordStatement(businessId, input, parsed, null);

  let imported = 0;
  let duplicates = 0;
  const sql = insertIgnoreTransactionsSql();

  try {
    await dbTransaction(async () => {
      for (const row of parsed.rows) {
        const id = randomUUID();
        const result = await dbRun(sql, {
          id,
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
        await appendEvent("business", businessId, "business.transaction.ingested", {
          transaction_id: id,
          statement_id: statement.id,
          source_type: input.sourceType,
          shortcode,
          amount: row.amount,
          direction: row.type,
          status: row.status,
          occurred_at: row.occurred_at,
        });
      }

      await dbRun(`UPDATE statements SET imported_count = ?, duplicate_count = ? WHERE id = ?`, [imported, duplicates, statement.id]);
      await appendEvent("business", businessId, "statement.ingested", {
        statement_id: statement.id,
        source_type: input.sourceType,
        shortcode,
        period_start: parsed.periodStart,
        period_end: parsed.periodEnd,
        rows: parsed.rows.length,
        imported,
        duplicates,
        warnings: parsed.warnings.length,
      });
    });
  } catch (err) {
    await dbRun(`UPDATE statements SET status = 'failed', error_code = ?, error_message = ? WHERE id = ?`, [
      "ingestion_failed",
      err instanceof Error ? err.message : "Ingestion failed.",
      statement.id,
    ]);
    throw new OnboardingError("ingestion_failed", "The statement could not be stored; no partial data was committed.");
  }

  return {
    statement: { ...statement, imported_count: imported, duplicate_count: duplicates },
    transactionsImported: imported,
    duplicatesSkipped: duplicates,
    warnings: parsed.warnings,
  };
}
