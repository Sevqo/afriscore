import { Router, Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/adminAuth";
import { sendError } from "../middleware/errorHandler";
import { startPaymentMatchingWorkflow } from "../orbit/orbitService";
import { OnboardingError } from "../services/businessOnboardingService";

/**
 * Simulated M-Pesa payment webhook (admin-only in this build).
 *
 * Returns 200 immediately with an Orbit workflow id; matching, DSO
 * recalculation and ledger writes happen asynchronously in the matching and
 * scoring queues.
 */
const router = Router({ mergeParams: true });

type BusinessParams = { id: string };
type BusinessRequest = Request<BusinessParams>;

const paymentSchema = z.object({
  amount: z.number().positive(),
  reference: z.string().min(1).max(120).optional(),
  counterparty: z.string().max(120).optional(),
  transaction_id: z.string().uuid().optional(),
});

router.post("/payments/simulate", requireAdmin, async (req: BusinessRequest, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_input", { details: parsed.error.flatten() });

  try {
    const result = await startPaymentMatchingWorkflow(String(req.params.id), {
      amount: parsed.data.amount,
      reference: parsed.data.reference,
      counterparty: parsed.data.counterparty,
      transactionId: parsed.data.transaction_id,
    });

    res.status(200).json({
      workflow_id: result.workflowId,
      job_id: result.jobId,
      duplicate: result.duplicate,
      workflow_url: `/v1/orbit/workflows/${result.workflowId}`,
    });
  } catch (err) {
    if (err instanceof OnboardingError && err.code === "business_not_found") return sendError(res, 404, "not_found");
    throw err;
  }
});

export default router;
