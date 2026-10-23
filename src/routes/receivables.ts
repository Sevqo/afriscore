import { Router, Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/adminAuth";
import { sendError } from "../middleware/errorHandler";
import { getInvoice, listInvoicePayments, sendInvoice } from "../services/invoiceService";
import {
  ReceivablesError,
  autoMatchPayments,
  getReceivablesSummary,
  getReviewQueue,
  recordPayment,
} from "../services/receivablesService";

/**
 * Receivables control-plane endpoints (admin token): invoice lifecycle,
 * recorded payments, automatic matching, DSO summary and the unmatched-payment
 * review queue. Partner-facing consumption happens through the dashboard and
 * decision card, which are consent-gated.
 */
const router = Router({ mergeParams: true });
router.use(requireAdmin);

type BusinessParams = { id: string; invoiceId: string };
type BusinessRequest = Request<BusinessParams>;

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["mpesa", "bank", "manual", "cash"]),
  reference: z.string().max(120).optional(),
  transaction_id: z.string().uuid().optional(),
  paid_at: z.string().datetime({ offset: true }).optional(),
});

const paymentErrors: Record<string, number> = {
  invoice_not_found: 404,
  transaction_not_found: 404,
  transaction_already_matched: 409,
  payment_already_recorded: 409,
  amount_exceeds_balance: 400,
  invoice_not_draft: 409,
  invalid_payment: 400,
};

function handleReceivablesError(res: Parameters<typeof sendError>[0], err: unknown): boolean {
  if (err instanceof ReceivablesError) {
    sendError(res, paymentErrors[err.code] ?? 400, err.code, { message: err.message });
    return true;
  }
  return false;
}

router.post("/invoices/:invoiceId/payments", async (req: BusinessRequest, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_input", { details: parsed.error.flatten() });

  try {
    const result = await recordPayment(String(req.params.id), String(req.params.invoiceId), parsed.data);
    res.status(201).json({
      invoice: result.invoice,
      payment: result.payment,
      fully_paid: result.fully_paid,
    });
  } catch (err) {
    if (handleReceivablesError(res, err)) return;
    throw err;
  }
});

router.post("/invoices/:invoiceId/send", async (req: BusinessRequest, res) => {
  try {
    const invoice = await sendInvoice(String(req.params.invoiceId));
    if (invoice.business_id !== String(req.params.id)) return sendError(res, 404, "not_found");
    res.json(invoice);
  } catch (err) {
    if (err instanceof Error && err.message === "invoice_not_found") return sendError(res, 404, "not_found");
    if (err instanceof Error && err.message === "invoice_not_draft") {
      return sendError(res, 409, "invoice_not_draft", { message: "Only draft invoices can be sent." });
    }
    throw err;
  }
});

router.get("/invoices/:invoiceId", async (req: BusinessRequest, res) => {
  const invoice = await getInvoice(String(req.params.invoiceId));
  if (!invoice || invoice.business_id !== String(req.params.id)) return sendError(res, 404, "not_found");
  res.json({ invoice, payments: await listInvoicePayments(invoice.id) });
});

router.post("/receivables/match", async (req: BusinessRequest, res) => {
  try {
    res.json(await autoMatchPayments(String(req.params.id)));
  } catch (err) {
    if (err instanceof Error && err.message === "business_not_found") return sendError(res, 404, "not_found");
    throw err;
  }
});

router.get("/receivables/review-queue", async (req: BusinessRequest, res) => {
  res.json(await getReviewQueue(String(req.params.id)));
});

router.get("/receivables/summary", async (req: BusinessRequest, res) => {
  try {
    const receivables = await getReceivablesSummary(String(req.params.id));
    res.json({
      receivables,
      note:
        receivables === null
          ? "No invoices exist for this business; DSO and receivables metrics are not fabricated."
          : "DSO is computed from issued invoices and recorded payments.",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "business_not_found") return sendError(res, 404, "not_found");
    throw err;
  }
});

export default router;
