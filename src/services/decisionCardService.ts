import { dbGet, dbTransaction } from "../db";
import { Business } from "./businessService";
import { appendEvent } from "./ledgerService";
import {
  BusinessHealthScore,
  BusinessMetrics,
  loadBusinessContext,
  MetricsOptions,
} from "./businessMetricsService";
import { listShortcodes } from "./businessOnboardingService";
import { getReceivablesSummary, ReceivablesSummary } from "./receivablesService";
import { computeSupplyChainReadiness, SupplyChainReadiness } from "./supplyChainService";

/**
 * Lender-facing decision cards.
 *
 * The shared `DecisionCard` contract is the platform's credit-decision
 * surface: one shape for any subject type, with a business extension. This
 * module maps the deterministic dashboard metrics and the business health
 * score into that shape — it does not introduce a second scoring model.
 *
 * Issuing a card is an auditable event, not a read: every derived metric and
 * the final decision are appended to the subject's hash-chained ledger in one
 * DB transaction, and the returned `audit_trail_ref` is the ledger entry id of
 * the decision itself.
 */

export type RiskBand = "low" | "moderate" | "elevated" | "high";
export type DecisionVerdict = "approve" | "review" | "decline";
export type EvidenceImpact = "positive" | "negative" | "neutral";

export interface DecisionEvidence {
  key: string;
  label: string;
  value: string | number;
  impact: EvidenceImpact;
  detail: string;
}

export interface DecisionConfidence {
  overall: number;
  /** Null until invoice data exists: never fabricated. */
  reconciliation_score: number | null;
  data_completeness: number;
  months_of_history: number;
  method: string;
}

export interface DecisionCard {
  subject: { type: "business" | "individual"; id: string; name: string };
  generated_at: string;
  currency: string;
  recommended_limit: number;
  risk_band: RiskBand;
  verdict: DecisionVerdict;
  evidence: DecisionEvidence[];
  confidence: DecisionConfidence;
  adverse_indicators: string[];
  /** Ledger entry id of the decision event itself. */
  audit_trail_ref: string;
  methodology: {
    score_source: string;
    limit_formula: string;
    risk_band_mapping: string;
  };
}

export interface BusinessDecisionCard extends DecisionCard {
  business_name: string;
  shortcodes: string[];
  monthly_inflow_avg: number;
  inflow_volatility: number | null;
  revenue_trend: { direction: string; change_pct: number | null };
  months_of_history: number;
  top_customer_concentration: number;
  business_health_score: number;
  health_band: string;
  receivables: ReceivablesSummary | null;
  /** Descriptive supply-chain-finance readiness signals (not a financing decision). */
  supply_chain_readiness: SupplyChainReadiness;
}

export type BusinessDecisionCardDraft = Omit<BusinessDecisionCard, "audit_trail_ref">;

const CURRENCY = "KES";
const MAX_LIMIT = 10_000_000;

