import {connected} from './operations/connected-routes';
import {appRoutes} from './apps/routes';
import {business} from './operations/business-routes';
import {finance} from './finance/routes';
// First import on purpose: src/config.ts loads a local .env before ./db is
// imported below, and the DB adapter snapshots DATABASE_URL at import time.
import { config } from "./config";
import { trust } from './trust/routes';
import {marketplace} from './marketplace/routes';
import {neonAuthURL} from './platform/neon-auth';
import {developerRequestLog} from './platform/request-logs';
import { auth, sameOrigin } from './platform/auth';
import { platform } from './platform/routes';
import { operations } from './operations/routes';
import express from "express";
import path from "node:path";
import { dbGet, isPostgres } from "./db";
import businessRoutes from "./routes/businesses";
import consentRoutes from "./routes/consents";
import personRoutes from "./routes/persons";
import clientRoutes from "./routes/clients";
import businessDataRoutes from "./routes/businessData";
import businessOnboardingRoutes from "./routes/businessOnboarding";
import businessDashboardRoutes from "./routes/businessDashboard";
import businessDecisionRoutes from "./routes/businessDecision";
import receivablesRoutes from "./routes/receivables";
import businessLinksRoutes from "./routes/businessLinks";
import orbitRoutes from "./routes/orbit";
import businessPaymentsRoutes from "./routes/businessPayments";
import webhookRoutes from "./routes/webhooks";
import sandboxRoutes from "./routes/sandbox";
import { ipRateLimit } from "./middleware/rateLimit";
import { requestContext, RequestWithContext } from "./middleware/requestContext";
import { errorEnvelope, errorHandler } from "./middleware/errorHandler";
import { logger, requestLogger } from "./logging";
import { requireGateway } from './middleware/gateway';
import { metricsMiddleware, renderMetrics } from "./metrics";
import { requireAdmin } from "./middleware/adminAuth";

