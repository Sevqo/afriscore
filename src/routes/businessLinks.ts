import { Router, Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/adminAuth";
import { sendError } from "../middleware/errorHandler";
import {
  LinkError,
  getLinkedProfilesView,
  linkProfiles,
  listLinksForBusiness,
  unlinkProfiles,
} from "../services/linkService";

/**
 * Explicit dual-mode profile linking (admin control plane). Linking is the
 * only way a person and a business become associated; by default they stay
 * isolated. It never merges ledgers, scores or transaction streams.
 */
const router = Router({ mergeParams: true });
router.use(requireAdmin);

type BusinessParams = { id: string; personId: string };
type BusinessRequest = Request<BusinessParams>;

const linkSchema = z.object({ person_id: z.string().uuid(), requested_by: z.string().max(120).optional() });

router.post("/links", async (req: BusinessRequest, res) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_input", { details: parsed.error.flatten() });

  try {
    const result = await linkProfiles(String(req.params.id), parsed.data.person_id, parsed.data.requested_by);
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    if (err instanceof LinkError) {
      return sendError(res, 404, err.code === "person_not_found" ? "person_not_found" : "not_found", { message: err.message });
    }
    throw err;
  }
});

router.delete("/links/:personId", async (req: BusinessRequest, res) => {
  try {
    await unlinkProfiles(String(req.params.id), String(req.params.personId));
    res.json({ unlinked: true });
  } catch (err) {
    if (err instanceof LinkError) return sendError(res, 404, "link_not_found", { message: err.message });
    throw err;
  }
});

router.get("/links", async (req: BusinessRequest, res) => {
  res.json(await listLinksForBusiness(String(req.params.id)));
});

router.get("/linked-profiles", async (req: BusinessRequest, res) => {
  const view = await getLinkedProfilesView(String(req.params.id));
  if (!view) return sendError(res, 404, "not_found");
  res.json(view);
});

export default router;
