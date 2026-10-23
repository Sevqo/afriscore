import crypto from "node:crypto";
import { parseCsv } from "./csv";

/**
 * Statement ingestion, behind a `StatementSource` interface.
 *
 * The platform already normalises live/simulated feeds into one transaction
 * schema; uploaded statements are just another input. Each source knows how to
 * read its provider's columns and emits the same `ParsedStatementRow` shape,
 * so downstream analytics never branches on provider.
 *
 * No PDF dependency is introduced here: CSV/M-Pesa-text exports are parsed in
 * TypeScript. A PDF source can implement the same interface later without
 * touching the ingestion service.
 */
export type StatementSourceType = "individual_mpesa" | "business_till" | "business_paybill" | "bank";

export const STATEMENT_SOURCE_TYPES: readonly StatementSourceType[] = [
  "individual_mpesa",
  "business_till",
  "business_paybill",
  "bank",
] as const;

export type StatementErrorCode =
  | "unreadable_file"
  | "wrong_statement_type"
  | "insufficient_history"
  | "missing_shortcode"
  | "empty_statement"
  | "invalid_rows";

export class StatementParseError extends Error {
  readonly code: StatementErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: StatementErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "StatementParseError";
    this.code = code;
    this.details = details;
  }
}

export interface StatementMeta {
  /** M-Pesa till / paybill shortcode the statement belongs to. */
  shortcode?: string;
}

export interface ParsedStatementRow {
  external_id: string;
  amount: number;
  type: "credit" | "debit";
  status: "completed" | "failed" | "pending";
  counterparty: string | null;
  category: string;
  raw_status: string;
  occurred_at: string;
}

export interface ParsedStatement {
  sourceType: StatementSourceType;
  shortcode: string | null;
  rows: ParsedStatementRow[];
  periodStart: string;
  periodEnd: string;
  warnings: string[];
}

export interface StatementSource {
  readonly sourceType: StatementSourceType;
  parse(content: string, meta: StatementMeta): ParsedStatement;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_HISTORY_DAYS = 30;
const MAX_HEADER_SCAN_ROWS = 6;

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findTable(rows: string[][]): { headerIndex: number; headers: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, MAX_HEADER_SCAN_ROWS); i++) {
    const cells = rows[i];
    if (cells.length < 3) continue;
    const normalized = cells.map(normalizeHeader);
    const looksLikeHeader = normalized.some((h) => ["date", "receiptno", "completiontime", "transactiondate", "description", "narrative"].includes(h));
    if (looksLikeHeader) return { headerIndex: i, headers: normalized };
  }
  return null;
}

function column(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function cell(row: string[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  return (row[index] ?? "").trim();
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (!/\d/.test(cleaned)) return null;
  const negative = /^-/.test(cleaned) || /^\(.*\)$/.test(value.trim());
  const parsed = Number(cleaned.replace(/-/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/** Parses the date formats seen in M-Pesa and bank CSV exports. The value is
 *  interpreted as UTC so results do not depend on the server timezone. */
export function parseStatementDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);
  if (iso) {
    const date = new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] ?? 0), Number(iso[5] ?? 0), Number(iso[6] ?? 0))
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);
  if (dmy) {
    const date = new Date(
      Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] ?? 0), Number(dmy[5] ?? 0), Number(dmy[6] ?? 0))
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function normalizeStatus(raw: string): "completed" | "failed" | "pending" {
  const lower = raw.toLowerCase();
  if (lower.includes("complet") || lower.includes("success")) return "completed";
  if (lower.includes("fail") || lower.includes("revers") || lower.includes("bounce")) return "failed";
  return "pending";
}

const PHONE_PATTERN = /(?:254|0)7\d{8}/;

const COUNTERPARTY_PREFIX =
  /^(customer payment from|supplier payment to|funds received from|sent to|transfer from|supplier payment\s*-\s*|rent payment\s*-\s*|utility payment\s*-\s*|payment from|payment to)\s*/i;

