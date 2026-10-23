import type { BusinessMetrics } from "./businessMetricsService";
import type { ReceivablesSummary } from "./receivablesService";

/**
 * Supply-chain-finance readiness signals.
 *
 * These are descriptive indicators for a factor/lender — not a financing
 * decision and not a modelled cash-flow. They answer:
 *   1. Is there an anchor buyer a reverse-factoring programme could build on?
 *   2. Are supplier relationships established enough to trust the payable side?
 *   3. Are receivables verifiable (matched to an actual bank/M-Pesa receipt)?
 *   4. If one buyer dominates but is not a verified anchor, is that a risk?
 */

export type AnchorBuyerSignal = "verified_anchor_candidate" | "concentration_risk" | "no_anchor";
export type SupplierSignal = "established" | "developing" | "none";
export type ReceivableVerifiabilitySignal = "verifiable" | "partial" | "unverifiable" | "no_invoice_data";

export interface SupplyChainReadiness {
  available: boolean;
  anchor_buyer: {
    candidate: string | null;
    share_of_inflow_pct: number | null;
    repeat_payments: number | null;
    active_months: number | null;
    signal: AnchorBuyerSignal;
    detail: string;
  };
  supplier_regularity: {
    repeat_supplier_count: number;
    regularity_score: number;
    signal: SupplierSignal;
    detail: string;
  };
  receivable_verifiability: {
    matched_payment_ratio: number | null;
    open_invoice_value: number | null;
    signal: ReceivableVerifiabilitySignal;
    detail: string;
  };
  concentration_warning: boolean;
  summary: string;
}

/** Thresholds are deliberately explicit so a lender can audit the signal. */
export const SUPPLY_CHAIN_THRESHOLDS = {
  /** A buyer is "large" from this share of inflow. */
  largeBuyerSharePct: 40,
  /** Anchor candidate needs at least this many payments... */
  anchorMinPayments: 3,
  /** ...spread over at least this many distinct months. */
  anchorMinMonths: 2,
  /** ...and at least this share of inflow. */
  anchorMinSharePct: 25,
  /** Supplier relationships are "established" from this regularity score. */
  supplierEstablishedRegularity: 0.5,
  /** Receivables are "verifiable" from this matched-receipt ratio. */
  receivableVerifiableRatio: 0.8,
  /** ...and "partial" above this. */
  receivablePartialRatio: 0.2,
} as const;

export function computeSupplyChainReadiness(
  metrics: BusinessMetrics,
  receivables: ReceivablesSummary | null
): SupplyChainReadiness {
  const top = metrics.counterparties.top_customers[0] ?? null;
  const share = top?.share_of_inflow_pct ?? 0;
  const payments = top?.transaction_count ?? 0;
  const months = top?.active_months ?? 0;

  let anchorSignal: AnchorBuyerSignal = "no_anchor";
  if (
    top &&
    payments >= SUPPLY_CHAIN_THRESHOLDS.anchorMinPayments &&
    months >= SUPPLY_CHAIN_THRESHOLDS.anchorMinMonths &&
    share >= SUPPLY_CHAIN_THRESHOLDS.anchorMinSharePct
  ) {
    anchorSignal = "verified_anchor_candidate";
  } else if (top && share > SUPPLY_CHAIN_THRESHOLDS.largeBuyerSharePct) {
    anchorSignal = "concentration_risk";
  }

  const concentrationWarning =
    share > SUPPLY_CHAIN_THRESHOLDS.largeBuyerSharePct && anchorSignal !== "verified_anchor_candidate";

  const supplierScore = metrics.counterparties.supplier.regularity_score;
  const supplierSignal: SupplierSignal =
    metrics.counterparties.supplier.repeat_supplier_count === 0
      ? "none"
      : supplierScore >= SUPPLY_CHAIN_THRESHOLDS.supplierEstablishedRegularity
        ? "established"
        : "developing";

  const matchedRatio = receivables?.matched_payment_ratio ?? null;
  let verifiabilitySignal: ReceivableVerifiabilitySignal = "no_invoice_data";
  if (matchedRatio !== null) {
    if (matchedRatio >= SUPPLY_CHAIN_THRESHOLDS.receivableVerifiableRatio) verifiabilitySignal = "verifiable";
    else if (matchedRatio > SUPPLY_CHAIN_THRESHOLDS.receivablePartialRatio) verifiabilitySignal = "partial";
    else verifiabilitySignal = "unverifiable";
  }

  const anchorDetail =
    anchorSignal === "verified_anchor_candidate"
      ? `${top?.counterparty} paid ${payments} times across ${months} months (${share}% of inflow) — a plausible reverse-factoring anchor.`
      : anchorSignal === "concentration_risk"
        ? `${top?.counterparty} is ${share}% of inflow but has only ${payments} payment(s) across ${months} month(s) — concentration risk, not a verified anchor.`
        : "No single repeat buyer is large enough to anchor a reverse-factoring programme yet.";

  const supplierDetail =
    supplierSignal === "established"
      ? `${metrics.counterparties.supplier.repeat_supplier_count} repeat supplier(s) paid with ${Math.round(supplierScore * 100)}% cross-month regularity.`
      : supplierSignal === "developing"
        ? `${metrics.counterparties.supplier.repeat_supplier_count} repeat supplier(s) detected, but payments are irregular across months.`
        : "No repeat supplier relationships detected in the window.";

  const verifiabilityDetail =
    verifiabilitySignal === "no_invoice_data"
      ? "No invoice data — receivable verifiability cannot be assessed."
      : verifiabilitySignal === "verifiable"
        ? `${Math.round((matchedRatio as number) * 100)}% of open invoices have a matched verified receipt.`
        : verifiabilitySignal === "partial"
          ? `${Math.round((matchedRatio as number) * 100)}% of open invoices have a matched verified receipt; the rest are unverified.`
          : "Open invoices are not yet backed by verified receipts.";

  const summaryParts: string[] = [];
  if (concentrationWarning) summaryParts.push("Concentration warning: one unverified buyer dominates inflow.");
  else if (anchorSignal === "verified_anchor_candidate") summaryParts.push("Anchor-buyer candidate exists for reverse factoring.");
  if (supplierSignal === "established") summaryParts.push("Supplier relationship is established.");
  if (verifiabilitySignal === "verifiable") summaryParts.push("Receivables are receipt-verified.");
  else if (verifiabilitySignal === "no_invoice_data") summaryParts.push("No invoice data for receivable verification.");

  return {
    available: metrics.totals.inflow > 0,
    anchor_buyer: {
      candidate: top?.counterparty ?? null,
      share_of_inflow_pct: top ? share : null,
      repeat_payments: top ? payments : null,
      active_months: top ? months : null,
      signal: anchorSignal,
      detail: anchorDetail,
    },
    supplier_regularity: {
      repeat_supplier_count: metrics.counterparties.supplier.repeat_supplier_count,
      regularity_score: supplierScore,
      signal: supplierSignal,
      detail: supplierDetail,
    },
    receivable_verifiability: {
      matched_payment_ratio: matchedRatio,
      open_invoice_value: receivables?.open_invoice_value ?? null,
      signal: verifiabilitySignal,
      detail: verifiabilityDetail,
    },
    concentration_warning: concentrationWarning,
    summary: summaryParts.join(" "),
  };
}
