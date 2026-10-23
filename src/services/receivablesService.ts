import { dbAll, dbGet, dbRun, dbTransaction } from "../db";
import { getBusiness } from "./businessService";
import { appendEvent } from "./ledgerService";
import { emitEvent } from "./webhookService";
import {
  Invoice,
  InvoicePayment,
  createInvoicePaymentRow,
  getInvoice,
  listInvoicePayments,
  listOpenInvoicesForBusiness,
  markOverdueInvoices,
  refreshInvoiceStatus,
} from "./invoiceService";
import { Transaction } from "./transactionService";
import { counterpartyMatches, paymentMethodForProvider, reconcileBusiness } from "./reconciliationService";

/**
 * Receivables: recorded payments, automatic matching, DSO and the unmatched
 * payment review queue.
 *
 * DSO methodology (returned with every summary):
 *   AR = sum(amount - paid_amount) over issued, still-open invoices
 *   credit sales = sum(amount) over invoices issued in the trailing window
 *   DSO = AR / credit sales * window days
 * If there are no invoices at all the summary is `null` — DSO is never
 * fabricated from unrelated cash-flow data.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DSO_WINDOW_DAYS = 365;

export type ReceivablesErrorCode =
  | "invoice_not_found"
  | "transaction_not_found"
  | "transaction_already_matched"
  | "payment_already_recorded"
  | "amount_exceeds_balance"
  | "invoice_not_draft"
  | "invalid_payment";

export class ReceivablesError extends Error {
  readonly code: ReceivablesErrorCode;

  constructor(code: ReceivablesErrorCode, message: string) {
    super(message);
    this.name = "ReceivablesError";
    this.code = code;
  }
}

export interface ReceivablesSummary {
  open_invoice_count: number;
  open_invoice_value: number;
  overdue_invoice_count: number;
  /** Days sales outstanding over the trailing window; null when no credit sales. */
  dso_days: number | null;
  /** Average days from issue to payment for invoices paid in the window. */
  average_days_to_pay: number | null;
  /** Share of open invoices with at least one verified matched receipt. */
  matched_payment_ratio: number | null;
  window_days: number;
  method: string;
}

export interface RecordPaymentInput {
  amount: number;
  method: string;
  reference?: string;
  transaction_id?: string;
  paid_at?: string;
}

export interface RecordPaymentResult {
  invoice: Invoice;
  payment: InvoicePayment;
  fully_paid: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

const OPEN = new Set(["unpaid", "sent", "partially_paid", "overdue"]);

export function isOpenInvoice(invoice: Invoice): boolean {
  return OPEN.has(invoice.status);
}

export function openBalance(invoice: Invoice): number {
  return round2(invoice.amount - (invoice.paid_amount ?? 0));
}

/** Manual or transaction-linked payment against one invoice. */
export async function recordPayment(businessId: string, invoiceId: string, input: RecordPaymentInput): Promise<RecordPaymentResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ReceivablesError("invalid_payment", "Payment amount must be greater than zero.");
  }

  const business = await getBusiness(businessId);
  if (!business) throw new Error("business_not_found");

  const result = await dbTransaction(async () => {
    const invoice = await getInvoice(invoiceId);
    if (!invoice || invoice.business_id !== businessId) throw new ReceivablesError("invoice_not_found", "Invoice not found.");
    if (invoice.status === "draft") {
      throw new ReceivablesError("invoice_not_draft", "Send the invoice before recording a payment against it.");
    }
    if (invoice.status === "paid") {
      throw new ReceivablesError("amount_exceeds_balance", "This invoice is already fully paid.");
    }

    const balance = openBalance(invoice);
    if (input.amount > balance + 0.005) {
      throw new ReceivablesError(
        "amount_exceeds_balance",
        `Payment of ${input.amount} exceeds the outstanding balance of ${balance}.`
      );
    }

    // Seed a receipt row for legacy invoices that only carry paid_amount.
    const existingRows = await listInvoicePayments(invoiceId);
    if (existingRows.length === 0 && (invoice.paid_amount ?? 0) > 0) {
      await createInvoicePaymentRow({
        business_id: businessId,
        invoice_id: invoiceId,
        amount: invoice.paid_amount as number,
        method: "legacy",
        reference: "opening_balance",
        paid_at: invoice.paid_at ?? invoice.issue_date,
      });
    }

    let transactionId: string | null = null;
    if (input.transaction_id) {
      const txn = await dbGet<Transaction>(`SELECT * FROM transactions WHERE id = ? AND business_id = ?`, [
        input.transaction_id,
        businessId,
      ]);
      if (!txn) throw new ReceivablesError("transaction_not_found", "Linked transaction not found for this business.");
      if (txn.type !== "credit" || txn.status !== "completed") {
        throw new ReceivablesError("invalid_payment", "Only completed incoming transactions can settle an invoice.");
      }
      const claim = await dbRun(
        `UPDATE transactions SET matched_invoice_id = ? WHERE id = ? AND matched_invoice_id IS NULL`,
        [invoiceId, input.transaction_id]
      );
      if (claim.changes === 0) {
        throw new ReceivablesError("transaction_already_matched", "This transaction is already matched to another invoice.");
      }
      transactionId = input.transaction_id;
    }

    const payment = await createInvoicePaymentRow({
      business_id: businessId,
      invoice_id: invoiceId,
      transaction_id: transactionId,
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      paid_at: input.paid_at,
    });

    const updated = (await refreshInvoiceStatus(invoiceId))!;

    await appendEvent("business", businessId, "invoice.payment_recorded", {
      invoice_id: invoiceId,
      payment_id: payment.id,
      transaction_id: transactionId,
      amount: payment.amount,
      method: payment.method,
      status_after: updated.status,
      paid_amount: updated.paid_amount,
    });

    return { invoice: updated, payment, fully_paid: updated.status === "paid" };
  });

  const subject = { type: "business" as const, id: businessId, is_sandbox: business.is_sandbox };
  await emitEvent(
    "invoice.payment_recorded",
    { invoice_id: invoiceId, payment_id: result.payment.id, amount: result.payment.amount, fully_paid: result.fully_paid },
    subject
  );
  if (result.fully_paid) {
    await emitEvent(
      "invoice.paid",
      {
        invoice_id: invoiceId,
        business_id: businessId,
        transaction_ids: result.payment.transaction_id ? [result.payment.transaction_id] : [],
        paid_amount: result.invoice.paid_amount,
        match_type: "manual",
      },
      subject
    );
  }

  return result;
}

