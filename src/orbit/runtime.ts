import { OrbitQueues, createOrbitQueues, getOrbitQueues } from "./queue";
import { registerWorkers } from "./workers";

/**
 * Inline dev/test workers: when REDIS_URL is unset the API process also
 * processes its own (in-memory) queues. With Redis configured, workers run in
 * the standalone `worker.ts` entry point instead.
 */
export function startInlineWorkers(): OrbitQueues {
  const queues = getOrbitQueues();
  if (queues.backend !== "memory") return queues;
  registerWorkers(queues);
  queues.startAutoDrain();
  return queues;
}

/** Starts a Redis-backed worker process (used by worker.ts). */
export function startRedisWorkers(redisUrl: string): OrbitQueues {
  const queues = createOrbitQueues({ redisUrl });
  registerWorkers(queues);
  return queues;
}
