import { Request, Response, NextFunction } from "express";
import { verifyApiKey } from "../services/apiClientService";
import { clientRateLimit } from "./rateLimit";

export interface AuthedRequest extends Request {
  client?: { id: string; name: string };
}

/** Requires a valid `x-api-key` header. The key itself proves who's
 *  calling; consent checks use req.client.name (server-derived) rather
 *  than any client-supplied header. The per-client rate limit is applied
 *  only once the key has been verified, so the bucket key is not
 *  attacker-controlled. */
export async function requireApiKey(req: AuthedRequest, res: Response, next: NextFunction) {
  const rawKey = req.header("x-api-key");
  if (!rawKey) return res.status(401).json({ error: "missing_api_key", detail: "Set x-api-key header" });

  const client = await verifyApiKey(rawKey);
  if (!client) return res.status(401).json({ error: "invalid_api_key" });

  req.client = { id: client.id, name: client.name };
  if (!clientRateLimit(client.id, res)) return;
  next();
}
