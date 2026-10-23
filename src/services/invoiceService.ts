import { randomUUID } from "node:crypto";
import { dbGet, dbAll, dbRun } from "../db";
import { getBusiness } from "./businessService";
import { appendEvent } from "./ledgerService";

/**
 * Invoice domain: lifecycle state, and recorded receipts.
 *
 * Lifecycle: draft -> sent -> partially_paid -> paid, with `overdue` derived
 * from due_date while the invoice is still open. Legacy rows written before
 * the receivables module used `unpaid`, which is treated exactly like `sent`.
 *
 * `invoice_payments` is the source of truth for money received; the
 * `paid_amount` column mirrors sum(payments) so reads stay cheap.
 */

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "unpaid";

export const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = ["unpaid", "sent", "partially_paid", "overdue"];

export interface InvoiceAttachment {
  file_name: string;
  sha256: string;
  size_bytes: number;
}

export interface Invoice {
  id: string;
  business_id: string;
  invoice_number?: string | null;
  customer_reference: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date?: string | null;
  status: InvoiceStatus;
  matched_transaction_id?: string | null;
  expected_counterparty?: string | null;
  paid_amount?: number | null;
  attachment_file_name?: string | null;
  attachment_sha256?: string | null;
  attachment_size_bytes?: number | null;
  created_at: string;
  paid_at?: string | null;
}

export interface InvoicePayment {
  id: string;
  business_id: string;
  invoice_id: string;
  transaction_id: string | null;
  amount: number;
  method: string;
  reference: string | null;
  paid_at: string;
  created_at: string;
}

function isOpenStatus(status: string): boolean {
  return (OPEN_INVOICE_STATUSES as readonly string[]).includes(status);
}

export async function createInvoice(input: {
  business_id: string;
  customer_reference: string;
  amount: number;
  issue_date?: string;
  due_date?: string;
  expected_counterparty?: string;
  invoice_number?: string;
  status?: "draft" | "sent";
  attachment?: InvoiceAttachment;
}): Promise<Invoice> {
  const business = await getBusiness(input.business_id);
  if (!business) throw new Error("business_not_found");

  const now = new Date().toISOString();
  const issueDate = input.issue_date ?? now;
  if (input.due_date && new Date(input.due_date).getTime() < new Date(issueDate).getTime()) {
    throw new Error("invalid_due_date");
  }

  const invoice: Invoice = {
    id: randomUUID(),
    business_id: input.business_id,
    invoice_number: input.invoice_number ?? null,
    customer_reference: input.customer_reference,
    amount: input.amount,
    currency: "KES",
    issue_date: issueDate,
    due_date: input.due_date ?? null,
    status: input.status ?? "sent",
    expected_counterparty: input.expected_counterparty ?? null,
    paid_amount: 0,
    attachment_file_name: input.attachment?.file_name ?? null,
    attachment_sha256: input.attachment?.sha256 ?? null,
    attachment_size_bytes: input.attachment?.size_bytes ?? null,
    created_at: now,
  };

  await dbRun(
    `INSERT INTO invoices (id, business_id, invoice_number, customer_reference, amount, currency, issue_date, due_date, status, expected_counterparty, paid_amount, attachment_file_name, attachment_sha256, attachment_size_bytes, created_at)
     VALUES (@id, @business_id, @invoice_number, @customer_reference, @amount, @currency, @issue_date, @due_date, @status, @expected_counterparty, @paid_amount, @attachment_file_name, @attachment_sha256, @attachment_size_bytes, @created_at)`,
    invoice
  );

  await appendEvent("business", input.business_id, "invoice.created", {
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    amount: invoice.amount,
    customer_reference: invoice.customer_reference,
    status: invoice.status,
  });

  return invoice;
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  return dbGet<Invoice>(`SELECT * FROM invoices WHERE id = ?`, [id]);
}

export async function listInvoicesForBusiness(
  businessId: string,
  status?: string,
  limit = 100,
  offset = 0
): Promise<Invoice[]> {
  if (status) {
    return dbAll<Invoice>(
      `SELECT * FROM invoices WHERE business_id = ? AND status = ? ORDER BY issue_date DESC LIMIT ? OFFSET ?`,
      [businessId, status, limit, offset]
    );
  }
  return dbAll<Invoice>(`SELECT * FROM invoices WHERE business_id = ? ORDER BY issue_date DESC LIMIT ? OFFSET ?`, [
    businessId,
    limit,
    offset,
  ]);
}

export async function countInvoicesForBusiness(businessId: string, status?: string): Promise<number> {
  const row = status
    ? await dbGet<{ c: number | string }>(`SELECT COUNT(*) AS c FROM invoices WHERE business_id = ? AND status = ?`, [businessId, status])
    : await dbGet<{ c: number | string }>(`SELECT COUNT(*) AS c FROM invoices WHERE business_id = ?`, [businessId]);
  return Number(row?.c ?? 0);
}

