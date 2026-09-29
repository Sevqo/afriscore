import { Router } from "express";
import { z } from "zod";
import { createBusiness, getBusiness, runVerificationChecks, getTrustRecord } from "../services/businessService";
import { hasActiveConsentScope } from "../services/consentService";
import { verifyChainIntegrity } from "../services/ledgerService";
import { requireApiKey, AuthedRequest } from "../middleware/apiKeyAuth";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

const createSchema = z.object({
  legal_name: z.string().min(2),
  trading_name: z.string().optional(),
  registration_number: z.string().optional(),
  kra_pin: z.string().optional(),
  industry: z.string().optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const business = await createBusiness(parsed.data);
  res.status(201).json(business);
});

router.get("/:id", requireAdmin, async (req, res) => {
  const business = await getBusiness(String(req.params.id));
  if (!business) return res.status(404).json({ error: "not_found" });
  res.json(business);
});

router.post("/:id/verify", requireAdmin, async (req, res) => {
  try {
    const result = await runVerificationChecks(String(req.params.id));
    res.json(result);
  } catch (e: any) {
    if (e.message === "business_not_found") return res.status(404).json({ error: "not_found" });
    throw e;
  }
});

router.get("/:id/trust-record", requireApiKey, async (req: AuthedRequest, res) => {
  const businessId = String(req.params.id);
  if (!(await hasActiveConsentScope("business", businessId, req.client!.name, "trust_score"))) {
    return res.status(403).json({ error: "consent_required", required_scope: "trust_score" });
  }

  const record = await getTrustRecord(businessId);
  if (!record) return res.status(404).json({ error: "not_found" });
  res.json(record);
});

router.get("/:id/ledger/verify", requireAdmin, async (req, res) => {
  const result = await verifyChainIntegrity("business", String(req.params.id));
  res.json(result);
});

export default router;
