// IMPORTANT: keep `./config` as the very first import. It loads a local .env
// file as a side effect, and the DB adapter (imported below via ./db) reads
// process.env.DATABASE_URL at import time to choose SQLite vs PostgreSQL.
import { config, validateConfig } from "./config";
import {processTrust} from './trust/worker';
import { deliverWebhooks } from './platform/payments';
import {deliverLegacyWebhooks} from './services/webhookService';
import { processOperations } from './operations/worker';
import type { Server } from "node:http";
import { migrate, isPostgres, closeDb, dbAll } from "./db";
import { prepareDatabase } from './deployment-database';
import { createApp } from "./app";
import { logger } from "./logging";
import { startInlineWorkers } from "./orbit/runtime";
import { getOrbitQueues } from "./orbit/queue";

/**
 * Boot sequence:
 *   1. validate configuration (fail fast with actionable errors, warn on
 *      insecure development defaults)
 *   2. run migrations (ordering preserved from Phase 1)
 *   3. build the app and listen
 *   4. install graceful shutdown + process-level error handlers
 */
async function main(): Promise<void> {
  const { errors, warnings } = validateConfig();

  for (const warning of warnings) logger.warn("config_warning", { message: warning });
  if (errors.length > 0) {
    for (const error of errors) logger.error("config_error", { message: error });
    throw new Error(`Invalid configuration (${errors.length} problem${errors.length === 1 ? "" : "s"}); refusing to start.`);
  }

  if (process.env.NODE_ENV === 'production' && (!process.env.AFRICORE_ENCRYPTION_KEY || process.env.AFRICORE_ENCRYPTION_KEY.length < 32)) throw new Error('AFRICORE_ENCRYPTION_KEY must be 32+ characters');
  if (process.env.NODE_ENV === 'production' && !process.env.AFRICORE_PUBLIC_ORIGIN?.startsWith('https://')) throw new Error('AFRICORE_PUBLIC_ORIGIN must be an HTTPS origin');
  await prepareDatabase(process.env.AFRICORE_MIGRATIONS_MODE, {migrate, isPostgres, dbAll});
  const webhookTimer = setInterval(() => { Promise.all([deliverWebhooks(),deliverLegacyWebhooks()]).catch(()=>logger.error('webhook_worker_failed',{code:'delivery_failed'})); }, 10000);
  webhookTimer.unref();
  const operationsTimer=setInterval(()=>{processOperations().catch(()=>logger.error('stage2_worker_failed',{code:'execution_failed'}));},15000);
  operationsTimer.unref();
  const trustTimer=setInterval(()=>{processTrust().catch(()=>logger.error('trust_worker_failed',{code:'execution_failed'}));},15000);trustTimer.unref();

  const app = createApp();
  const server: Server = app.listen(config.port, process.env.API_BIND_HOST || "0.0.0.0", () => {
    logger.info("server_started", {
      port: config.port,
      db_engine: isPostgres ? "postgres" : "sqlite",
      node_env: config.nodeEnv,
      pid: process.pid,
      log_level: config.logLevel,
    });
  });

  server.on("error", (err: Error) => {
    logger.error("server_error", { message: err.message });
    process.exit(1);
  });

  // Orbit workers: with Redis configured they run in the standalone worker
  // process (`npm run worker`); without it the API also processes its own
  // in-memory queues so local dev works with a single command.
  if (!process.env.REDIS_URL) {
    startInlineWorkers();
    logger.info("orbit_inline_workers_started", { backend: "memory" });
  } else {
    logger.info("orbit_workers_external", { backend: "redis" });
  }

  installSignalHandlers(server);
  installProcessErrorHandlers();
}

function installSignalHandlers(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      logger.warn("shutdown_signal_ignored", { signal, reason: "already_shutting_down" });
      return;
    }
    shuttingDown = true;

    logger.info("shutdown_started", { signal, timeout_ms: config.shutdownTimeoutMs });

    // Hard deadline: never let a stuck request or DB connection keep the
    // process alive forever during a deploy/rollout.
    const forceExit = setTimeout(() => {
      logger.error("shutdown_forced", { signal, timeout_ms: config.shutdownTimeoutMs });
      process.exit(1);
    }, config.shutdownTimeoutMs);
    if (typeof forceExit.unref === "function") forceExit.unref();

    server.close(async (closeErr?: Error) => {
      if (closeErr) logger.error("shutdown_server_close_failed", { message: closeErr.message });

      try {
        await getOrbitQueues().close();
        await closeDb();
        logger.info("shutdown_complete", { signal, db_closed: true });
      } catch (dbErr) {
        logger.error("shutdown_db_close_failed", { message: dbErr instanceof Error ? dbErr.message : String(dbErr) });
        clearTimeout(forceExit);
        process.exit(1);
      }

      clearTimeout(forceExit);
      process.exit(closeErr ? 1 : 0);
    });

    // Drop keep-alive connections that are not serving a request; in-flight
    // requests still get their grace period until the timeout above.
    const closeIdle = (server as Server & { closeIdleConnections?: () => void }).closeIdleConnections;
    if (typeof closeIdle === "function") closeIdle.call(server);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

function installProcessErrorHandlers(): void {
  process.on("unhandledRejection", (reason: unknown) => {
    logger.error("unhandled_rejection", {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    // An unhandled rejection leaves the process in an unknown state; fail
    // loudly and let the orchestrator restart a clean instance.
    process.exit(1);
  });

  process.on("uncaughtException", (err: Error) => {
    logger.error("uncaught_exception", { name: err.name, message: err.message, stack: err.stack });
    process.exit(1);
  });
}

main().catch((err: unknown) => {
  logger.error("startup_failed", {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
