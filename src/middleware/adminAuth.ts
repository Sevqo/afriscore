import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/** Bootstrap control-plane credential. Keep it separate from partner API keys. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.AFRISCORE_ADMIN_TOKEN;
  if (!expected || expected.length < 32) {
    return res.status(503).json({ error: "admin_auth_not_configured" });
  }
  const supplied = req.header("x-admin-token") || "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "admin_auth_required" });
  }
  next();
}