function extractCounterparty(details: string, explicit: string): string | null {
  if (explicit.trim()) return explicit.trim();

  const stripped = details.replace(COUNTERPARTY_PREFIX, "").trim();
  if (!stripped) return null;

  const phone = PHONE_PATTERN.exec(stripped.replace(/\s+/g, ""));
  // Prefer a human/business name over the phone number: the same payer may be
  // written with different phone formats, which would fragment analytics.
  const withoutPhone = stripped.replace(new RegExp(PHONE_PATTERN.source, "g"), "").replace(/\s+/g, " ").trim();
  if (withoutPhone.length >= 2) return withoutPhone;
  return phone ? phone[0] : stripped;
}

function generatedExternalId(parts: Array<string | number>): string {
  return `gen-${crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)}`;
}

abstract class CsvStatementSource implements StatementSource {
  abstract readonly sourceType: StatementSourceType;
  /** Column groups that must all be present, else the file is the wrong type. */
  protected abstract requiredGroups: string[][];
  /** Groups where at least one alternative must be present (e.g. debit OR credit). */
  protected requiredAnyGroups: string[][] = [];
  protected abstract parseRows(headers: string[], rows: string[][], meta: StatementMeta, warnings: string[]): ParsedStatementRow[];

  parse(content: string, meta: StatementMeta): ParsedStatement {
    if (!content || !content.trim()) {
      throw new StatementParseError("unreadable_file", "The uploaded file is empty.");
    }

    const allRows = parseCsv(content);
    const table = findTable(allRows);
    if (!table) {
      throw new StatementParseError(
        "wrong_statement_type",
        "Could not find a statement header row. Upload a CSV export of the statement."
      );
    }

    const missing = this.requiredGroups.filter((group) => column(table.headers, group) < 0).map((group) => group[0]);
    for (const group of this.requiredAnyGroups) {
      if (column(table.headers, group) < 0) missing.push(group.join("|"));
    }
    if (missing.length > 0) {
      throw new StatementParseError("wrong_statement_type", "This file does not look like the selected statement type.", {
        missing_columns: missing,
        source_type: this.sourceType,
      });
    }

    if ((this.sourceType === "business_till" || this.sourceType === "business_paybill") && !meta.shortcode) {
      throw new StatementParseError("missing_shortcode", "A till or paybill shortcode is required for this statement type.");
    }

    const warnings: string[] = [];
    const dataRows = allRows.slice(table.headerIndex + 1);
    const rows = this.parseRows(table.headers, dataRows, meta, warnings);

    if (rows.length === 0) {
      throw new StatementParseError("invalid_rows", "No readable transactions were found in this statement.");
    }

    const times = rows.map((row) => new Date(row.occurred_at).getTime()).filter((time) => Number.isFinite(time));
    const periodStart = new Date(Math.min(...times)).toISOString();
    const periodEnd = new Date(Math.max(...times)).toISOString();
    const historyDays = Math.floor((Math.max(...times) - Math.min(...times)) / DAY_MS);

    if (historyDays < MIN_HISTORY_DAYS) {
      throw new StatementParseError(
        "insufficient_history",
        `The statement covers ${historyDays} day(s) of history; at least ${MIN_HISTORY_DAYS} days are required.`,
        { period_start: periodStart, period_end: periodEnd, days: historyDays }
      );
    }

    return {
      sourceType: this.sourceType,
      shortcode: meta.shortcode ?? null,
      rows,
      periodStart,
      periodEnd,
      warnings,
    };
  }
}

/** Personal M-Pesa statement (the individual-borrower source). */
export class IndividualMpesaSource extends CsvStatementSource {
  readonly sourceType = "individual_mpesa" as const;
  protected requiredGroups: string[][] = [["receiptno", "transactionid", "receipt"], ["completiontime", "transactiondate", "date"]];
  protected requiredAnyGroups: string[][] = [["paidin", "credit", "moneyin", "withdrawn", "debit", "moneyout"]];

