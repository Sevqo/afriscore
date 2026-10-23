import { dbAll } from "../db";
import { getBusiness, Business } from "./businessService";
import { Transaction } from "./transactionService";

/**
 * Business dashboard analytics.
 *
 * Everything here is deterministic arithmetic over the normalized
 * transactions the onboarding flow stored — no ML, no hidden weights. The
 * pure functions are exported separately from the DB loader so the scoring
 * bands can be unit-tested at their boundaries without a database.
 *
 * Methodology (also echoed in each response's `method` fields):
 *  - "inflow"/"outflow" are completed credit/debit rows only; pending and
 *    failed rows never move money.
 *  - monthly buckets are UTC calendar months.
 *  - inflow volatility is the coefficient of variation (stdev / mean) of
 *    monthly inflow across months that have any activity.
 *  - revenue trend compares the mean monthly inflow of the newer half of the
 *    observed data months with the older half.
 *  - customer concentration is each counterparty's share of total inflow.
 */

const DEFAULT_WINDOW_MONTHS = 12;
const MAX_WINDOW_MONTHS = 24;

export interface MetricsOptions {
  months?: number;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

export interface MonthlyCashFlow {
  month: string; // YYYY-MM
  inflow: number;
  outflow: number;
  net: number;
  transaction_count: number;
}

export interface RevenueTrend {
  available: boolean;
  direction: "growing" | "flat" | "declining" | "insufficient_data";
  change_pct: number | null;
  method: string;
  detail: string;
}

export interface PeakActivity {
  busiest_weekday: string | null;
  busiest_hour: number | null;
  average_ticket: number;
}

export interface CustomerConcentrationEntry {
  counterparty: string;
  inflow: number;
  transaction_count: number;
  share_of_inflow_pct: number;
}

export interface SupplierIntelligence {
  repeat_supplier_count: number;
  top_suppliers: Array<{ counterparty: string; outflow: number; payment_count: number }>;
  /** 0-1: how regularly repeat suppliers are paid across active months. */
  regularity_score: number;
}

export interface CounterpartyIntelligence {
  top_customers: CustomerConcentrationEntry[];
  anchor_buyer_risk: boolean;
  repeat_customer_ratio: number;
  supplier: SupplierIntelligence;
}

export interface BusinessMetrics {
  window: {
    months: number;
    from: string;
    to: string;
    data_months: string[];
  };
  cash_flow: {
    monthly: MonthlyCashFlow[];
    inflow_volatility: number | null;
    volatility_method: string;
    revenue_trend: RevenueTrend;
    peak_activity: PeakActivity;
  };
  counterparties: CounterpartyIntelligence;
  totals: {
    inflow: number;
    outflow: number;
    net: number;
    credit_count: number;
    debit_count: number;
    failed_count: number;
    failed_ratio: number;
    months_of_history: number;
  };
}

export interface HealthComponent {
  key: "cash_flow_stability" | "revenue_trend" | "payment_discipline" | "customer_concentration" | "liquidity_buffer";
  label: string;
  /** 0-100 component score, or null when the data needed is not captured. */
  score: number | null;
  weight: number;
  available: boolean;
  detail: string;
  reason?: string;
}

export type HealthBand = "strong" | "stable" | "watch" | "at_risk";

export interface BusinessHealthScore {
  score: number;
  band: HealthBand;
  band_label: string;
  components: HealthComponent[];
  excluded_components: string[];
  method: string;
}

export interface BusinessDashboard {
  business: {
    id: string;
    legal_name: string;
    sector: string | null;
    status: string;
    trust_score: number;
    is_sandbox: boolean;
  };
  generated_at: string;
  window: BusinessMetrics["window"];
  cash_flow: BusinessMetrics["cash_flow"];
  counterparties: BusinessMetrics["counterparties"];
  totals: BusinessMetrics["totals"];
  health_score: BusinessHealthScore;
  tips: string[];
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBack(from: Date, count: number): string[] {
  const months: string[] = [];
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    months.push(monthKey(date.getTime()));
  }
  return months;
}

function counterpartyKey(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Unattributed";
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeBusinessMetrics(transactions: Transaction[], options: MetricsOptions = {}): BusinessMetrics {
  const now = options.now ?? new Date();
  const windowMonths = clamp(Math.floor(options.months ?? DEFAULT_WINDOW_MONTHS), 1, MAX_WINDOW_MONTHS);
  const months = monthsBack(now, windowMonths);
  const firstMonth = months[0];
  const nowMs = now.getTime();

  // Completed, non-future rows inside the window, in chronological order.
  const settled = transactions
    .filter((txn) => txn.status === "completed")
    .filter((txn) => {
      const time = new Date(txn.occurred_at).getTime();
      return Number.isFinite(time) && time <= nowMs && monthKey(time) >= firstMonth;
    })
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  const monthlyMap = new Map<string, MonthlyCashFlow>();
  for (const month of months) {
    monthlyMap.set(month, { month, inflow: 0, outflow: 0, net: 0, transaction_count: 0 });
  }
  for (const txn of settled) {
    const bucket = monthlyMap.get(monthKey(new Date(txn.occurred_at).getTime()));
    if (!bucket) continue;
    if (txn.type === "credit") bucket.inflow += txn.amount;
    else bucket.outflow += txn.amount;
    bucket.transaction_count += 1;
    bucket.net = bucket.inflow - bucket.outflow;
  }
  const monthly = months.map((month) => {
    const bucket = monthlyMap.get(month)!;
    return { ...bucket, inflow: round2(bucket.inflow), outflow: round2(bucket.outflow), net: round2(bucket.net) };
  });

  const dataMonths = monthly.filter((bucket) => bucket.transaction_count > 0).map((bucket) => bucket.month);
  const activeMonthly = monthly.filter((bucket) => bucket.transaction_count > 0);
  const inflows = activeMonthly.map((bucket) => bucket.inflow);
  const meanInflow = inflows.length > 0 ? inflows.reduce((sum, value) => sum + value, 0) / inflows.length : 0;
  const stdevInflow = standardDeviation(inflows, meanInflow);
  const inflowVolatility = meanInflow > 0 && inflows.length >= 2 ? round2(stdevInflow / meanInflow) : null;

  const revenueTrend = computeRevenueTrend(activeMonthly);
  const peakActivity = computePeakActivity(settled);

  const credits = settled.filter((txn) => txn.type === "credit");
  const debits = settled.filter((txn) => txn.type === "debit");
  const totalInflow = credits.reduce((sum, txn) => sum + txn.amount, 0);
  const totalOutflow = debits.reduce((sum, txn) => sum + txn.amount, 0);

  const creditByCounterparty = new Map<string, { amount: number; count: number }>();
  for (const txn of credits) {
    const key = counterpartyKey(txn.counterparty);
    const entry = creditByCounterparty.get(key) ?? { amount: 0, count: 0 };
    entry.amount += txn.amount;
    entry.count += 1;
    creditByCounterparty.set(key, entry);
  }

  const topCustomers: CustomerConcentrationEntry[] = Array.from(creditByCounterparty.entries())
    .map(([counterparty, entry]) => ({
      counterparty,
      inflow: round2(entry.amount),
      transaction_count: entry.count,
      share_of_inflow_pct: totalInflow > 0 ? round1((entry.amount / totalInflow) * 100) : 0,
    }))
    .sort((a, b) => b.inflow - a.inflow)
    .slice(0, 5);

  const repeatInflow = Array.from(creditByCounterparty.values())
    .filter((entry) => entry.count > 1)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const repeatCustomerRatio = totalInflow > 0 ? round2(repeatInflow / totalInflow) : 0;

  const debitByCounterparty = new Map<string, { amount: number; count: number; months: Set<string> }>();
  for (const txn of debits) {
    const key = counterpartyKey(txn.counterparty);
    const entry = debitByCounterparty.get(key) ?? { amount: 0, count: 0, months: new Set<string>() };
    entry.amount += txn.amount;
    entry.count += 1;
    entry.months.add(monthKey(new Date(txn.occurred_at).getTime()));
    debitByCounterparty.set(key, entry);
  }

  const repeatSuppliers = Array.from(debitByCounterparty.entries()).filter(([, entry]) => entry.count >= 3);
  const activeMonthCount = Math.max(1, dataMonths.length);
  const regularityScore =
    repeatSuppliers.length === 0
      ? 0
      : round2(repeatSuppliers.reduce((sum, [, entry]) => sum + Math.min(1, entry.months.size / activeMonthCount), 0) / repeatSuppliers.length);

  const topSuppliers = Array.from(debitByCounterparty.entries())
    .map(([counterparty, entry]) => ({ counterparty, outflow: round2(entry.amount), payment_count: entry.count }))
    .sort((a, b) => b.outflow - a.outflow)
    .slice(0, 5);

  const failed = transactions.filter((txn) => txn.status === "failed").length;
  const settledCount = settled.length;

  return {
    window: {
      months: windowMonths,
      from: `${months[0]}-01T00:00:00.000Z`,
      to: now.toISOString(),
      data_months: dataMonths,
    },
    cash_flow: {
      monthly,
      inflow_volatility: inflowVolatility,
      volatility_method: "coefficient_of_variation_of_monthly_inflow",
      revenue_trend: revenueTrend,
      peak_activity: peakActivity,
    },
    counterparties: {
      top_customers: topCustomers,
      anchor_buyer_risk: (topCustomers[0]?.share_of_inflow_pct ?? 0) > 40,
      repeat_customer_ratio: repeatCustomerRatio,
      supplier: {
        repeat_supplier_count: repeatSuppliers.length,
        top_suppliers: topSuppliers,
        regularity_score: regularityScore,
      },
    },
    totals: {
      inflow: round2(totalInflow),
      outflow: round2(totalOutflow),
      net: round2(totalInflow - totalOutflow),
      credit_count: credits.length,
      debit_count: debits.length,
      failed_count: failed,
      failed_ratio: settledCount > 0 ? round2(failed / (settledCount + failed)) : 0,
      months_of_history: dataMonths.length,
    },
  };
}

function computeRevenueTrend(activeMonthly: MonthlyCashFlow[]): RevenueTrend {
  const method = "newer_half_vs_older_half_mean_monthly_inflow";
  if (activeMonthly.length < 3) {
    return {
      available: false,
      direction: "insufficient_data",
      change_pct: null,
      method,
      detail: `Only ${activeMonthly.length} month(s) of activity; at least 3 are needed to judge a trend.`,
    };
  }

  const split = Math.floor(activeMonthly.length / 2);
  const older = activeMonthly.slice(0, split);
  const newer = activeMonthly.slice(split);
  const mean = (series: MonthlyCashFlow[]) => series.reduce((sum, bucket) => sum + bucket.inflow, 0) / series.length;
  const olderMean = mean(older);
  const newerMean = mean(newer);

  if (olderMean <= 0) {
    return {
      available: false,
      direction: "insufficient_data",
      change_pct: null,
      method,
      detail: "No inflow in the earlier part of the window to compare against.",
    };
  }

  const changePct = round1(((newerMean - olderMean) / olderMean) * 100);
  const direction = changePct > 5 ? "growing" : changePct < -5 ? "declining" : "flat";
  return {
    available: true,
    direction,
    change_pct: changePct,
    method,
    detail: `Average monthly inflow moved from ${round2(olderMean)} to ${round2(newerMean)} KES (${changePct}%).`,
  };
}

function computePeakActivity(settled: Transaction[]): PeakActivity {
  const credits = settled.filter((txn) => txn.type === "credit");
  const weekdayCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();

  for (const txn of credits) {
    const date = new Date(txn.occurred_at);
    const weekday = WEEKDAYS[date.getUTCDay()];
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
    hourCounts.set(date.getUTCHours(), (hourCounts.get(date.getUTCHours()) ?? 0) + 1);
  }

  const busiestWeekday = Array.from(weekdayCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const busiestHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const totalInflow = credits.reduce((sum, txn) => sum + txn.amount, 0);

  return {
    busiest_weekday: busiestWeekday,
    busiest_hour: busiestHour,
    average_ticket: credits.length > 0 ? round2(totalInflow / credits.length) : 0,
  };
}

const HEALTH_WEIGHTS: Record<HealthComponent["key"], number> = {
  cash_flow_stability: 0.3,
  revenue_trend: 0.2,
  payment_discipline: 0.2,
  customer_concentration: 0.15,
  liquidity_buffer: 0.15,
};

/**
 * Deterministic 0-100 score. Each component is scored 0-100, then weighted.
 * Unavailable components (currently only liquidity, because statements do not
 * capture running balances) are excluded and the remaining weights are
 * renormalised — so the score is always on a true 0-100 scale while making
 * the missing input explicit.
 */
export function computeBusinessHealth(metrics: BusinessMetrics): BusinessHealthScore {
  const components: HealthComponent[] = [];

  // Cash-flow stability: low volatility and mostly positive-net months.
  const volatility = metrics.cash_flow.inflow_volatility;
  const activeMonths = metrics.cash_flow.monthly.filter((bucket) => bucket.transaction_count > 0);
  const positiveRatio = activeMonths.length > 0 ? activeMonths.filter((bucket) => bucket.net >= 0).length / activeMonths.length : 0;
  if (volatility === null) {
    components.push({
      key: "cash_flow_stability",
      label: "Cash-flow stability",
      score: null,
      weight: HEALTH_WEIGHTS.cash_flow_stability,
      available: false,
      detail: "Not enough months of inflow to measure volatility.",
      reason: "requires at least two active months",
    });
  } else {
    const volatilityScore = clamp(100 - (volatility / 0.5) * 100, 0, 100);
    const score = Math.round(volatilityScore * 0.6 + positiveRatio * 100 * 0.4);
    components.push({
      key: "cash_flow_stability",
      label: "Cash-flow stability",
      score: clamp(score, 0, 100),
      weight: HEALTH_WEIGHTS.cash_flow_stability,
      available: true,
      detail: `Inflow volatility ${round1(volatility * 100)}% (coefficient of variation); ${Math.round(positiveRatio * 100)}% of active months had non-negative net cash.`,
    });
  }

  // Revenue trend.
  const trend = metrics.cash_flow.revenue_trend;
  if (!trend.available || trend.change_pct === null) {
    components.push({
      key: "revenue_trend",
      label: "Revenue trend",
      score: null,
      weight: HEALTH_WEIGHTS.revenue_trend,
      available: false,
      detail: trend.detail,
      reason: "requires at least three months of activity",
    });
  } else {
    const score = trend.direction === "growing" ? 100 : trend.direction === "flat" ? 60 : 25;
    components.push({
      key: "revenue_trend",
      label: "Revenue trend",
      score,
      weight: HEALTH_WEIGHTS.revenue_trend,
      available: true,
      detail: trend.detail,
    });
  }

  // Payment discipline: failed/returned payments and known distress markers.
  const failedRatio = metrics.totals.failed_ratio;
  const disciplineScore = clamp(Math.round(100 - failedRatio * 300), 0, 100);
  components.push({
    key: "payment_discipline",
    label: "Payment discipline",
    score: disciplineScore,
    weight: HEALTH_WEIGHTS.payment_discipline,
    available: true,
    detail:
      metrics.totals.failed_count === 0
        ? "No failed or returned payments observed in the window."
        : `${metrics.totals.failed_count} failed/returned payment(s) observed.`,
  });

  // Customer concentration: how much sits on the single largest buyer.
  const topShare = metrics.counterparties.top_customers[0]?.share_of_inflow_pct ?? 0;
  const concentrationScore = clamp(Math.round(100 - (Math.max(0, topShare - 20) / 60) * 80), 20, 100);
  components.push({
    key: "customer_concentration",
    label: "Customer concentration",
    score: metrics.totals.inflow > 0 ? concentrationScore : null,
    weight: HEALTH_WEIGHTS.customer_concentration,
    available: metrics.totals.inflow > 0,
    detail:
      metrics.totals.inflow > 0
        ? `Largest buyer accounts for ${topShare}% of inflow${metrics.counterparties.anchor_buyer_risk ? " (above the 40% anchor-buyer threshold)." : "."}`
        : "No inflow in the window.",
    reason: metrics.totals.inflow > 0 ? undefined : "no inflow in the window",
  });

  // Liquidity buffer: statements do not capture running balances, so this is
  // reported as unavailable rather than invented.
  components.push({
    key: "liquidity_buffer",
    label: "Liquidity buffer",
    score: null,
    weight: HEALTH_WEIGHTS.liquidity_buffer,
    available: false,
    detail: "Balance data is not captured from the uploaded statements.",
    reason: "no running-balance column ingested",
  });

  const available = components.filter((component) => component.available && component.score !== null);
  const availableWeight = available.reduce((sum, component) => sum + component.weight, 0);
  const weighted = available.reduce((sum, component) => sum + (component.score as number) * component.weight, 0);
  const score = availableWeight > 0 ? Math.round(weighted / availableWeight) : 0;
  const band: HealthBand = score >= 80 ? "strong" : score >= 60 ? "stable" : score >= 40 ? "watch" : "at_risk";
  const bandLabel = band === "strong" ? "Strong" : band === "stable" ? "Stable" : band === "watch" ? "Watch" : "At risk";

  return {
    score: clamp(score, 0, 100),
    band,
    band_label: bandLabel,
    components,
    excluded_components: components.filter((component) => !component.available).map((component) => component.key),
    method: "weighted_components_renormalised_over_available_inputs",
  };
}

/**
 * Exactly three actionable tips, each derived from this business's own
 * numbers. Priority order follows the metric most likely to matter to a
 * lender/owner; fallbacks use real observed figures so no generic advice is
 * ever emitted.
 */
export function buildBusinessTips(metrics: BusinessMetrics, health: BusinessHealthScore): string[] {
  const tips: string[] = [];
  const topCustomer = metrics.counterparties.top_customers[0];
  const topShare = topCustomer?.share_of_inflow_pct ?? 0;

  if (topCustomer && topShare > 40) {
    tips.push(
      `Your top customer (${topCustomer.counterparty}) is ${topShare}% of inflow — diversifying would reduce revenue risk.`
    );
  }

  const volatility = metrics.cash_flow.inflow_volatility;
  if (volatility !== null && volatility >= 0.35) {
    tips.push(
      `Monthly inflow swings by about ${Math.round(volatility * 100)}% — a cash buffer sized to your lowest month would smooth timing risk.`
    );
  }

  const trend = metrics.cash_flow.revenue_trend;
  if (trend.available && trend.direction === "declining" && trend.change_pct !== null) {
    tips.push(`Inflow declined ${Math.abs(trend.change_pct)}% over the window — review pricing or customer retention before drawing more credit.`);
  }
  if (trend.available && trend.direction === "growing" && trend.change_pct !== null) {
    tips.push(`Inflow grew ${trend.change_pct}% over the window — this is the trend a lender will weight most heavily.`);
  }

  if (metrics.totals.inflow > 0 && metrics.counterparties.repeat_customer_ratio < 0.5) {
    tips.push(
      `Only ${Math.round(metrics.counterparties.repeat_customer_ratio * 100)}% of inflow comes from repeat customers — repeat business is the cheapest way to stabilise revenue.`
    );
  }

  if (metrics.totals.outflow > 0 && metrics.counterparties.supplier.repeat_supplier_count === 0) {
    tips.push("No repeat supplier relationships were detected — consolidating regular suppliers can improve pricing and payment terms.");
  }

  if (metrics.totals.failed_ratio > 0.05) {
    tips.push(
      `${Math.round(metrics.totals.failed_ratio * 100)}% of attempted payments failed or were returned — reducing failed payments improves your payment-discipline score.`
    );
  }

  if (metrics.counterparties.supplier.repeat_supplier_count > 0 && metrics.counterparties.supplier.regularity_score < 0.5) {
    tips.push(
      `Supplier payments are irregular across months (${Math.round(metrics.counterparties.supplier.regularity_score * 100)}% regularity) — scheduled payments strengthen your supply relationships.`
    );
  }

  const avgTicket = metrics.cash_flow.peak_activity.average_ticket;
  if (avgTicket > 0 && metrics.totals.credit_count > 0) {
    tips.push(
      `Your average payment is KES ${avgTicket.toLocaleString("en-KE")} across ${metrics.totals.credit_count} payments — the strongest-ticket customers are the ones to keep close.`
    );
  }

  const busiestDay = metrics.cash_flow.peak_activity.busiest_weekday;
  if (busiestDay) {
    tips.push(`${busiestDay} is your busiest day for incoming payments — align stock and staffing with that weekly peak.`);
  }

  if (metrics.totals.months_of_history > 0) {
    tips.push(
      `${metrics.totals.months_of_history} month(s) of history is visible to the platform — more history generally raises lender confidence.`
    );
  }

  const components = health.components.filter((component) => component.available && component.score !== null);
  const weakest = [...components].sort((a, b) => (a.score as number) - (b.score as number))[0];
  if (weakest) {
    tips.push(`Your weakest health component is ${weakest.label.toLowerCase()} (${weakest.score}/100) — ${weakest.detail}`);
  }

  const unique = Array.from(new Set(tips));
  return unique.slice(0, 3);
}

export interface BusinessContext {
  business: Business;
  metrics: BusinessMetrics;
  health: BusinessHealthScore;
  tips: string[];
}

/** Loads the business and its transactions and computes every derived metric.
 *  Shared by the dashboard endpoint and the decision-card service so a lender
 *  is never shown a number the owner's dashboard cannot reproduce. */
export async function loadBusinessContext(businessId: string, options: MetricsOptions = {}): Promise<BusinessContext> {
  const business: Business | undefined = await getBusiness(businessId);
  if (!business) throw new Error("business_not_found");

  const transactions = await dbAll<Transaction>(
    `SELECT * FROM transactions WHERE business_id = ? AND subject_type = 'business'`,
    [businessId]
  );

  const metrics = computeBusinessMetrics(transactions, options);
  const health = computeBusinessHealth(metrics);
  const tips = buildBusinessTips(metrics, health);

  return { business, metrics, health, tips };
}

/** Loads the business and its transactions, then computes the dashboard. */
export async function getBusinessDashboard(businessId: string, options: MetricsOptions = {}): Promise<BusinessDashboard> {
  const { business, metrics, health, tips } = await loadBusinessContext(businessId, options);

  return {
    business: {
      id: business.id,
      legal_name: business.legal_name,
      sector: business.sector ?? null,
      status: business.status,
      trust_score: business.trust_score,
      is_sandbox: business.is_sandbox,
    },
    generated_at: (options.now ?? new Date()).toISOString(),
    window: metrics.window,
    cash_flow: metrics.cash_flow,
    counterparties: metrics.counterparties,
    totals: metrics.totals,
    health_score: health,
    tips,
  };
}

