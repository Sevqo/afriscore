import { Router } from "express";
import { z } from "zod";
import { CONSENT_SCOPES, grantConsent, revokeConsent, listConsents } from "../services/consentService";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();
router.use(requireAdmin);

const grantSchema = z.object({
  subject_type: z.enum(["business", "person"]),
  subject_id: z.string().uuid(),
  grantee: z.string().min(1),
  purpose: z.string().min(1),
  scope: z.array(z.enum(CONSENT_SCOPES)).min(1),
  expires_at: z
    .string()
    .datetime({ offset: true })
    .refine((value) => new Date(value).getTime() > Date.now(), { message: "expires_at must be in the future" })
    .optional(),
});

router.post("/", async (req, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  try {
    const consent = await grantConsent(parsed.data);
    res.status(201).json(consent);
  } catch (e: any) {
    if (e.message === "invalid_expires_at") return res.status(400).json({ error: "invalid_input", detail: "expires_at must be in the future" });
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  const consent = await revokeConsent(req.params.id);
  if (!consent) return res.status(404).json({ error: "not_found" });
  res.json(consent);
});

router.get("/", async (req, res) => {
  const { subject_type, subject_id } = req.query;
  if (!subject_type || !subject_id) {
    return res.status(400).json({ error: "missing_params", detail: "subject_type and subject_id are required" });
  }
  res.json(await listConsents(String(subject_type), String(subject_id)));
});

export default router;
