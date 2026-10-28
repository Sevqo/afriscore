import { dbAll, dbGet, dbRun, dbTransaction, isPostgres } from "../db";
import {
  Invoice,
  createInvoicePaymentRow,
  listOpenInvoicesForBusiness,
  markInvoicePaid,
} from "./invoiceService";
import { Transaction } from "./transactionService";
import { appendEvent } from "./ledgerService";
import { emitEvent } from "./webhookService";
import { getBusiness } from "./businessService";
import {setImmediate as yieldTurn} from 'node:timers/promises';

export type MatchType = "exact" | "tolerance" | "partial";

export interface Match {
  invoice_id: string;
  transaction_ids: string[];
  invoice_amount: number;
  paid_amount: number;
  match_type: MatchType;
  confidence: number; // 0-1
  note?: string;
}

export interface ReconciliationResult {
  matched: Match[];
  unmatched_invoices: { invoice_id: string; amount: number; reason: string }[];
}

/**
 * Tolerance for "close enough" matching. Real Kenyan payments rarely
 * land on the exact invoiced figure — M-Pesa transaction charges,
 * bank fees, and rounding all shave a little off. A payment within
 * 2% (capped at KES 100) of the invoice is treated as settling it,
 * with the shortfall recorded on the ledger rather than silently
 * ignored.
 */
const TOLERANCE_PCT = 0.02;
const TOLERANCE_MAX_KES = 100;

/** Call inside a transaction before reading invoice balances. SQLite already
 * serializes transactions; Postgres needs a shared lock across settlement paths. */
export async function lockReceivables(businessId:string){
  if(isPostgres)await dbGet('SELECT pg_advisory_xact_lock(hashtext(?))',['legacy-receivables:'+businessId]);
}

function toleranceFor(amount: number): number {
  return Math.min(amount * TOLERANCE_PCT, TOLERANCE_MAX_KES);
}

/** Maps a transaction source to the receipt method recorded on an invoice. */
export function paymentMethodForProvider(provider: string): string {
  if (provider.startsWith("mpesa")) return "mpesa";
  if (provider === "bank") return "bank";
  return "other";
}

function normalizeCounterparty(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Loose comparator for counterparties, because the same payer is written
 * differently across providers ("254712345678", "+254 712 345 678",
 * "0712345678", "Acme Ltd", "ACME LIMITED"). Exact, or one is a suffix of the
 * other (phone prefixes / company suffixes), counts as agreement.
 */
const COMPANY_STOPWORDS = new Set([
  "limited",
  "ltd",
  "llc",
  "inc",
  "incorporated",
  "plc",
  "co",
  "company",
  "enterprises",
  "enterprise",
  "traders",
  "trading",
  "group",
  "holdings",
  "kenya",
  "the",
  "and",
  "of",
]);

function counterpartyTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !COMPANY_STOPWORDS.has(token));
}

export function counterpartyMatches(expected: string, actual: string | null | undefined): boolean {
  if (!actual) return false;

  // Phone-number formats vary wildly (254712345678, +254 712 345 678,
  // 0712345678): compare the significant last 9 digits.
  const digitsA = expected.replace(/\D/g, "");
  const digitsB = actual.replace(/\D/g, "");
  if (digitsA.length >= 9 && digitsB.length >= 9 && digitsA.slice(-9) === digitsB.slice(-9)) return true;

  // Company names differ by legal suffix / punctuation: compare significant
  // word tokens ("Acme Ltd" == "ACME LIMITED").
  const tokensA = counterpartyTokens(expected);
  const tokensB = counterpartyTokens(actual);
  if (tokensA.length && tokensB.length) {
    if (tokensA.join(" ") === tokensB.join(" ")) return true;
    const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
    const longer = shorter === tokensA ? tokensB : tokensA;
    if (shorter.every((token) => longer.includes(token))) return true;
  }

  const a = normalizeCounterparty(expected);
  const b = normalizeCounterparty(actual);
  if (!a || !b) return false;
  if (a === b) return true;
  // Require a meaningful overlap: at least the last 4 characters.
  const min = Math.min(a.length, b.length);
  if (min < 4) return false;
  return a.endsWith(b) || b.endsWith(a);
}

/**
 * Applies the documented counterparty effect: when an invoice names an
 * expected payer, a payment whose counterparty agrees is trusted more, and
 * one whose counterparty disagrees is trusted less — so it lands in the
 * "review this" bucket instead of being silently accepted.
 */
