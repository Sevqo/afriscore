import { Router } from "express";
import { z } from "zod";
import { createPerson, getPerson, runPersonVerification, getPersonTrustRecord } from "../services/personService";
import { hasActiveConsentScope } from "../services/consentService";
import { verifyChainIntegrity } from "../services/ledgerService";
import { requireApiKey, AuthedRequest } from "../middleware/apiKeyAuth";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

const createSchema = z.object({
  full_name: z.string().min(2),
  national_id: z.string().min(4).optional(),
  phone: z.string().min(7).optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const person = await createPerson(parsed.data);
  res.status(201).json(person);
});

router.get("/:id", requireAdmin, async (req, res) => {
  const person = await getPerson(String(req.params.id));
  if (!person) return res.status(404).json({ error: "not_found" });
  res.json(person);
});

router.post("/:id/verify", requireAdmin, async (req, res) => {
  try {
    const result = await runPersonVerification(String(req.params.id));
    res.json(result);
  } catch (e: any) {
    if (e.message === "person_not_found") return res.status(404).json({ error: "not_found" });
    throw e;
  }
});

router.get("/:id/trust-record", requireApiKey, async (req: AuthedRequest, res) => {
  const personId = String(req.params.id);
  if (!(await hasActiveConsentScope("person", personId, req.client!.name, "trust_score"))) {
    return res.status(403).json({ error: "consent_required", required_scope: "trust_score" });
  }

  const record = await getPersonTrustRecord(personId);
  if (!record) return res.status(404).json({ error: "not_found" });
  res.json(record);
});

router.get("/:id/ledger/verify", requireAdmin, async (req, res) => {
  const result = await verifyChainIntegrity("person", String(req.params.id));
  res.json(result);
});

export default router;
