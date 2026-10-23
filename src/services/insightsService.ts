import { dbAll } from "../db";
import { Invoice } from "./invoiceService";
import { Transaction } from "./transactionService";

/**
 * Business Intelligence layer (spec section 19). Built on real
 * structured data with clearly defined, auditable methodologies — no
 * AI model involved. This is the data layer an AI agent would
 * eventually query; the answers stay grounded in this code.
 */

export interface OverdueInvoice extends Invoice {
  days_overdue: number;
}

/** "Which invoices are overdue?" */
export async function getOverdueInvoices(businessId: string): Promise<OverdueInvoice[]> {
  const now = Date.now();
  const invoices = await dbAll<Invoice>(
    `SELECT * FROM invoices
     WHERE business_id = ? AND status IN ('unpaid', 'sent', 'partially_paid', 'overdue')
       AND due_date IS NOT NULL`,
    [businessId]
  );

  return invoices
    .filter((inv) => new Date(inv.due_date!).getTime() < now)
    .map((inv) => ({
      ...inv,
      days_overdue: Math.floor((now - new Date(inv.due_date!).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => b.days_overdue - a.days_overdue);
}

export interface CashFlowForecast {
  method: string;
  daily_net_cash_flow_avg: number;
  forecast_next_30d: number;
  based_on_days: number;
  confidence: "low" | "medium" | "high";
}

/** "Prepare a cash-flow forecast." Simple linear projection from recent
 *  history. Confidence is reported honestly rather than hidden behind a
 *  single number. */
export async function getCashFlowForecast(businessId: string): Promise<CashFlowForecast> {
  const txns = await dbAll<Transaction>(
    `SELECT * FROM transactions WHERE business_id = ? AND status = 'completed' ORDER BY occurred_at ASC`,
    [businessId]
  );

  const now = Date.now();
  // Future-dated transactions must not be projected as if they had happened.
  const settled = txns.filter((t) => new Date(t.occurred_at).getTime() <= now);

  if (settled.length === 0) {
    return {
      method: "insufficient_data",
      daily_net_cash_flow_avg: 0,
      forecast_next_30d: 0,
      based_on_days: 0,
      confidence: "low",
    };
  }

  // Project over the observed window (earliest event to now), not from the
  // first to the last event: a single day of history used to be divided by 1
  // and multiplied by 30, producing a confident-looking 30x number.
  const earliest = new Date(settled[0].occurred_at).getTime();
  const spanDays = Math.max(1, Math.ceil((now - earliest) / (1000 * 60 * 60 * 24)));

  const net = settled.reduce((sum, t) => sum + (t.type === "credit" ? t.amount : -t.amount), 0);
  const dailyAvg = net / spanDays;

  return {
    method: "linear_projection_from_history",
    daily_net_cash_flow_avg: Math.round(dailyAvg * 100) / 100,
    forecast_next_30d: Math.round(dailyAvg * 30 * 100) / 100,
    based_on_days: spanDays,
    confidence: spanDays >= 60 ? "high" : spanDays >= 14 ? "medium" : "low",
  };
}

export interface UnusualTransaction extends Transaction {
  deviation_from_mean: number;
}

/**
 * Masks a counterparty that is a raw phone number before it is returned to a
 * partner. Business names pass through unchanged. Raw MSISDNs are useful for
 * reconciliation internally but are PII on an API response.
 */
export function maskPiiCounterparty(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s-]/g, "");
  const digits = compact.replace(/^\+/, "");

  if (/^2547\d{8}$/.test(digits)) return `254***${digits.slice(-3)}`;
  if (/^07\d{8}$/.test(digits)) return `0***${digits.slice(-3)}`;
  if (/^\+2547\d{8}$/.test(compact)) return `254***${compact.slice(-3)}`;
  return value;
}

/** "Show me unusual transactions." Flags transactions more than 2 standard
 *  deviations from the business's own mean transaction size. Statistics are
 *  computed per direction: mixing KES 40,000 sales with KES 200 airtime
 *  purchases used to flag every large sale as an anomaly. */
export async function getUnusualTransactions(businessId: string): Promise<UnusualTransaction[]> {
  const txns = await dbAll<Transaction>(`SELECT * FROM transactions WHERE business_id = ? AND status = 'completed'`, [businessId]);

  if (txns.length < 5) return [];

  const flagged: UnusualTransaction[] = [];

  for (const type of ["credit", "debit"] as const) {
    const group = txns.filter((t) => t.type === type);
    if (group.length < 5) continue;

    const mean = group.reduce((sum, t) => sum + t.amount, 0) / group.length;
    const variance = group.reduce((sum, t) => sum + (t.amount - mean) ** 2, 0) / group.length;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) continue;

    for (const txn of group) {
      const z = (txn.amount - mean) / stddev;
      // Filter on the raw score, not a rounded one.
      if (Math.abs(z) > 2) flagged.push({ ...txn, deviation_from_mean: Math.round(z * 100) / 100 });
    }
  }

  return flagged.sort((a, b) => Math.abs(b.deviation_from_mean) - Math.abs(a.deviation_from_mean));
}

export interface CustomerConcentration {
  customer_reference: string;
  total_invoiced: number;
  invoice_count: number;
  share_of_total_pct: number;
}

/** "How dependent are we on our largest customer?" Uses money actually
 *  received for paid invoices (`paid_amount`, falling back to the invoiced
 *  amount for pre-upgrade rows) because invoiced != collected. */
export async function getCustomerConcentration(businessId: string): Promise<CustomerConcentration[]> {
  const invoices = await dbAll<Invoice>(`SELECT * FROM invoices WHERE business_id = ? AND status = 'paid'`, [businessId]);

  if (invoices.length === 0) return [];

  const realized = invoices
    .map((invoice) => ({ invoice, amount: invoice.paid_amount ?? invoice.amount }))
    .filter((entry) => entry.amount > 0);

  const totalRevenue = realized.reduce((sum, entry) => sum + entry.amount, 0);
  if (totalRevenue <= 0) return [];

  const byCustomer = new Map<string, { total: number; count: number }>();
  for (const { invoice, amount } of realized) {
    const entry = byCustomer.get(invoice.customer_reference) || { total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    byCustomer.set(invoice.customer_reference, entry);
  }

  return Array.from(byCustomer.entries())
    .map(([customer_reference, { total, count }]) => ({
      customer_reference,
      total_invoiced: Math.round(total * 100) / 100,
      invoice_count: count,
      share_of_total_pct: Math.round((total / totalRevenue) * 1000) / 10,
    }))
    .sort((a, b) => b.total_invoiced - a.total_invoiced);
}