import { Router, Request } from "express";
import { z } from "zod";
import { connectAccount, disconnectAccount, getAccount, listAccountsForBusiness } from "../services/accountService";
import { syncAccountTransactions, listTransactionsForBusiness, countTransactionsForBusiness } from "../services/transactionService";
import { computeFinancialProfile } from "../services/analyticsService";
import { hasActiveConsentScope } from "../services/consentService";
import { requireApiKey, AuthedRequest } from "../middleware/apiKeyAuth";
import { createInvoice, listInvoicesForBusiness, countInvoicesForBusiness, markOverdueInvoices } from "../services/invoiceService";
import { reconcileBusiness } from "../services/reconciliationService";
import { getOverdueInvoices, getCashFlowForecast, getUnusualTransactions, getCustomerConcentration, maskPiiCounterparty } from "../services/insightsService";
import { answerQuestion, resolveIntent } from "../services/queryService";
import { requireAdmin } from "../middleware/adminAuth";
import { parsePagination, setPaginationHeaders } from "./pagination";

type BizParams = { id: string; accountId: string };
type BizRequest = Request<BizParams>;

const router = Router({ mergeParams: true });

const connectSchema = z.object({
  provider: z.enum(["mpesa", "bank", "sandbox"]),
  account_identifier: z.string().min(3),
  scenario: z.enum(["success", "failure", "duplicate", "mixed"]).optional(),
});

router.post("/accounts/connect", requireAdmin, async (req: BizRequest, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  try {
    const account = await connectAccount(req.params.id, parsed.data.provider, parsed.data.account_identifier, parsed.data.scenario);
    res.status(201).json(account);
  } catch (e: any) {
    if (e.message === "business_not_found") return res.status(404).json({ error: "not_found" });
    if (e.message === "account_already_connected") {
      return res.status(409).json({ error: "account_already_connected", detail: "This provider account is already connected to the business." });
    }
    throw e;
  }
});

router.post("/accounts/:accountId/disconnect", requireAdmin, async (req: BizRequest, res) => {
  try {
    const account = await disconnectAccount(req.params.accountId, req.params.id);
    res.json(account);
  } catch (e: any) {
    if (e.message === "account_not_found") return res.status(404).json({ error: "not_found" });
    throw e;
  }
});

router.get("/accounts", requireAdmin, async (req: BizRequest, res) => {
  res.json(await listAccountsForBusiness(req.params.id));
});

router.post("/accounts/:accountId/sync", requireAdmin, async (req: BizRequest, res) => {
  try {
    const account = await getAccount(req.params.accountId);
    if (!account || account.business_id !== req.params.id) return res.status(404).json({ error: "not_found" });
    const result = await syncAccountTransactions(req.params.accountId);
    res.json(result);
  } catch (e: any) {
    if (e.message === "account_not_found") return res.status(404).json({ error: "not_found" });
    if (e.message === "account_disconnected") return res.status(409).json({ error: "account_disconnected", detail: "Reconnect the account before syncing" });
    throw e;
  }
});

router.get("/transactions", requireAdmin, async (req: BizRequest, res) => {
  const pagination = parsePagination(req, { defaultLimit: 100, maxLimit: 500 });
  const [transactions, total] = await Promise.all([
    listTransactionsForBusiness(req.params.id, pagination.limit, pagination.offset),
    countTransactionsForBusiness(req.params.id),
  ]);
  setPaginationHeaders(res, pagination, total);
  res.json(transactions);
});

router.get("/financial-profile", requireApiKey, async (req: AuthedRequest & BizRequest, res) => {
  if (!(await hasActiveConsentScope("business", req.params.id, req.client!.name, "financial_profile"))) {
    return res.status(403).json({ error: "consent_required", required_scope: "financial_profile" });
  }
  res.json(await computeFinancialProfile(req.params.id));
});

// === Phase 3: Business Operations ===