const RISK_MULTIPLIER: Record<RiskBand, number> = { low: 1.5, moderate: 1.0, elevated: 0.5, high: 0.25 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundDownTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function bandToRisk(health: BusinessHealthScore): RiskBand {
  switch (health.band) {
    case "strong":
      return "low";
    case "stable":
      return "moderate";
    case "watch":
      return "elevated";
    default:
      return "high";
  }
}

function riskier(band: RiskBand): RiskBand {
  switch (band) {
    case "low":
      return "moderate";
    case "moderate":
      return "elevated";
    case "elevated":
      return "high";
    default:
      return "high";
  }
}

function adverseIndicators(metrics: BusinessMetrics, health: BusinessHealthScore, statementsCount: number): string[] {
  const indicators: string[] = [];
  const concentration = metrics.counterparties.top_customers[0]?.share_of_inflow_pct ?? 0;

  if (concentration > 40) indicators.push("top_customer_concentration_above_40pct");
  if (metrics.totals.failed_ratio > 0.05) indicators.push("failed_payment_ratio_above_5pct");
  if (metrics.cash_flow.revenue_trend.direction === "declining") indicators.push("revenue_trend_declining");
  if ((metrics.cash_flow.inflow_volatility ?? 0) > 0.5) indicators.push("high_inflow_volatility");
  if (metrics.totals.months_of_history < 3) indicators.push("insufficient_history");
  if (health.score < 40) indicators.push("health_score_at_risk");
  if (statementsCount === 0) indicators.push("no_statements_ingested");

  return indicators;
}

/**
 * Recommended limit formula (documented in the response):
 *   base = average monthly inflow
 *   × risk multiplier (low 1.5 / moderate 1.0 / elevated 0.5 / high 0.25)
 *   × concentration haircut (up to -40% above a 40% top-customer share)
 *   × failed-payment haircut (up to -20%)
 *   × 0.5 if the health score is below 50
 * rounded down to the nearest KES 1,000 and capped at KES 10,000,000.
 */
export function computeRecommendedLimit(metrics: BusinessMetrics, health: BusinessHealthScore, riskBand: RiskBand): number {
  const activeMonths = Math.max(1, metrics.totals.months_of_history);
  const monthlyInflowAvg = metrics.totals.inflow / activeMonths;
  const concentration = metrics.counterparties.top_customers[0]?.share_of_inflow_pct ?? 0;
  const concentrationHaircut = 1 - clamp((concentration - 40) / 100, 0, 0.4);
  const failedHaircut = 1 - clamp(metrics.totals.failed_ratio, 0, 0.2);
  const healthHaircut = health.score < 50 ? 0.5 : 1;

  const raw = monthlyInflowAvg * RISK_MULTIPLIER[riskBand] * concentrationHaircut * failedHaircut * healthHaircut;
  return clamp(roundDownTo(raw, 1000), 0, MAX_LIMIT);
}

function verdictFor(riskBand: RiskBand, confidenceOverall: number): DecisionVerdict {
  if (riskBand === "low" && confidenceOverall >= 0.6) return "approve";
  if (riskBand === "elevated" || riskBand === "high") return "decline";
  return "review";
}

function buildEvidence(metrics: BusinessMetrics, health: BusinessHealthScore, confidence: DecisionConfidence): DecisionEvidence[] {
  const concentration = metrics.counterparties.top_customers[0]?.share_of_inflow_pct ?? 0;
  const activeMonths = Math.max(1, metrics.totals.months_of_history);
  const monthlyInflowAvg = round2(metrics.totals.inflow / activeMonths);
  const trend = metrics.cash_flow.revenue_trend;

  return [
    {
      key: "monthly_inflow_avg",
      label: "Average monthly inflow",
      value: monthlyInflowAvg,
      impact: monthlyInflowAvg > 0 ? "positive" : "negative",
      detail: `${metrics.totals.credit_count} incoming payment(s) across ${metrics.totals.months_of_history} active month(s).`,
    },
    {
      key: "business_health_score",
      label: "Business health score",
      value: health.score,
      impact: health.score >= 60 ? "positive" : health.score >= 40 ? "neutral" : "negative",
      detail: `${health.band_label} band from ${health.components.filter((c) => c.available).length} available component(s).`,
    },
    {
      key: "revenue_trend",
      label: "Revenue trend",
      value: trend.change_pct ?? 0,
      impact: trend.direction === "growing" ? "positive" : trend.direction === "declining" ? "negative" : "neutral",
      detail: trend.detail,
    },
    {
      key: "top_customer_concentration",
      label: "Top-customer concentration",
      value: concentration,
      impact: concentration > 40 ? "negative" : "neutral",
      detail:
        metrics.counterparties.top_customers[0]
          ? `${metrics.counterparties.top_customers[0].counterparty} is ${concentration}% of inflow.`
          : "No customer concentration measurable.",
    },
    {
      key: "inflow_volatility",
      label: "Inflow volatility",
      value: metrics.cash_flow.inflow_volatility ?? 0,
      impact: (metrics.cash_flow.inflow_volatility ?? 0) > 0.5 ? "negative" : "positive",
      detail:
        metrics.cash_flow.inflow_volatility === null
          ? "Not enough monthly data to measure volatility."
          : "Coefficient of variation of monthly inflow.",
    },
    {
      key: "repeat_customers",
      label: "Repeat-customer share of inflow",
      value: round2(metrics.counterparties.repeat_customer_ratio * 100),
      impact: metrics.counterparties.repeat_customer_ratio >= 0.5 ? "positive" : "neutral",
      detail: `${metrics.counterparties.supplier.repeat_supplier_count} repeat supplier relationship(s) detected.`,
    },
    {
      key: "data_completeness",
      label: "Data completeness",
      value: round2(confidence.data_completeness * 100),
      impact: confidence.data_completeness >= 0.6 ? "positive" : "negative",
      detail: `${confidence.months_of_history} month(s) of history; ${confidence.reconciliation_score === null ? "no invoice reconciliation data" : "invoice data reconciled"}.`,
    },
  ];
}

/**
 * Pure mapping from deterministic metrics to the shared decision-card shape.
 * Exported for boundary tests; `issueBusinessDecisionCard` adds the ledger
 * audit reference.
 */
export function buildBusinessDecisionCard(input: {
  business: Business;
  metrics: BusinessMetrics;
  health: BusinessHealthScore;
  shortcodes: string[];
  receivables: ReceivablesSummary | null;
  statementsCount: number;
  now?: Date;
}): BusinessDecisionCardDraft {
  const { business, metrics, health, shortcodes, receivables, statementsCount } = input;
  const now = input.now ?? new Date();

  const availableComponents = health.components.filter((component) => component.available).length;
  const dataCompleteness = round2(
    0.5 * (availableComponents / health.components.length) +
      0.3 * Math.min(metrics.totals.months_of_history / 6, 1) +
      0.2 * (statementsCount > 0 ? 1 : 0)
  );
  const reconciliationScore = receivables?.matched_payment_ratio ?? null;
  const overallConfidence =
    reconciliationScore === null
      ? dataCompleteness
      : round2(dataCompleteness * 0.7 + reconciliationScore * 0.3);

  const confidence: DecisionConfidence = {
    overall: overallConfidence,
    reconciliation_score: reconciliationScore,
    data_completeness: dataCompleteness,
    months_of_history: metrics.totals.months_of_history,
    method:
      reconciliationScore === null
        ? "data_completeness_only (no invoice reconciliation data)"
        : "0.7*data_completeness + 0.3*reconciliation_score",
  };

  const adverse = adverseIndicators(metrics, health, statementsCount);
  let riskBand = bandToRisk(health);
  if (adverse.length >= 3) riskBand = riskier(riskBand);

  const activeMonths = Math.max(1, metrics.totals.months_of_history);
  const monthlyInflowAvg = round2(metrics.totals.inflow / activeMonths);
  const concentration = metrics.counterparties.top_customers[0]?.share_of_inflow_pct ?? 0;

  const card: BusinessDecisionCardDraft = {
    subject: { type: "business", id: business.id, name: business.legal_name },
    generated_at: now.toISOString(),
    currency: metrics.currency||CURRENCY,
    recommended_limit: 0,
    risk_band: riskBand,
    verdict: 'review',
    evidence: [...buildEvidence(metrics, health, confidence),{key:'source_provenance',label:'Unverified source evidence',value:'human_review_required',impact:'neutral',detail:'Imported credits may include transfers, loans and refunds. They are not verified sales revenue. No financing approval, decline or actionable credit limit is issued.'}],
    confidence,
    adverse_indicators: adverse,
    methodology: {
      score_source: "businessMetricsService (deterministic cash-flow, counterparty and health components)",
      limit_formula:
        "disabled-v2: zero actionable credit limit; independently verified revenue, qualified policy review and human authorization are prerequisites",
      risk_band_mapping: "health band strong→low, stable→moderate, watch→elevated, at_risk→high; three or more adverse indicators moves one band riskier",
    },
    business_name: business.legal_name,
    shortcodes,
    monthly_inflow_avg: monthlyInflowAvg,
    inflow_volatility: metrics.cash_flow.inflow_volatility,
    revenue_trend: {
      direction: metrics.cash_flow.revenue_trend.direction,
      change_pct: metrics.cash_flow.revenue_trend.change_pct,
    },
    months_of_history: metrics.totals.months_of_history,
    top_customer_concentration: concentration,
    business_health_score: health.score,
    health_band: health.band,
    receivables,
    supply_chain_readiness: computeSupplyChainReadiness(metrics, receivables),
  };

  return card;
}

/**
 * Computes and issues a decision card, writing every derived metric and the
 * decision itself to the business's hash-chained ledger in one transaction.
 */
export async function issueBusinessDecisionCard(
  businessId: string,
  options: MetricsOptions & { now?: Date } = {}
): Promise<BusinessDecisionCard> {
  const { business, metrics, health } = await loadBusinessContext(businessId, options);

  const shortcodes = (await listShortcodes(businessId)).map((entry) => entry.shortcode);
  const statementRow = await dbGet<{ c: number | string }>(`SELECT COUNT(*) AS c FROM statements WHERE business_id = ?`, [businessId]);
  const statementsCount = Number(statementRow?.c ?? 0);

  // Receivables are computed from recorded invoice payments; null means the
  // business has no invoice data, in which case DSO is not fabricated.
  const receivables = await getReceivablesSummary(businessId);

  const draft = buildBusinessDecisionCard({
    business,
    metrics,
    health,
    shortcodes,
    receivables,
    statementsCount,
    now: options.now,
  });

  const metricEvents: Array<{ key: string; value: number | string | null }> = [
    { key: "monthly_inflow_avg", value: draft.monthly_inflow_avg },
    { key: "inflow_volatility", value: draft.inflow_volatility },
    { key: "revenue_trend", value: draft.revenue_trend.direction },
    { key: "top_customer_concentration", value: draft.top_customer_concentration },
    { key: "business_health_score", value: draft.business_health_score },
    { key: "data_completeness", value: draft.confidence.data_completeness },
    { key: "anchor_buyer_signal", value: draft.supply_chain_readiness.anchor_buyer.signal },
    { key: "receivable_verifiability", value: draft.supply_chain_readiness.receivable_verifiability.signal },
  ];

  const auditTrailRef = await dbTransaction(async () => {
    for (const metric of metricEvents) {
      await appendEvent("business", businessId, "decision.metric_recorded", {
        metric: metric.key,
        value: metric.value,
        window_months: metrics.window.months,
      });
    }

    const decisionEntry = await appendEvent("business", businessId, "decision.issued", {
      recommended_limit: draft.recommended_limit,
      currency: draft.currency,
      risk_band: draft.risk_band,
      verdict: draft.verdict,
      confidence_overall: draft.confidence.overall,
      confidence_reconciliation_score: draft.confidence.reconciliation_score,
      confidence_data_completeness: draft.confidence.data_completeness,
      months_of_history: draft.months_of_history,
      business_health_score: draft.business_health_score,
      health_band: draft.health_band,
      adverse_indicators: draft.adverse_indicators,
      shortcodes: draft.shortcodes,
    });

    return decisionEntry.id;
  });

  return { ...draft, audit_trail_ref: auditTrailRef };
}
