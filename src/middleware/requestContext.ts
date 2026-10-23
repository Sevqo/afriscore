import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { config } from "../config";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
const HSTS_VALUE = "max-age=31536000; includeSubDomains";

export interface RequestWithContext extends Request {
  requestId?: string;
}

/**
 * Security headers + request id, mounted first.
 *
 * - Accepts a well-formed `x-request-id` from the caller (so a gateway can
 *   propagate one) and always echoes it back; otherwise generates a UUID.
 * - HSTS is only meaningful over TLS, but sending it from an HTTPS deployment
 *   is important; emit it in production or when the request itself arrived
 *   over TLS (directly or via `x-forwarded-proto` + TRUST_PROXY).
 * - Responses to state-changing requests are marked `Cache-Control: no-store`
 *   so credentials/secrets returned by POST endpoints (API keys, webhook
 *   secrets) are never cached by proxies. Routes that return a one-time
 *   secret on a GET-like endpoint can opt in with the exported `noStore`
 *   helper (routes are owned by another workstream, so this file only
 *   provides the helper and the safe default).
 */
export function requestContext(req: RequestWithContext, res: Response, next: NextFunction) {
  const supplied = req.header("x-request-id");
  const requestId = supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");

  // One-time secrets are issued by POST /v1/clients/:id/rotate and
  // POST /v1/webhooks today; never let an intermediary cache a write response.
  if (config.isProduction || !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.setHeader("cache-control", "no-store");
  }

  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (config.isProduction || req.secure || forwardedProto === "https") {
    res.setHeader("strict-transport-security", HSTS_VALUE);
  }

  next();
}

/**
 * Explicit opt-in for any endpoint that returns a one-time secret (e.g. API
 * keys, webhook signing secrets). Mount it on the route, e.g.
 * `router.post("/", requireApiKey, noStore, handler)`, so no proxy/CDN can
 * replay a cached response. It is exported here because route files are owned
 * by another workstream; wiring it into the two routes is a follow-up.
 */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("cache-control", "no-store");
  res.setHeader("pragma", "no-cache");
  next();
}