export interface AutoMatchResult {
  settled_invoices: number;
  partially_paid_invoices: number;
  unmatched_transactions: number;
  payments_recorded: number;
}

/**
 * Auto-matches incoming M-Pesa/bank credits to open invoices.
 *
 * First runs the full-settlement reconciliation engine (exact, tolerance and
 * installment matches). Whatever is still open is then probed for a partial
 * receipt: a transaction whose counterparty agrees with the invoice's expected
 * payer / customer name and covers part of the balance is applied as a
 * partial payment. Anything left over stays in the review queue.
 */
export async function autoMatchPayments(businessId: string): Promise<AutoMatchResult> {
  const business = await getBusiness(businessId);
  if (!business) throw new Error("business_not_found");

  await markOverdueInvoices(businessId);
  const fullSettlement = await reconcileBusiness(businessId);

  const partialEvents: Array<{ invoice_id: string; payment_id: string; amount: number }> = [];
  let paymentsRecorded = 0;
  let partiallyPaid = 0;

  await dbTransaction(async () => {
    const openInvoices = await listOpenInvoicesForBusiness(businessId);
    for (const invoice of openInvoices) {
      const outstanding = openBalance(invoice);
      if (outstanding <= 0.005) continue;

      const candidates = await dbAll<Transaction>(
        `SELECT * FROM transactions
         WHERE business_id = ? AND type = 'credit' AND status = 'completed' AND matched_invoice_id IS NULL
           AND amount < ?
         ORDER BY occurred_at ASC`,
        [businessId, outstanding]
      );

      const expected = (invoice.expected_counterparty ?? invoice.customer_reference ?? "").trim();
      const candidate = candidates.find((txn) => counterpartyMatches(expected, txn.counterparty));
      if (!candidate) continue;

      const claim = await dbRun(`UPDATE transactions SET matched_invoice_id = ? WHERE id = ? AND matched_invoice_id IS NULL`, [
        invoice.id,
        candidate.id,
      ]);
      if (claim.changes === 0) continue;

      const payment = await createInvoicePaymentRow({
        business_id: businessId,
        invoice_id: invoice.id,
        transaction_id: candidate.id,
        amount: candidate.amount,
        method: paymentMethodForProvider(candidate.source_provider),
        reference: candidate.external_id,
      });
      paymentsRecorded++;
      await refreshInvoiceStatus(invoice.id);
      await appendEvent("business", businessId, "invoice.payment_recorded", {
        invoice_id: invoice.id,
        payment_id: payment.id,
        transaction_id: candidate.id,
        amount: payment.amount,
        method: payment.method,
        partial: true,
      });
      partialEvents.push({ invoice_id: invoice.id, payment_id: payment.id, amount: payment.amount });
      partiallyPaid++;
    }
  });

  const subject = { type: "business" as const, id: businessId, is_sandbox: business.is_sandbox };
  for (const event of partialEvents) {
    await emitEvent("invoice.payment_recorded", { invoice_id: event.invoice_id, payment_id: event.payment_id, amount: event.amount, fully_paid: false }, subject);
  }

  const openAfter = await listOpenInvoicesForBusiness(businessId);
  void openAfter;
  const unmatched = await getReviewQueue(businessId);

  return {
    settled_invoices: fullSettlement.matched.length,
    partially_paid_invoices: partiallyPaid,
    unmatched_transactions: unmatched.count,
    payments_recorded: fullSettlement.matched.reduce((sum, match) => sum + match.transaction_ids.length, 0) + paymentsRecorded,
  };
}

