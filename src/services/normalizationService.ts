import { RawMpesaTransaction, RawBankTransaction, SandboxTransaction } from "./connectorService";

export interface CanonicalTransaction {
  external_id: string;
  amount: number;
  currency: string;
  type: "credit" | "debit";
  counterparty: string | null;
  category: string | null;
  status: "completed" | "failed" | "pending";
  source_provider: string;
  raw_status: string;
  occurred_at: string;
}

/** M-Pesa's ResultDesc vocabulary -> canonical status/direction.
 *
 *  A FAILED ResultDesc carries no direction, so direction is inferred from
 *  TransactionType instead of defaulting everything non-DR to credit (which
 *  used to turn failed B2C payouts into incoming credits). Unknown statuses
 *  are preserved as `pending`, never silently treated as completed. */
export function normalizeMpesaTransaction(raw: RawMpesaTransaction): CanonicalTransaction {
  const type: "credit" | "debit" =
    raw.ResultDesc === "DR" ? "debit" : raw.ResultDesc === "CR" ? "credit" : raw.TransactionType === "B2CPayment" ? "debit" : "credit";

  const status: CanonicalTransaction["status"] =
    raw.ResultDesc === "FAILED" ? "failed" : raw.ResultDesc === "CR" || raw.ResultDesc === "DR" ? "completed" : "pending";

  return {
    external_id: raw.MpesaReceiptNumber,
    amount: Math.abs(raw.Amount),
    currency: "KES",
    type,
    counterparty: raw.MSISDN,
    category: type === "credit" ? "sales" : raw.TransactionType === "B2CPayment" ? "payout" : "expenses",
    status,
    source_provider: "mpesa",
    raw_status: raw.ResultDesc,
    occurred_at: raw.TransactionDate,
  };
}

/** Sandbox transactions are already close to canonical shape — this
 *  mostly just tags the source and fills in the fields real providers
 *  would carry (currency, category) with sandbox defaults. */
export function normalizeSandboxTransaction(raw: SandboxTransaction): CanonicalTransaction {
  return {
    external_id: raw.external_id,
    amount: Math.abs(raw.amount),
    currency: "KES",
    type: raw.type,
    counterparty: null,
    category: raw.type === "credit" ? "sales" : "expenses",
    status: raw.status,
    source_provider: "sandbox",
    raw_status: raw.status,
    occurred_at: raw.occurred_at,
  };
}
export function normalizeBankTransaction(raw: RawBankTransaction): CanonicalTransaction {
  const type: "credit" | "debit" = raw.debitCredit === "CREDIT" ? "credit" : "debit";
  // Unknown bank statuses become `pending`, not `completed` — an unrecognised
  // value must never be treated as settled money.
  const status: CanonicalTransaction["status"] =
    raw.status === "COMPLETED" ? "completed" : raw.status === "PENDING" ? "pending" : raw.status === "REVERSED" ? "failed" : "pending";

  return {
    external_id: raw.txnRef,
    amount: Math.abs(raw.txnAmount),
    currency: "KES",
    type,
    counterparty: null,
    // Category derives from direction, so it can never contradict `type`
    // (a debit labelled "supplier payment received" used to become "sales").
    category: type === "credit" ? "sales" : "expenses",
    status,
    source_provider: "bank",
    raw_status: raw.status,
    occurred_at: raw.valueDate,
  };
}