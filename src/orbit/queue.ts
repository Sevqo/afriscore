import crypto from "node:crypto";
import {
  DeadLetterJobPayload,
  IngestionJobPayload,
  LedgerJobPayload,
  MatchingJobPayload,
  NormalizationJobPayload,
  ORBIT_QUEUE_NAMES,
  OrbitQueueName,
  ScoringJobPayload,
} from "./types";

/**
 * Orbit queue runtime.
 *
 * Two backends behind one interface, mirroring the repo's SQLite/PostgreSQL
 * adapter philosophy:
 *  - `redis`: BullMQ queues on Redis (production). Workers are BullMQ Workers.
 *  - `memory`: an in-process broker used for local dev without Redis and for
 *    deterministic tests. Same dedupe / retry / DLQ semantics.
 *
 * Job ids are deterministic per (stage, subject, content) so an identical
 * upload is dropped as a duplicate by both backends.
 */

export const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1_000;
const DRAIN_GUARD = 10_000;

const DRAIN_ORDER: readonly OrbitQueueName[] = ["ingestion", "normalization", "ledger", "scoring", "matching", "dead-letter"];

export type SubjectType = "business" | "individual";

export interface JobContext {
  jobId: string;
  queue: OrbitQueueName;
  attempt: number;
  workflowId?: string;
  subjectType?: SubjectType;
  subjectId?: string;
}

export type Processor<T> = (payload: T, ctx: JobContext) => Promise<void>;
export type FailureHandler = (input: {
  queue: OrbitQueueName;
  payload: unknown;
  error: Error;
  attemptsMade: number;
  jobId: string;
}) => Promise<void>;

export interface EnqueueOptions {
  /** Deterministic id — re-enqueueing the same id is a no-op. */
  jobId?: string;
}

export interface OrbitQueue<T> {
  readonly name: OrbitQueueName;
  enqueue(payload: T, options?: EnqueueOptions): Promise<string>;
  register(processor: Processor<T>): void;
}

export interface OrbitQueues {
  readonly backend: "memory" | "redis";
  ingestion: OrbitQueue<IngestionJobPayload>;
  normalization: OrbitQueue<NormalizationJobPayload>;
  ledger: OrbitQueue<LedgerJobPayload>;
  scoring: OrbitQueue<ScoringJobPayload>;
  matching: OrbitQueue<MatchingJobPayload>;
  deadLetter: OrbitQueue<DeadLetterJobPayload>;
  setFailureHandler(handler: FailureHandler): void;
  /** Flush all pending jobs (memory backend only; redis drains automatically). */
  drain(): Promise<void>;
  /** Start processing automatically as jobs are enqueued (memory inline workers). */
  startAutoDrain(): void;
  close(): Promise<void>;
}