/** Unmatched incoming payments awaiting a human decision. */
export async function getReviewQueue(businessId: string): Promise<{
  count: number;
  transactions: Array<{ id: string; amount: number; counterparty: string | null; occurred_at: string; source_provider: string; reason: string }>;
}> {
  const transactions = await dbAll<Transaction>(
    `SELECT * FROM transactions
     WHERE business_id = ? AND type = 'credit' AND status = 'completed' AND matched_invoice_id IS NULL
     ORDER BY occurred_at DESC`,
    [businessId]
  );

  return {
    count: transactions.length,
    transactions: transactions.map((txn) => ({
      id: txn.id,
      amount: txn.amount,
      counterparty: txn.counterparty,
      occurred_at: txn.occurred_at,
      source_provider: txn.source_provider,
      reason: "no_open_invoice_match",
    })),
  };
}

/**
 * DSO and receivables summary. Returns null when the business has no invoices
 * at all, so callers can render "no invoice data" instead of a fabricated
 * number.
 */
export async function getReceivablesSummary(
  businessId: string,
  options: { windowDays?: number; now?: Date } = {}
): Promise<ReceivablesSummary | null> {
  const totalRow = await dbGet<{ c: number | string }>(`SELECT COUNT(*) AS c FROM invoices WHERE business_id = ?`, [businessId]);
  if (Number(totalRow?.c ?? 0) === 0) return null;

  await markOverdueInvoices(businessId);

  const windowDays = Math.max(30, Math.floor(options.windowDays ?? DEFAULT_DSO_WINDOW_DAYS));
  const now = options.now ?? new Date();
  const fromMs = now.getTime() - windowDays * DAY_MS;

  const invoices = await dbAll<Invoice>(`SELECT * FROM invoices WHERE business_id = ?`, [businessId]);
  const issued = invoices.filter((invoice) => invoice.status !== "draft");
  const open = issued.filter(isOpenInvoice);
  const openValue = round2(open.reduce((sum, invoice) => sum + openBalance(invoice), 0));
  const overdueCount = open.filter((invoice) => invoice.status === "overdue").length;

  const payments = await dbAll<InvoicePayment>(`SELECT * FROM invoice_payments WHERE business_id = ?`, [businessId]);
  const invoiceIdsWithPayments = new Set(payments.map((payment) => payment.invoice_id));
  const matchedPaymentRatio =
    open.length > 0
      ? round2(open.filter((invoice) => invoiceIdsWithPayments.has(invoice.id)).length / open.length)
      : null;

  const issuedInWindow = issued.filter((invoice) => new Date(invoice.issue_date).getTime() >= fromMs);
  const creditSales = issuedInWindow.reduce((sum, invoice) => sum + invoice.amount, 0);
  const dsoDays = creditSales > 0 ? round1((openValue / creditSales) * windowDays) : null;

  const paidInWindow = issued.filter(
    (invoice) => invoice.status === "paid" && invoice.paid_at && new Date(invoice.paid_at).getTime() >= fromMs
  );
  const averageDaysToPay =
    paidInWindow.length > 0
      ? round1(
          paidInWindow.reduce(
            (sum, invoice) =>
              sum + (new Date(invoice.paid_at as string).getTime() - new Date(invoice.issue_date).getTime()) / DAY_MS,
            0
          ) / paidInWindow.length
        )
      : null;

  return {
    open_invoice_count: open.length,
    open_invoice_value: openValue,
    overdue_invoice_count: overdueCount,
    dso_days: dsoDays,
    average_days_to_pay: averageDaysToPay,
    matched_payment_ratio: matchedPaymentRatio,
    window_days: windowDays,
    method: "dso = open_receivables / invoiced_sales_in_window * window_days; average_days_to_pay over invoices paid in window",
  };
}