function withCounterpartyConfidence(base: number, matchType: MatchType, invoice: Invoice, txns: Transaction[]): {
  confidence: number;
  note?: string;
} {
  const expected = invoice.expected_counterparty;
  if (!expected) return { confidence: base };

  const allAgree = txns.every((t) => counterpartyMatches(expected, t.counterparty));
  if (allAgree) {
    return { confidence: Math.min(1, Math.round((base + 0.05) * 100) / 100), note: "Counterparty matches the expected payer." };
  }
  return {
    confidence: Math.max(0.1, Math.round((base - 0.2) * 100) / 100),
    note: "Counterparty does not match the expected payer — review this match before relying on it.",
  };
}

/**
 * Reconciliation engine. Runs three strategies per invoice, in descending
 * order of confidence:
 *
 *   1. exact     — one transaction matching the invoice to the cent
 *   2. tolerance — one transaction within the fee/rounding tolerance
 *   3. partial   — several transactions summing to the invoice
 *                  (within tolerance), i.e. an installment payment
 *
 * Only completed credit transactions not already matched to another
 * invoice are eligible, so a single payment can never settle two invoices.
 * The whole run is one transaction and every claim is a conditional update,
 * so two concurrent runs cannot settle the same invoice or spend the same
 * payment twice.
 */
export async function reconcileBusiness(businessId: string): Promise<ReconciliationResult> {
  const business = await getBusiness(businessId);
  if (!business) throw new Error("business_not_found");



  const result = await dbTransaction(async () => {
    await lockReceivables(businessId);
    const unpaidInvoices = await listOpenInvoicesForBusiness(businessId);
    const matched: Match[] = [];
    const unmatched: ReconciliationResult["unmatched_invoices"] = [];

    for (const invoice of unpaidInvoices) {
      await yieldTurn();
      const candidates = await dbAll<Transaction>(
        `SELECT * FROM transactions
         WHERE business_id = ? AND currency = ? AND type = 'credit' AND status = 'completed' AND matched_invoice_id IS NULL
         ORDER BY occurred_at ASC`,
        [businessId,invoice.currency]
      );
      const amountById = new Map(candidates.map((txn) => [txn.id, txn]));

      const match = findMatch(invoice, candidates);

      if (!match) {
        unmatched.push({
          invoice_id: invoice.id,
          amount: invoice.amount,
          reason: candidates.length === 0 ? "no_unmatched_payments_available" : "no_unambiguous_match_within_search_budget",
        });
        continue;
      }

      // Conditional claims: only succeed if the payment is still unclaimed.
      const claimedNow: string[] = [];
      let claimFailed = false;
      for (const txnId of match.transaction_ids) {
        const claim = await dbRun(`UPDATE transactions SET matched_invoice_id = ? WHERE id = ? AND matched_invoice_id IS NULL`, [
          invoice.id,
          txnId,
        ]);
        if (claim.changes === 0) {
          claimFailed = true;
          break;
        }
        claimedNow.push(txnId);
      }

      if (claimFailed) {
        // Release anything this attempt claimed so the payment is not
        // permanently attached to an invoice that was not settled.
        for (const txnId of claimedNow) {
          await dbRun(`UPDATE transactions SET matched_invoice_id = NULL WHERE id = ? AND matched_invoice_id = ?`, [txnId, invoice.id]);
        }
        unmatched.push({ invoice_id: invoice.id, amount: invoice.amount, reason: "payment_claimed_concurrently" });
        continue;
      }

      const occurredAt=match.transaction_ids.map(id=>amountById.get(id)!.occurred_at).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)!;
      const settlement = await markInvoicePaid(invoice.id, match.transaction_ids[0], match.paid_amount,occurredAt);
      if (!settlement.changed) {
        for (const txnId of claimedNow) {
          await dbRun(`UPDATE transactions SET matched_invoice_id = NULL WHERE id = ? AND matched_invoice_id = ?`, [txnId, invoice.id]);
        }
        unmatched.push({ invoice_id: invoice.id, amount: invoice.amount, reason: "invoice_already_settled" });
        continue;
      }

      // Mirror the claimed transactions as receipt rows so the receivables
      // module (DSO, review queue, decision card) sees a verifiable payment.
      for (const txnId of match.transaction_ids) {
        const txn = amountById.get(txnId);
        if (!txn) continue;
        await createInvoicePaymentRow({
          business_id: businessId,
          invoice_id: invoice.id,
          transaction_id: txnId,
          amount: txn.amount,
          method: paymentMethodForProvider(txn.source_provider),
          reference: txn.external_id,
          paid_at: txn.occurred_at,
        });
      }

      await appendEvent("business", businessId, "invoice.paid", {
        invoice_id: invoice.id,
        transaction_ids: match.transaction_ids,
        invoice_amount: match.invoice_amount,
        paid_amount: match.paid_amount,
        match_type: match.match_type,
        confidence: match.confidence,
      });

      matched.push(match);
      await emitEvent('invoice.paid',{invoice_id:invoice.id,business_id:businessId,transaction_ids:match.transaction_ids,paid_amount:match.paid_amount,match_type:match.match_type},{type:'business',id:businessId,is_sandbox:business.is_sandbox});
    }

    return { matched, unmatched_invoices: unmatched };
  });


  return result;
}

