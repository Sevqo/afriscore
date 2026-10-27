import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { dbGet, dbRun } from "../db/adapter";
import { hash, now } from "./crypto";
/** Persist only scoped credential request metadata, never bodies, keys or queries. */
export function developerRequestLog(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const org = /^\/api\/v1\/organizations\/([a-f0-9-]{36})(?:\/|$)/i.exec(
    req.path,
  )?.[1];
  const key = /^Bearer (ac_[a-f0-9]{64})$/.exec(
    req.headers.authorization || "",
  )?.[1];
  const environment = String(req.headers["x-environment"] || "sandbox");
  if (org && key && ["sandbox", "production"].includes(environment)) {
    const route = req.path.replace(/[a-f0-9-]{36}/gi, ":id").slice(0, 500);
    res.once("finish", () => {
      void (async () => {
        const c = await dbGet(
          "SELECT id FROM ac_credentials WHERE key_hash=? AND org_id=? AND environment=?",
          [hash(key), org, environment],
        );
        if (c)
          await dbRun(
            "INSERT INTO ac_api_request_logs(id,org_id,environment,credential_id,method,route,status_code,created_at) VALUES (?,?,?,?,?,?,?,?)",
            [
              randomUUID(),
              org,
              environment,
              c.id,
              req.method,
              route,
              res.statusCode,
              now(),
            ],
          );
      })().catch(() => {
        /* Observability cannot turn a completed response into a failure. */
      });
    });
  }
  next();
}
