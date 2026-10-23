import { Router, Request } from "express";
import { requireApiKey, AuthedRequest } from "../middleware/apiKeyAuth";
import { hasActiveConsentScope } from "../services/consentService";
import { getBusinessDashboard } from "../services/businessMetricsService";

/**
 * Partner/lender-facing business analytics. Gated exactly like the other
 * business data endpoints: a valid API key proves the caller, and an active
 * `business_profile` consent grant proves it may see this subject.
 */
const router = Router({ mergeParams: true });

type BusinessParams = { id: string };
type BusinessRequest = Request<BusinessParams>;

router.get("/business-profile", requireApiKey, async (req: AuthedRequest & BusinessRequest, res) => {
  const businessId = String(req.params.id);
  if (!(await hasActiveConsentScope("business", businessId, req.client!.name, "business_profile"))) {
    return res.status(403).json({ error: "consent_required", required_scope: "business_profile" });
  }

  try {
    const dashboard = await getBusinessDashboard(businessId);
    res.json(dashboard);
  } catch (err) {
    if (err instanceof Error && err.message === "business_not_found") return res.status(404).json({ error: "not_found" });
    throw err;
  }
});

export default router;