  protected parseRows(headers: string[], rows: string[][], _meta: StatementMeta, warnings: string[]): ParsedStatementRow[] {
    const receipt = column(headers, ["receiptno", "transactionid", "receipt"]);
    const date = column(headers, ["completiontime", "transactiondate", "date"]);
    const details = column(headers, ["details", "description", "narrative"]);
    const status = column(headers, ["transactionstatus", "status"]);
    const paidIn = column(headers, ["paidin", "credit", "moneyin"]);
    const withdrawn = column(headers, ["withdrawn", "debit", "moneyout"]);

    const parsed: ParsedStatementRow[] = [];

    for (const row of rows) {
      const occurredAt = parseStatementDate(cell(row, date));
      const creditAmount = parseAmount(cell(row, paidIn));
      const debitAmount = parseAmount(cell(row, withdrawn));
      if (!occurredAt || (creditAmount === null && debitAmount === null)) {
        warnings.push("Skipped a row with an unreadable date or amount.");
        continue;
      }

      const isCredit = creditAmount !== null && Math.abs(creditAmount) > 0;
      const amount = Math.abs(isCredit ? (creditAmount as number) : (debitAmount as number));
      if (amount === 0) {
        warnings.push("Skipped a zero-amount row.");
        continue;
      }

      const rawStatus = cell(row, status) || "Completed";
      const detailsText = cell(row, details);

      parsed.push({
        external_id: cell(row, receipt) || generatedExternalId([this.sourceType, occurredAt, amount, detailsText]),
        amount,
        type: isCredit ? "credit" : "debit",
        status: normalizeStatus(rawStatus),
        counterparty: extractCounterparty(detailsText, ""),
        category: isCredit ? "sales" : "expenses",
        raw_status: rawStatus,
        occurred_at: occurredAt,
      });
    }

    return parsed;
  }
}

/** M-Pesa business till / paybill statements. Same column vocabulary as the
 *  personal export, but keyed to a shortcode and with merchant counterparties. */
export class BusinessMerchantSource extends CsvStatementSource {
  readonly sourceType: StatementSourceType;

  constructor(sourceType: "business_till" | "business_paybill") {
    super();
    this.sourceType = sourceType;
  }

  protected requiredGroups: string[][] = [["receiptno", "transactionid", "receipt"], ["completiontime", "transactiondate", "date"]];
  protected requiredAnyGroups: string[][] = [["paidin", "credit", "amount", "moneyin", "withdrawn", "debit", "moneyout"]];

  protected parseRows(headers: string[], rows: string[][], _meta: StatementMeta, warnings: string[]): ParsedStatementRow[] {
    const receipt = column(headers, ["receiptno", "transactionid", "receipt"]);
    const date = column(headers, ["completiontime", "transactiondate", "date"]);
    const details = column(headers, ["details", "description", "narrative"]);
    const status = column(headers, ["transactionstatus", "status"]);
    const paidIn = column(headers, ["paidin", "credit", "amount", "moneyin"]);
    const withdrawn = column(headers, ["withdrawn", "debit", "moneyout"]);
    const msisdn = column(headers, ["msisdn", "customername", "payer", "customer"]);
    const parsed: ParsedStatementRow[] = [];

    for (const row of rows) {
      const occurredAt = parseStatementDate(cell(row, date));
      const creditAmount = parseAmount(cell(row, paidIn));
      const debitAmount = parseAmount(cell(row, withdrawn));
      if (!occurredAt || (creditAmount === null && debitAmount === null)) {
        warnings.push("Skipped a row with an unreadable date or amount.");
        continue;
      }

      const isCredit = creditAmount !== null && Math.abs(creditAmount) > 0;
      const amount = Math.abs(isCredit ? (creditAmount as number) : (debitAmount as number));
      if (amount === 0) {
        warnings.push("Skipped a zero-amount row.");
        continue;
      }

      const rawStatus = cell(row, status) || "Completed";
      const detailsText = cell(row, details);
      const explicitCounterparty = cell(row, msisdn);

      parsed.push({
        external_id: cell(row, receipt) || generatedExternalId([this.sourceType, occurredAt, amount, detailsText]),
        amount,
        type: isCredit ? "credit" : "debit",
        status: normalizeStatus(rawStatus),
        counterparty: extractCounterparty(detailsText, explicitCounterparty),
        category: isCredit ? "sales" : "expenses",
        raw_status: rawStatus,
        occurred_at: occurredAt,
      });
    }

    return parsed;
  }
}

