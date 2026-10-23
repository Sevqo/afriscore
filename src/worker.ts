// First import on purpose: config loads a local .env before the DB adapter
// snapshots DATABASE_URL at import time (same convention as src/index.ts).
import { config } from "./config";
import { migrate } from "./db";
import { logger } from "./logging";
import { startRedisWorkers } from "./orbit/runtime";

/**
 * Standalone Orbit worker entry point (production / Redis).
 *
 *   REDIS_URL=redis://127.0.0.1:6379 npm run worker
 *
 * Without REDIS_URL the API runs in-process workers instead (see src/index.ts).
 * The workers are structured as a separate process so they can be scaled
 * independently of the API.
 */
async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.error("orbit_worker_requires_redis", {
      message: "REDIS_URL is not set. Start the API without REDIS_URL for in-process dev workers, or set REDIS_URL for the standalone worker.",
    });
    process.exit(1);
  }

  await migrate();

  const queues = startRedisWorkers(redisUrl);
  logger.info("orbit_worker_started", { backend: queues.backend, node_env: config.nodeEnv });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("orbit_worker_stopping", { signal });
    try {
      await queues.close();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("orbit_worker_unhandled_rejection", { message: reason instanceof Error ? reason.message : String(reason) });
  });
}

main().catch((err) => {
  logger.error("orbit_worker_start_failed", { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
