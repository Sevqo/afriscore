import { Router, Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/adminAuth";
import { sendError } from "../middleware/errorHandler";
import { StatementParseError } from "../services/statement/parser";
import {
  ingestStatement,
  listShortcodes,
  listStatements,
  OnboardingError,
  recordOnboardingConsent,
} from "../services/businessOnboardingService";

/**
 * Business onboarding endpoints. Mounted under /v1/businesses/:id.
 *
 * These are operator/control-plane routes (admin token) because they read raw
 * statement files; partner-facing reads of the resulting analytics live on the
 * dashboard endpoints and are consent-gated per grantee.
 */
const router = Router({ mergeParams: true });
router.use(requireAdmin);

type BusinessParams = { id: string };
type BusinessRequest = Request<BusinessParams>;

const consentSchema = z.object({
  purpose: z.string().min(1).max(120).optional(),
  expires_at: z
    .string()
    .datetime({ offset: true })
    .refine((value) => new Date(value).getTime() > Date.now(), { message: "expires_at must be in the future" })
    .optional(),
});

router.post("/onboarding/consent", async (req: BusinessRequest, res) => {
  const parsed = consentSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendError(res, 400, "invalid_input", { details: parsed.error.flatten() });

  try {
    const consent = await recordOnboardingConsent(String(req.params.id), {
      purpose: parsed.data.purpose,
      expiresAt: parsed.data.expires_at,
    });
    res.status(201).json({
      consent,
      note: "Consent recorded for business onboarding. It can be revoked with DELETE /v1/consents/{id}.",
    });
  } catch (err) {
    if (err instanceof OnboardingError && err.code === "business_not_found") {
      return sendError(res, 404, "not_found");
    }
    throw err;
  }
});

const uploadSchema = z.object({
  source_type: z.enum(["individual_mpesa", "business_till", "business_paybill", "bank"]),
  shortcode: z.string().min(2).max(32).optional(),
  file_name: z.string().min(1).max(255).optional(),
  label: z.string().min(1).max(120).optional(),
  content: z.string().min(10).max(1_000_000),
});

router.post("/statements", async (req: BusinessRequest, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_input", { details: parsed.error.flatten() });

  try {
    const result = await ingestStatement(String(req.params.id), {
      sourceType: parsed.data.source_type,
      shortcode: parsed.data.shortcode,
      fileName: parsed.data.file_name,
      label: parsed.data.label,
      content: parsed.data.content,
    });

    res.status(201).json({
      statement_id: result.statement.id,
      period_start: result.statement.period_start,
      period_end: result.statement.period_end,
      transactions_imported: result.transactionsImported,
      duplicates_skipped: result.duplicatesSkipped,
      warnings: result.warnings,
    });
  } catch (err) {
    if (err instanceof StatementParseError) {
      return sendError(res, 400, err.code, { message: err.message, details: err.details });
    }
    if (err instanceof OnboardingError) {
      if (err.code === "business_not_found") return sendError(res, 404, "not_found");
      if (err.code === "consent_required") {
        return sendError(res, 403, "consent_required", { extra: { required_scope: "statements" } });
      }
      return sendError(res, 409, err.code, { message: err.message });
    }
    throw err;
  }
});

router.get("/statements", async (req: BusinessRequest, res) => {
  res.json(await listStatements(String(req.params.id)));
});

router.get("/shortcodes", async (req: BusinessRequest, res) => {
  res.json(await listShortcodes(String(req.params.id)));
});

export default router;