/** Bank statement CSV: separate debit/credit columns (the common Kenyan bank
 *  export) or a single signed amount column. */
export class BankStatementSource extends CsvStatementSource {
  readonly sourceType = "bank" as const;
  protected requiredGroups: string[][] = [["date", "valuedate", "transactiondate"], ["description", "narrative", "details"]];
  protected requiredAnyGroups: string[][] = [["debit", "withdrawal", "credit", "deposit", "amount"]];

  protected parseRows(headers: string[], rows: string[][], _meta: StatementMeta, warnings: string[]): ParsedStatementRow[] {
    const date = column(headers, ["date", "valuedate", "transactiondate"]);
    const narrative = column(headers, ["description", "narrative", "details"]);
    const debit = column(headers, ["debit", "withdrawal"]);
    const credit = column(headers, ["credit", "deposit"]);
    const amount = column(headers, ["amount"]);
    const parsed: ParsedStatementRow[] = [];

    for (const row of rows) {
      const occurredAt = parseStatementDate(cell(row, date));
      const debitAmount = parseAmount(cell(row, debit));
      const creditAmount = parseAmount(cell(row, credit));
      const signedAmount = parseAmount(cell(row, amount));

      if (!occurredAt) {
        warnings.push("Skipped a row with an unreadable date.");
        continue;
      }

      let type: "credit" | "debit";
      let value: number;
      if (creditAmount !== null && Math.abs(creditAmount) > 0) {
        type = "credit";
        value = Math.abs(creditAmount);
      } else if (debitAmount !== null && Math.abs(debitAmount) > 0) {
        type = "debit";
        value = Math.abs(debitAmount);
      } else if (signedAmount !== null && signedAmount !== 0) {
        type = signedAmount > 0 ? "credit" : "debit";
        value = Math.abs(signedAmount);
      } else {
        warnings.push("Skipped a row with no readable amount.");
        continue;
      }

      const narrativeText = cell(row, narrative);
      parsed.push({
        external_id: generatedExternalId([this.sourceType, occurredAt, value, narrativeText]),
        amount: value,
        type,
        status: "completed",
        counterparty: extractCounterparty(narrativeText, ""),
        category: type === "credit" ? "sales" : "expenses",
        raw_status: "COMPLETED",
        occurred_at: occurredAt,
      });
    }

    return parsed;
  }
}

/** Resolves the source implementation for an explicit upload type. */
export function createStatementSource(sourceType: StatementSourceType): StatementSource {
  switch (sourceType) {
    case "individual_mpesa":
      return new IndividualMpesaSource();
    case "business_till":
      return new BusinessMerchantSource("business_till");
    case "business_paybill":
      return new BusinessMerchantSource("business_paybill");
    case "bank":
      return new BankStatementSource();
    default: {
      const exhaustive: never = sourceType;
      throw new StatementParseError("wrong_statement_type", `Unsupported statement type: ${String(exhaustive)}`);
    }
  }
}

export function parseStatement(sourceType: StatementSourceType, content: string, meta: StatementMeta = {}): ParsedStatement {
  return createStatementSource(sourceType).parse(content, meta);
}

export function isStatementSourceType(value: string): value is StatementSourceType {
  return (STATEMENT_SOURCE_TYPES as readonly string[]).includes(value);
}

