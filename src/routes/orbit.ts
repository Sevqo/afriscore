import { Router, Request } from "express";
import { requireAdmin } from "../middleware/adminAuth";
import { sendError } from "../middleware/errorHandler";
import { getWorkflowView, listWorkflowsForSubject } from "../orbit/orbitService";

/**
 * Orbit observability (admin): current workflow state, transition history and
 * any dead-letter errors for one workflow, plus a subject-scoped list.
 */
const router = Router();
router.use(requireAdmin);

router.get("/workflows", async (req: Request, res) => {
  const subjectType = req.query.subject_type ? String(req.query.subject_type) : undefined;
  const subjectId = req.query.subject_id ? String(req.query.subject_id) : undefined;
  if (!subjectType || !subjectId) {
    return sendError(res, 400, "missing_params", { message: "subject_type and subject_id are required" });
  }
  if (subjectType !== "business" && subjectType !== "individual") {
    return sendError(res, 400, "invalid_input", { message: "subject_type must be business or individual" });
  }
  res.json(await listWorkflowsForSubject(subjectType, subjectId));
});

router.get("/workflows/:id", async (req: Request, res) => {
  const view = await getWorkflowView(String(req.params.id));
  if (!view) return sendError(res, 404, "not_found");
  res.json(view);
});

export default router;