const invoiceSchema = z.object({
  customer_reference: z.string().min(1),
  amount: z.number().positive(),
  issue_date: z.string().datetime({ offset: true }).optional(),
  due_date: z.string().datetime({ offset: true }).optional(),
  expected_counterparty: z.string().optional(),
  invoice_number: z.string().min(1).max(80).optional(),
  status: z.enum(["draft", "sent"]).optional(),
  attachment: z
    .object({
      file_name: z.string().min(1).max(255),
      sha256: z.string().regex(/^[a-f0-9]{64}$/i),
      size_bytes: z.number().int().nonnegative(),
    })
    .optional(),
});

router.post("/invoices", requireAdmin, async (req: BizRequest, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  try {
    const invoice = await createInvoice({ business_id: req.params.id, ...parsed.data });
    res.status(201).json(invoice);
  } catch (e: any) {
    if (e.message === "business_not_found") return res.status(404).json({ error: "not_found" });
    if (e.message === "invalid_due_date") return res.status(400).json({ error: "invalid_input", detail: "due_date must not be before issue_date" });
    throw e;
  }
});

router.get("/invoices", requireAdmin, async (req: BizRequest, res) => {
  await markOverdueInvoices(req.params.id);
  const status = req.query.status ? String(req.query.status) : undefined;
  const pagination = parsePagination(req, { defaultLimit: 100, maxLimit: 500 });
  const [invoices, total] = await Promise.all([
    listInvoicesForBusiness(req.params.id, status, pagination.limit, pagination.offset),
    countInvoicesForBusiness(req.params.id, status),
  ]);
  setPaginationHeaders(res, pagination, total);
  res.json(invoices);
});

router.post("/reconcile", requireAdmin, async (req: BizRequest, res) => {
  try {
    const result = await reconcileBusiness(req.params.id);
    res.json(result);
  } catch (e: any) {
    if (e.message === "business_not_found") return res.status(404).json({ error: "not_found" });
    throw e;
  }
});

// === Phase 4: Business Intelligence ===

router.get("/insights", requireApiKey, async (req: AuthedRequest & BizRequest, res) => {
  if (!(await hasActiveConsentScope("business", req.params.id, req.client!.name, "insights"))) {
    return res.status(403).json({ error: "consent_required", required_scope: "insights" });
  }

  // Partner-facing: mask raw phone-number counterparties (PII) while leaving
  // business names intact. Internal reconciliation keeps the raw value.
  const unusual = (await getUnusualTransactions(req.params.id)).map((txn) => ({
    ...txn,
    counterparty: maskPiiCounterparty(txn.counterparty),
  }));

  res.json({
    overdue_invoices: await getOverdueInvoices(req.params.id),
    cash_flow_forecast: await getCashFlowForecast(req.params.id),
    unusual_transactions: unusual,
    customer_concentration: await getCustomerConcentration(req.params.id),
  });
});

// === Phase 5: Query Layer ===
// POST /v1/businesses/:id/ask {"question": "which invoices are overdue?"}
// Same consent gate — this exposes the same sensitive business data as
// /insights and /financial-profile, just through a natural-language door.
const askSchema = z.object({ question: z.string().min(3) });

router.post("/ask", requireApiKey, async (req: AuthedRequest & BizRequest, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  // The `query` scope buys the natural-language interface only. The data an
  // answer exposes is gated by the scope that governs that capability, so a
  // narrow "query" grant cannot read a financial profile or trust score.
  if (!(await hasActiveConsentScope("business", req.params.id, req.client!.name, "query"))) {
    return res.status(403).json({ error: "consent_required", required_scope: "query" });
  }

  const intent = resolveIntent(parsed.data.question);
  if (intent) {
    const allowed = await hasActiveConsentScope("business", req.params.id, req.client!.name, intent.requiredScope);
    if (!allowed) {
      return res.status(403).json({
        error: "consent_required",
        required_scope: intent.requiredScope,
        matched_intent: intent.intent,
      });
    }
  }

  try {
    const result = await answerQuestion(req.params.id, parsed.data.question);
    res.json(result);
  } catch (e: any) {
    if (e.message === "business_not_found") return res.status(404).json({ error: "not_found" });
    throw e;
  }
});

export default router;
