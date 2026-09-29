import { Router } from "express";
import { z } from "zod";
import { createApiClient, listApiClients, revokeApiClient, rotateApiClient } from "../services/apiClientService";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();
router.use(requireAdmin);

const createSchema = z.object({ name: z.string().min(2) });

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const { client, apiKey } = await createApiClient(parsed.data.name);
  res.status(201).json({ ...client, api_key: apiKey, note: "Store this key now — it will not be shown again." });
});

router.get("/", async (_req, res) => {
  res.json(await listApiClients());
});

router.post("/:id/rotate", async (req, res) => {
  const result = await rotateApiClient(req.params.id);
  if (!result) return res.status(404).json({ error: "not_found" });
  res.json({ ...result.client, api_key: result.apiKey, note: "Store this key now; the old key is invalid." });
});

router.delete("/:id", async (req, res) => {
  const client = await revokeApiClient(req.params.id);
  if (!client) return res.status(404).json({ error: "not_found" });
  res.json(client);
});

export default router;
