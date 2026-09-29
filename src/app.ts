import express from "express";
import { isPostgres } from "./db";
import businessRoutes from "./routes/businesses";
import consentRoutes from "./routes/consents";
import personRoutes from "./routes/persons";
import clientRoutes from "./routes/clients";
import businessDataRoutes from "./routes/businessData";
import webhookRoutes from "./routes/webhooks";
import sandboxRoutes from "./routes/sandbox";
import { rateLimit } from "./middleware/rateLimit";
import { requestContext, RequestWithContext } from "./middleware/requestContext";

/**
 * Builds the Express app without binding a port, so tests can drive the
 * real HTTP stack (routing, auth middleware, consent gating, status
 * codes) in-process instead of shelling out to curl against a live
 * server. index.ts owns migrate() + listen(); this file owns wiring.
 */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit);

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(JSON.stringify({
        level: "info",
        event: "http_request",
        request_id: (req as RequestWithContext).requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - start,
      }));
    });
    next();
  });

  app.get("/v1/health", (_req, res) =>
    res.json({ status: "ok", service: "afriscore", db_engine: isPostgres ? "postgres" : "sqlite" })
  );

  app.use("/v1/businesses", businessRoutes);
  app.use("/v1/businesses/:id", businessDataRoutes);
  app.use("/v1/persons", personRoutes);
  app.use("/v1/consents", consentRoutes);
  app.use("/v1/clients", clientRoutes);
  app.use("/v1/webhooks", webhookRoutes);
  app.use("/v1/sandbox", sandboxRoutes);

  app.use((req, res) => res.status(404).json({ error: "not_found", path: req.originalUrl }));

  app.use((err: Error, req: RequestWithContext, res: express.Response, _next: express.NextFunction) => {
    console.error(JSON.stringify({ level: "error", event: "request_failed", request_id: req.requestId, message: err.message }));
    res.status(500).json({ error: "internal_error", request_id: req.requestId });
  });

  return app;
}
