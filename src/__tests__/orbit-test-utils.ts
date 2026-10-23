import { getOrbitQueues, OrbitQueues, resetOrbitQueues } from "../orbit/queue";
import { registerWorkers } from "../orbit/workers";

/**
 * Test helpers for Orbit.
 *
 * Tests use the in-memory queue backend (no Redis required). Call
 * `drainOrbit()` after an API trigger to deterministically run the pipeline to
 * completion; it registers the workers on the same broker singleton the API
 * used, so no queued job is lost.
 */

let registered = false;

export function ensureOrbitWorkers(): OrbitQueues {
  if (process.env.REDIS_URL) {
    throw new Error("Orbit tests must run with REDIS_URL unset (in-memory backend).");
  }
  const queues = getOrbitQueues();
  if (!registered) {
    registerWorkers(queues);
    registered = true;
  }
  return queues;
}

export async function drainOrbit(): Promise<void> {
  await ensureOrbitWorkers().drain();
}

/** Fresh broker + registration. Only use before any API request in a file. */
export function resetOrbitWorkersForTests(): void {
  resetOrbitQueues();
  registered = false;
}