export function deterministicJobId(parts: Array<string | number | null | undefined>): string {
  return crypto.createHash("sha256").update(parts.map((part) => String(part ?? "")).join("|")).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// In-memory backend
// ---------------------------------------------------------------------------

interface MemoryJobRecord {
  jobId: string;
  name: OrbitQueueName;
  payload: unknown;
  attempts: number;
  enqueuedAt: number;
}

type JobStatus = "queued" | "running" | "done" | "failed";

class MemoryOrbitQueues implements OrbitQueues {
  readonly backend = "memory" as const;
  private pending = new Map<OrbitQueueName, MemoryJobRecord[]>();
  private processors = new Map<OrbitQueueName, Processor<unknown>>();
  private status = new Map<string, JobStatus>();
  private failureHandler?: FailureHandler;
  private autoDrain = false;
  private draining = false;
  private drainRequested = false;

  constructor() {
    for (const name of ORBIT_QUEUE_NAMES) this.pending.set(name, []);
  }

  private queue(name: OrbitQueueName): OrbitQueue<unknown> {
    return {
      name,
      enqueue: async (payload: unknown, options?: EnqueueOptions) => this.enqueue(name, payload, options),
      register: (processor: Processor<unknown>) => this.processors.set(name, processor),
    } as OrbitQueue<unknown>;
  }

  readonly ingestion = this.queue("ingestion") as unknown as OrbitQueue<IngestionJobPayload>;
  readonly normalization = this.queue("normalization") as unknown as OrbitQueue<NormalizationJobPayload>;
  readonly ledger = this.queue("ledger") as unknown as OrbitQueue<LedgerJobPayload>;
  readonly scoring = this.queue("scoring") as unknown as OrbitQueue<ScoringJobPayload>;
  readonly matching = this.queue("matching") as unknown as OrbitQueue<MatchingJobPayload>;
  readonly deadLetter = this.queue("dead-letter") as unknown as OrbitQueue<DeadLetterJobPayload>;

  setFailureHandler(handler: FailureHandler): void {
    this.failureHandler = handler;
  }

  startAutoDrain(): void {
    this.autoDrain = true;
    this.requestDrain();
  }

  async close(): Promise<void> {
    this.autoDrain = false;
    this.pending.clear();
    this.processors.clear();
    this.status.clear();
  }

  private async enqueue(name: OrbitQueueName, payload: unknown, options?: EnqueueOptions): Promise<string> {
    const jobId = options?.jobId ?? crypto.randomUUID();
    if (this.status.has(jobId)) return jobId; // drop duplicate

    this.status.set(jobId, "queued");
    this.pending.get(name)!.push({ jobId, name, payload, attempts: 0, enqueuedAt: Date.now() });

    if (this.autoDrain) this.requestDrain();
    return jobId;
  }

  private requestDrain(): void {
    if (this.draining) {
      this.drainRequested = true;
      return;
    }
    this.draining = true;
    void this.runAutoDrain().finally(() => {
      this.draining = false;
      if (this.drainRequested) {
        this.drainRequested = false;
        this.requestDrain();
      }
    });
  }

  private async runAutoDrain(): Promise<void> {
    // Loop until there is nothing left; jobs enqueued by processors are picked
    // up on the next iteration.
    while (this.hasPending()) {
      await this.drain();
    }
  }

  private hasPending(): boolean {
    for (const name of DRAIN_ORDER) if ((this.pending.get(name)?.length ?? 0) > 0) return true;
    return false;
  }

  private takeNext(): MemoryJobRecord | undefined {
    for (const name of DRAIN_ORDER) {
      const queue = this.pending.get(name)!;
      if (queue.length > 0) return queue.shift();
    }
    return undefined;
  }

  /**
   * Deterministically processes every pending job, following cross-queue
   * hand-offs, retrying failures up to MAX_ATTEMPTS. Used by tests and by the
   * inline dev worker.
   */
  async drain(): Promise<void> {
    for (let guard = 0; guard < DRAIN_GUARD; guard++) {
      const job = this.takeNext();
      if (!job) return;

      const processor = this.processors.get(job.name);
      if (!processor) {
        // No worker is registered for this queue: leave it queued so a later
        // drain (after workers are registered) can process it.
        this.pending.get(job.name)!.unshift(job);
        return;
      }

      this.status.set(job.jobId, "running");
      try {
        await processor(job.payload, {
          jobId: job.jobId,
          queue: job.name,
          attempt: job.attempts + 1,
          workflowId: (job.payload as { workflowId?: string }).workflowId,
          subjectId: (job.payload as { subjectId?: string }).subjectId,
          subjectType: (job.payload as { subjectType?: SubjectType }).subjectType,
        });
        this.status.set(job.jobId, "done");
      } catch (rawError) {
        const error = rawError instanceof Error ? rawError : new Error(String(rawError));
        job.attempts += 1;
        if (job.attempts >= MAX_ATTEMPTS) {
          this.status.set(job.jobId, "failed");
          await this.notifyFailure(job.name, job.payload, error, job.attempts, job.jobId);
        } else {
          this.status.set(job.jobId, "queued");
          this.pending.get(job.name)!.push(job);
        }
      }
    }
    throw new Error("orbit_drain_guard_exceeded");
  }

  private async notifyFailure(
    queue: OrbitQueueName,
    payload: unknown,
    error: Error,
    attemptsMade: number,
    jobId: string
  ): Promise<void> {
    if (!this.failureHandler) return;
    await this.failureHandler({ queue, payload, error, attemptsMade, jobId });
  }
}

// ---------------------------------------------------------------------------
// Redis / BullMQ backend
// ---------------------------------------------------------------------------

interface RedisQueueHandle {
  enqueue(payload: unknown, options?: EnqueueOptions): Promise<string>;
  register(processor: Processor<unknown>): void;
  close(): Promise<void>;
}

class RedisOrbitQueues implements OrbitQueues {
  readonly backend = "redis" as const;
  private handles = new Map<OrbitQueueName, RedisQueueHandle>();
  private workers: Array<{ close(): Promise<void> }> = [];
  private failureHandler?: FailureHandler;

  constructor(private readonly redisUrl: string) {
    for (const name of ORBIT_QUEUE_NAMES) this.handles.set(name, this.createHandle(name));
  }

  private connection() {
    // Lazy require so memory-only runs never load these modules.
    const IORedis = require("ioredis");
    return new IORedis(this.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
  }

  private createHandle(name: OrbitQueueName): RedisQueueHandle {
    const { Queue, Worker } = require("bullmq");
    const connection = this.connection();
    const queue = new Queue(name, { connection });

    return {
      enqueue: async (payload: unknown, options?: EnqueueOptions) => {
        const jobId = options?.jobId ?? crypto.randomUUID();
        await queue.add(name, payload, {
          jobId,
          attempts: MAX_ATTEMPTS,
          backoff: { type: "exponential", delay: BACKOFF_BASE_MS },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        });
        return jobId;
      },
      register: (processor: Processor<unknown>) => {
        const worker = new Worker(
          name,
          async (job: { id?: string; data: unknown; attemptsMade: number }) =>
            processor(job.data, {
              jobId: String(job.id),
              queue: name,
              attempt: job.attemptsMade + 1,
              workflowId: (job.data as { workflowId?: string }).workflowId,
              subjectId: (job.data as { subjectId?: string }).subjectId,
              subjectType: (job.data as { subjectType?: SubjectType }).subjectType,
            }),
          { connection: this.connection(), concurrency: 4 }
        );

        worker.on("failed", (job: { id?: string; data: unknown; attemptsMade: number } | undefined, err: Error) => {
          if (!job) return;
          if (job.attemptsMade < MAX_ATTEMPTS) return; // BullMQ will retry
          void this.failureHandler?.({
            queue: name,
            payload: job.data,
            error: err,
            attemptsMade: job.attemptsMade,
            jobId: String(job.id),
          });
        });

        this.workers.push(worker as unknown as { close(): Promise<void> });
      },
      close: async () => {
        await queue.close();
        connection.disconnect();
      },
    };
  }

  private asQueue<T>(name: OrbitQueueName): OrbitQueue<T> {
    const handle = this.handles.get(name)!;
    return {
      name,
      enqueue: (payload: T, options?: EnqueueOptions) => handle.enqueue(payload, options),
      register: (processor: Processor<T>) => handle.register(processor as Processor<unknown>),
    };
  }

  readonly ingestion = this.asQueue<IngestionJobPayload>("ingestion");
  readonly normalization = this.asQueue<NormalizationJobPayload>("normalization");
  readonly ledger = this.asQueue<LedgerJobPayload>("ledger");
  readonly scoring = this.asQueue<ScoringJobPayload>("scoring");
  readonly matching = this.asQueue<MatchingJobPayload>("matching");
  readonly deadLetter = this.asQueue<DeadLetterJobPayload>("dead-letter");

  setFailureHandler(handler: FailureHandler): void {
    this.failureHandler = handler;
  }

  startAutoDrain(): void {
    /* BullMQ Workers process continuously; nothing to start. */
  }

  async drain(): Promise<void> {
    /* Redis is processed by workers; callers waiting on results use a poll. */
  }

  async close(): Promise<void> {
    for (const worker of this.workers) await worker.close();
    for (const handle of this.handles.values()) await handle.close();
  }
}

// ---------------------------------------------------------------------------
// Factory + process-level singleton
// ---------------------------------------------------------------------------

export function createOrbitQueues(options: { redisUrl?: string } = {}): OrbitQueues {
  return options.redisUrl ? new RedisOrbitQueues(options.redisUrl) : new MemoryOrbitQueues();
}

let singleton: OrbitQueues | null = null;

/** The queues used by API request handlers and inline workers. */
export function getOrbitQueues(): OrbitQueues {
  if (!singleton) singleton = createOrbitQueues({ redisUrl: process.env.REDIS_URL });
  return singleton;
}

/** Test/restart helper: drop the singleton so a fresh broker is created. */
export function resetOrbitQueues(): void {
  singleton = null;
}