/** Readiness must answer quickly; a hung DB check is itself "not ready". */
const READINESS_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    if (typeof timer.unref === "function") timer.unref();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Builds the Express app without binding a port, so tests can drive the
 * real HTTP stack (routing, auth middleware, consent gating, status
 * codes) in-process instead of shelling out to curl against a live
 * server. index.ts owns migrate() + listen() + shutdown; this file owns wiring.
 */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Behind a proxy/LB, req.ip is the proxy address unless the proxy depth is
  // configured — which would collapse every caller into one rate-limit bucket.
  if (config.trustProxy !== undefined) app.set("trust proxy", config.trustProxy);

  app.use(requestContext);
  // Normalises every 4xx/5xx body to {error, message, request_id, ...}.
  // Must precede the rate limiter so 429s carry the same envelope.
  app.use(errorEnvelope);
  app.use(requireGateway);
  app.use(metricsMiddleware);
  app.use(requestLogger);
  // Limit before parsing: an unauthenticated flood should be rejected without
  // paying for JSON parsing (and its 1 MB body allowance).
  app.use(ipRateLimit);
  app.use(express.json({ limit: "1mb", verify: (req,_res,body) => { if(req.url?.startsWith('/api/v1/callbacks/'))(req as any).rawBody = body.toString("utf8"); } }));
  app.use('/api/auth', sameOrigin, auth);
  app.use(developerRequestLog);
  app.use('/api/v1',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.use('/api/v1', sameOrigin, connected);
  app.use('/api/v1', sameOrigin, appRoutes);
  app.use('/api/v1', sameOrigin, business);
  app.use('/api/v1', sameOrigin, finance);
  app.use('/api/v1', sameOrigin, platform);
  app.use('/api/v1',sameOrigin,marketplace);
  app.use('/api/v1', sameOrigin, operations);
  app.use('/api/v1',sameOrigin,trust);
  app.get('/api/openapi.json', (_req,res) => res.sendFile('platform-openapi.json',{root:process.cwd()}));

  // Liveness: process-only, deliberately does NOT touch the database, so a
  // slow DB cannot cause an orchestrator to kill a healthy process.
  app.get("/v1/health", (_req, res) =>
    res.json({ status: "ok" })
  );

  // Readiness: can this instance actually serve requests? Runs a cheap
  // `SELECT 1` with a short timeout; 503 tells the load balancer to drain it.
  app.get("/v1/readiness", async (_req, res) => {
    const dbEngine = isPostgres ? "postgres" : "sqlite";
    try {
      await withTimeout(dbGet("SELECT 1 AS ok"), READINESS_TIMEOUT_MS, "database readiness check");
      res.json({ status: "ok" });
    } catch (err) {
      logger.warn("readiness_failed", {
        checks: { database: "error" },
        db_engine: dbEngine,
        message: err instanceof Error ? err.message : String(err),
      });
      res.status(503).json({ status: "error" });
    }
  });

  // Prometheus-style metrics (admin-only: route mix and latency are
  // operationally sensitive). Per-instance and resets on restart.
  app.get("/v1/metrics", requireAdmin, (_req, res) => {
    res.type("text/plain; version=0.0.4").send(renderMetrics());
  });

  // Local, dependency-free business-track UI (owner dashboard + lender card).
  // Served from the API origin so browser calls need no CORS configuration.
  // This is a local demo surface; it does not bypass API auth or consent.
  app.use("/dashboard", express.static(path.join(process.cwd(), "dashboard"), {
    index: "index.html",
    setHeaders(res) {
      // This HTML console needs same-origin assets; API responses retain default-src 'none'.
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    },
  }));

  app.use("/v1/businesses", businessRoutes);
  app.use("/v1/businesses/:id", businessDataRoutes);
  app.use("/v1/businesses/:id", businessOnboardingRoutes);
  app.use("/v1/businesses/:id", businessDashboardRoutes);
  app.use("/v1/businesses/:id", businessDecisionRoutes);
  app.use("/v1/businesses/:id", receivablesRoutes);
  app.use("/v1/businesses/:id", businessLinksRoutes);
  app.use("/v1/businesses/:id", businessPaymentsRoutes);
  app.use("/v1/orbit", orbitRoutes);
  app.use("/v1/persons", personRoutes);
  app.use("/v1/consents", consentRoutes);
  app.use("/v1/clients", clientRoutes);
  app.use("/v1/webhooks", webhookRoutes);
  app.use("/v1/sandbox", sandboxRoutes);

  app.use((req,res,next) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/v1/')) {
      const authOrigin=neonAuthURL()?new URL(neonAuthURL()!).origin:'';
      res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self' ${authOrigin}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`);
    }
    next();
  });
  app.use(express.static(path.join(process.cwd(), 'website/dist')));
  app.get(['/get-started','/sign-up/{*path}','/login','/forgot-password','/auth/callback'],(_req,res)=>res.sendFile('index.html',{root:path.join(process.cwd(),'website/dist')}));
  app.get(['/learn','/learn/{*path}','/demo','/verify-credential','/trust/{*path}','/passport/{*path}','/app','/app/{*path}','/checkout/{*path}','/buyer/{*path}','/signin','/signup','/recover','/reset','/verify','/products/{*path}','/solutions/{*path}','/developers','/docs','/sandbox','/security','/about','/contact','/support','/pricing','/privacy','/terms'], (_req,res) => res.sendFile('index.html',{root:path.join(process.cwd(),'website/dist')}));
  app.use((req: RequestWithContext, res) => res.status(404).json({ error: "not_found", path: req.originalUrl }));

  // Terminal handler: body-parser errors become 400/413, thrown errors keep
  // their 4xx status, and 5xx responses never leak the exception message.
  app.use((err: unknown, req: RequestWithContext, res: express.Response, next: express.NextFunction) =>
    errorHandler(err, req, res, next)
  );

  return app;
}
