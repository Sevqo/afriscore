import { Router } from "express";
import { z } from "zod";
import { subscribe, listSubscriptions, listEvents, countEvents, isAllowedWebhookTarget, isValidEventPattern, rotateSubscriptionSecret } from "../services/webhookService";
import { requireApiKey, AuthedRequest } from "../middleware/apiKeyAuth";
import { requireAdmin } from "../middleware/adminAuth";
import { parsePagination, setPaginationHeaders } from "./pagination";

const router = Router();

const subscribeSchema = z.object({
  event_pattern: z.string().min(3),
  target_url: z.string().url(),
  environment: z.enum(["live", "sandbox"]).optional(),
});

router.post("/", requireApiKey, async (req: AuthedRequest, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  if (!isValidEventPattern(parsed.data.event_pattern)) {
    return res.status(400).json({ error: "invalid_event_pattern", detail: "Use a known event type or a group prefix such as transaction.*" });
  }
  if (!isAllowedWebhookTarget(parsed.data.target_url)) return res.status(400).json({ error: "target_not_allowed" });

  const sub = await subscribe({ client: req.client!, ...parsed.data });
  res.status(201).json({ ...sub, note: "Store the secret now — verify the x-africore-signature header on deliveries. It will not be shown again." });
});

router.get("/", requireApiKey, async (req: AuthedRequest, res) => {
  const subs = (await listSubscriptions({ clientId: req.client!.id })).map(({ secret, ...rest }) => rest);
  res.json(subs);
});

router.post("/:id/rotate", requireApiKey, async (req: AuthedRequest, res) => {
  const rotated = await rotateSubscriptionSecret(String(req.params.id), req.client!.id);
  if (!rotated) return res.status(404).json({ error: "not_found" });
  res.json({ ...rotated, note: "Store the new secret now — the previous secret stops validating immediately." });
});

router.get("/events", requireAdmin, async (req, res) => {
  const eventType = req.query.event_type ? String(req.query.event_type) : undefined;
  const pagination = parsePagination(req, { defaultLimit: 50, maxLimit: 500 });
  const [events, total] = await Promise.all([
    listEvents(eventType, pagination.limit, pagination.offset),
    countEvents(eventType),
  ]);
  setPaginationHeaders(res, pagination, total);
  res.json(events);
});

export default router;
