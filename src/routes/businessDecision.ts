import { Router, Request } from "express";
import { requireApiKey, AuthedRequest } from "../middleware/apiKeyAuth";
import { hasActiveConsentScope } from "../services/consentService";
import { issueBusinessDecisionCard } from "../services/decisionCardService";

/**
 * Lender-facing decision card. Issuing a card is an auditable event (metrics
 * and the decision are appended to the subject's ledger), so it is a POST
 * rather than a GET.
 */
const router = Router({ mergeParams: true });

type BusinessParams = { id: string };
type BusinessRequest = Request<BusinessParams>;

router.post("/decision-card", requireApiKey, async (req: AuthedRequest & BusinessRequest, res) => {
  const businessId = String(req.params.id);
  if (!(await hasActiveConsentScope("business", businessId, req.client!.name, "business_profile"))) {
    return res.status(403).json({ error: "consent_required", required_scope: "business_profile" });
  }

  try {
    const card = await issueBusinessDecisionCard(businessId);
    res.status(201).json(card);
  } catch (err) {
    if (err instanceof Error && err.message === "business_not_found") return res.status(404).json({ error: "not_found" });
    throw err;
  }
});

export default router;
