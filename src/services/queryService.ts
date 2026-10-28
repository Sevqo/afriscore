import {dbAll} from '../db';
import {singleCurrency} from './currency-integrity';
import { getBusiness } from "./businessService";
import { computeFinancialProfile } from "./analyticsService";
import {
  getOverdueInvoices,
  getCashFlowForecast,
  getUnusualTransactions,
  getCustomerConcentration,
} from "./insightsService";

/**
 * Query Service — the front door the spec's "AI agent vision" (section 21)
 * describes: a person asks a plain-language question, the platform
 * answers using its own structured data.
 *
 * This is intentionally NOT wired to a real language model — there's no
 * API key available to call one, and more importantly, the spec is
 * explicit that answers should come from structured data, not model
 * guesswork. What's here is honest keyword-intent matching: narrower
 * than real NLU, but every answer is 100% grounded in real data, with
 * zero hallucination risk. Swap the matchIntent() function for a real
 * LLM call later if broader phrasing coverage is worth the trade-off —
 * everything downstream (the actual data lookups) doesn't need to change.
 */

export interface QueryAnswer {
  question: string;
  matched_intent: string | null;
  answer: string;
  data: unknown;
}

type DataScope = "trust_score" | "financial_profile" | "insights" | "accounts" | "transactions" | "invoices" | "query";

interface IntentDef {
  intent: string;
  /** Consent scope needed to see the data this intent returns. `query` only
   *  buys the natural-language door; the answer's underlying capability is
   *  gated by its own scope, exactly like the REST endpoint would be. */
  requiredScope: DataScope;
  keywords: string[][]; // each inner array is a set of keywords that ALL must appear
}

const INTENTS: IntentDef[] = [
  { intent: "overdue_invoices", requiredScope: "invoices", keywords: [["overdue"], ["invoice", "invoices"]] },
  { intent: "cash_flow_forecast", requiredScope: "insights", keywords: [["cash", "forecast", "cashflow"]] },
  {
    intent: "unusual_transactions",
    requiredScope: "transactions",
    keywords: [["unusual", "suspicious", "outlier", "anomal"], ["transaction"]],
  },
  {
    intent: "customer_concentration",
    requiredScope: "insights",
    keywords: [["customer", "client"], ["depend", "concentrat", "biggest", "largest"]],
  },
  { intent: "financial_profile", requiredScope: "financial_profile", keywords: [["revenue", "profile", "financial", "income"]] },
  { intent: "trust_score", requiredScope: "trust_score", keywords: [["trust", "score", "verified", "verification"]] },
];

function matchIntent(question: string): IntentDef | null {
  const tokens=new Set(question.toLowerCase().replace(/_/g,' ').match(/[a-z0-9]+/g)||[]);
  const variants:Record<string,string[]>={transaction:['transaction','transactions'],invoice:['invoice','invoices'],invoices:['invoice','invoices'],customer:['customer','customers'],client:['client','clients'],concentrat:['concentration','concentrated'],depend:['depend','dependent','dependency'],anomal:['anomaly','anomalies','anomalous']};
  const matches=INTENTS.filter(def=>def.keywords.every(group=>group.some(kw=>(variants[kw]||[kw]).some(word=>tokens.has(word)))));
  return matches.length===1?matches[0]:null;
}

/** Resolves the intent (and the consent scope it requires) without touching
 *  any data, so routes can authorise before the query runs. */
export function resolveIntent(question: string): { intent: string; requiredScope: DataScope } | null {
  const def = matchIntent(question);
  return def ? { intent: def.intent, requiredScope: def.requiredScope } : null;
}

export async function answerQuestion(businessId: string, question: string): Promise<QueryAnswer> {
  const business = await getBusiness(businessId);
  if (!business) throw new Error("business_not_found");

  const resolved = matchIntent(question);
  const intent = resolved?.intent ?? null;
  const sourceTable=['overdue_invoices','customer_concentration'].includes(intent||'')?'invoices':'transactions';
  const sourceRows=intent&&intent!=='trust_score'?await dbAll<{currency:string}>('SELECT DISTINCT currency FROM '+sourceTable+' WHERE business_id=?',[businessId]):[];
  const currency=singleCurrency(sourceRows);

  switch (intent) {
    case "overdue_invoices": {
      const data = await getOverdueInvoices(businessId);
      const answer =
        data.length === 0
          ? "No overdue invoices."
          : `${data.length} overdue invoice(s), totaling ${data.reduce((s, i) => s + i.amount, 0).toFixed(2)} ${currency}. Most overdue: ${data[0].customer_reference} at ${data[0].days_overdue} days.`;
      return { question, matched_intent: intent, answer, data };
    }

    case "cash_flow_forecast": {
      const data = await getCashFlowForecast(businessId);
      const answer = `Based on ${data.based_on_days} day(s) of history (${data.confidence} confidence), projected net cash flow over the next 30 days is ${data.forecast_next_30d.toFixed(2)} ${currency}.`;
      return { question, matched_intent: intent, answer, data };
    }

    case "unusual_transactions": {
      const data = await getUnusualTransactions(businessId);
      const answer =
        data.length === 0
          ? "No statistically unusual transactions found."
          : `${data.length} transaction(s) more than 2 standard deviations from the business's typical size — largest deviation: ${data[0].amount} ${currency}.`;
      return { question, matched_intent: intent, answer, data };
    }

    case "customer_concentration": {
      const data = await getCustomerConcentration(businessId);
      const answer =
        data.length === 0
          ? "No paid invoices yet to measure customer concentration."
          : `Top customer is ${data[0].customer_reference}, accounting for ${data[0].share_of_total_pct}% of covered collected invoices.`;
      return { question, matched_intent: intent, answer, data };
    }

    case "financial_profile": {
      const data = await computeFinancialProfile(businessId);
      const answer = `Recorded credit inflows: ${data.total_revenue} ${currency}. Recorded debits: ${data.total_expenses} ${currency}. Net cash flow: ${data.net_cash_flow} ${currency}.`;
      return { question, matched_intent: intent, answer, data };
    }

    case "trust_score": {
      const answer = `${business.legal_name} has a trust score of ${business.trust_score}/100 and status "${business.status}".`;
      return { question, matched_intent: intent, answer, data: { trust_score: business.trust_score, status: business.status } };
    }

    default:
      return {
        question,
        matched_intent: null,
        answer:
          "I couldn't match that to a known question. Try asking about: overdue invoices, cash flow forecast, unusual transactions, customer concentration, financial profile, or trust score.",
        data: null,
      };
  }
}