/** Pure matching logic — no DB access, so it's directly unit-testable. */
export function findMatch(invoice: Invoice, candidates: Transaction[]): Match | null {
  candidates=candidates.filter(t=>t.currency===invoice.currency&&t.business_id===invoice.business_id&&t.status==='completed'&&t.type==='credit');
  const tolerance = invoice.currency==='KES'?toleranceFor(invoice.amount):0;

  // 1. Exact single-transaction match.
  const exactMatches=candidates.filter(t=>t.amount===invoice.amount);
  if(exactMatches.length>1)return null;
  const exact = exactMatches[0];
  if (exact) {
    const trust = withCounterpartyConfidence(1, "exact", invoice, [exact]);
    return {
      invoice_id: invoice.id,
      transaction_ids: [exact.id],
      invoice_amount: invoice.amount,
      paid_amount: exact.amount,
      match_type: "exact",
      confidence: trust.confidence,
      note: trust.note,
    };
  }

  // 2. Single transaction within tolerance (fees/rounding).
  const close = candidates
    .filter((t) => Math.abs(t.amount - invoice.amount) <= tolerance)
    .sort((a, b) => Math.abs(a.amount - invoice.amount) - Math.abs(b.amount - invoice.amount));
  if(close.length>1)return null;
  const within=close[0];

  if (within) {
    const diff = invoice.amount - within.amount;
    const trust = withCounterpartyConfidence(0.9, "tolerance", invoice, [within]);
    const diffNote =
      diff > 0
        ? `Short by ${diff.toFixed(2)} KES — likely transaction fees or rounding.`
        : `Over by ${Math.abs(diff).toFixed(2)} KES.`;
    return {
      invoice_id: invoice.id,
      transaction_ids: [within.id],
      invoice_amount: invoice.amount,
      paid_amount: within.amount,
      match_type: "tolerance",
      confidence: trust.confidence,
      note: trust.note ? `${diffNote} ${trust.note}` : diffNote,
    };
  }

  // 3. Several transactions summing to the invoice (installments).
  const combo = findCombination(candidates, invoice.amount, tolerance);
  if (combo) {
    const paid = combo.reduce((s, t) => s + t.amount, 0);
    const trust = withCounterpartyConfidence(0.75, "partial", invoice, combo);
    const baseNote = `Settled by ${combo.length} separate payments.`;
    return {
      invoice_id: invoice.id,
      transaction_ids: combo.map((t) => t.id),
      invoice_amount: invoice.amount,
      paid_amount: Math.round(paid * 100) / 100,
      match_type: "partial",
      confidence: trust.confidence,
      note: trust.note ? `${baseNote} ${trust.note}` : baseNote,
    };
  }

  return null;
}

/**
 * Finds a subset of transactions summing to the target within
 * tolerance. Capped at combinations of 4 and at 40 candidates —
 * subset-sum is exponential, and an unbounded search would stall the
 * whole request on a business with a busy till. Prefers the fewest
 * transactions, then the closest sum.
 */
export const MATCH_SEARCH_BUDGET=5000;
function findCombination(candidates:Transaction[],target:number,tolerance:number):Transaction[]|null{
 const pool=candidates.filter(t=>t.amount>0&&t.amount<=target+tolerance).slice(0,40);
 let remaining=MATCH_SEARCH_BUDGET;
 for(let size=2;size<=4;size++){
 let found:Transaction[]|null=null,ambiguous=false;
 const visit=(start:number,chosen:Transaction[],sum:number):void=>{
  if(ambiguous||remaining<=0)return;
  if(chosen.length===size){if(Math.abs(sum-target)<=tolerance){if(found)ambiguous=true;else found=[...chosen];}return;}
  for(let i=start;i<pool.length&&!ambiguous&&remaining>0;i++){
   remaining--;if(sum+pool[i].amount>target+tolerance)continue;
   chosen.push(pool[i]);visit(i+1,chosen,sum+pool[i].amount);chosen.pop();
  }
 };
 visit(0,[],0);
 if(ambiguous||remaining<=0)return null;
 if(found)return found;
 }
 return null;
}