export async function listOpenInvoicesForBusiness(businessId: string): Promise<Invoice[]> {
  const placeholders = OPEN_INVOICE_STATUSES.map(() => "?").join(", ");
  return dbAll<Invoice>(
    `SELECT * FROM invoices WHERE business_id = ? AND status IN (${placeholders}) ORDER BY issue_date ASC`,
    [businessId, ...OPEN_INVOICE_STATUSES]
  );
}

export async function listInvoicePayments(invoiceId: string): Promise<InvoicePayment[]> {
  return dbAll<InvoicePayment>(`SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_at ASC`, [invoiceId]);
}

export interface RecordPaymentRowInput {
  business_id: string;
  invoice_id: string;
  transaction_id?: string | null;
  amount: number;
  method: string;
  reference?: string | null;
  paid_at?: string;
}

/** Inserts one receipt row. A transaction can only be linked once. */
export async function createInvoicePaymentRow(input: RecordPaymentRowInput): Promise<InvoicePayment> {
  const existing = input.transaction_id
    ? await dbGet<InvoicePayment>(`SELECT * FROM invoice_payments WHERE invoice_id = ? AND transaction_id = ?`, [
        input.invoice_id,
        input.transaction_id,
      ])
    : undefined;
  if (existing) throw new Error("payment_already_recorded");

  const payment: InvoicePayment = {
    id: randomUUID(),
    business_id: input.business_id,
    invoice_id: input.invoice_id,
    transaction_id: input.transaction_id ?? null,
    amount: input.amount,
    method: input.method,
    reference: input.reference ?? null,
    paid_at: input.paid_at ?? new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  await dbRun(
    `INSERT INTO invoice_payments (id, business_id, invoice_id, transaction_id, amount, method, reference, paid_at, created_at)
     VALUES (@id, @business_id, @invoice_id, @transaction_id, @amount, @method, @reference, @paid_at, @created_at)`,
    payment
  );

  return payment;
}

/**
 * Recomputes status/paid_amount from recorded receipts and the due date.
 * Draft invoices are left alone until they are sent.
 */
export async function refreshInvoiceStatus(invoiceId: string): Promise<Invoice | undefined> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return undefined;
  if (invoice.status === "draft") return invoice;

  const payments = await listInvoicePayments(invoiceId);
  const paidFromRows = payments.reduce((sum, payment) => sum + payment.amount, 0);
  // Rows are authoritative once they exist; otherwise keep any legacy value.
  const paidAmount = payments.length > 0 ? Math.round(paidFromRows * 100) / 100 : (invoice.paid_amount ?? 0);
  const epsilon = 0.005;

  let status: InvoiceStatus;
  if (paidAmount >= invoice.amount - epsilon) status = "paid";
  else if (paidAmount > epsilon) status = "partially_paid";
  else if (invoice.due_date && new Date(invoice.due_date).getTime() < Date.now()) status = "overdue";
  else status = "sent";

  const paidAt = status === "paid" ? invoice.paid_at ?? new Date().toISOString() : null;
  const matchedTransactionId = invoice.matched_transaction_id ?? payments.find((payment) => payment.transaction_id)?.transaction_id ?? null;

  await dbRun(
    `UPDATE invoices SET status = ?, paid_amount = ?, paid_at = ?, matched_transaction_id = ? WHERE id = ?`,
    [status, paidAmount, paidAt, matchedTransactionId, invoiceId]
  );

  return (await getInvoice(invoiceId))!;
}

/** Marks an invoice as sent (drafts become reconcilable/collectable). */
export async function sendInvoice(invoiceId: string): Promise<Invoice> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error("invoice_not_found");
  if (invoice.status !== "draft") throw new Error("invoice_not_draft");

  await dbRun(`UPDATE invoices SET status = 'sent' WHERE id = ?`, [invoiceId]);
  await appendEvent("business", invoice.business_id, "invoice.sent", { invoice_id: invoiceId, invoice_number: invoice.invoice_number });
  return (await getInvoice(invoiceId))!;
}

/** Flips open invoices whose due date has passed to `overdue`. */
export async function markOverdueInvoices(businessId: string): Promise<number> {
  const now = new Date().toISOString();
  const result = await dbRun(
    `UPDATE invoices SET status = 'overdue'
     WHERE business_id = ? AND status IN ('unpaid', 'sent', 'partially_paid')
       AND due_date IS NOT NULL AND due_date < ?`,
    [businessId, now]
  );
  return result.changes;
}

/**
 * Settles an invoice (used by the reconciliation engine). The update is
 * conditional on the invoice not already being paid, so concurrent runs
 * cannot double-settle it.
 */
export async function markInvoicePaid(
  invoiceId: string,
  transactionId: string,
  paidAmount: number
): Promise<{ invoice: Invoice; changed: boolean }> {
  const now = new Date().toISOString();
  const res = await dbRun(
    `UPDATE invoices SET status = 'paid', matched_transaction_id = ?, paid_amount = ?, paid_at = ?
     WHERE id = ? AND status != 'paid'`,
    [transactionId, paidAmount, now, invoiceId]
  );

  const invoice = (await getInvoice(invoiceId))!;
  return { invoice, changed: res.changes > 0 };
}

/** Invoices may only be reconciled once they have been issued. */
export { isOpenStatus };
