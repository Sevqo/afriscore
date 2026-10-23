import { Request, Response, NextFunction } from "express";

/**
 * Two-tier fixed-window rate limiting.
 *
 * - `ipRateLimit` runs on every request, before the body parser, keyed by the
 *   client IP. It is the only limiter that applies to unauthenticated traffic
 *   (including admin-token guessing and 404 floods), and IPs are not easily
 *   rotated by an attacker.
 * - `clientRateLimit` runs only AFTER an API key has been verified, keyed by
 *   the verified client id — never by the raw `x-api-key` header, which an
 *   unauthenticated caller controls and could vary per request to get a fresh
 *   bucket every time.
 *
 * The bucket map is bounded: expired buckets are swept, and a hard ceiling
 * evicts the oldest entries so a flood of distinct IPs cannot grow memory
 * without bound. State is per-process; a multi-instance deployment needs the
 * Redis-backed limiter noted in the README.
 */
const WINDOW_MS = 60_000;
export const IP_LIMIT = 600;
export const CLIENT_LIMIT = 120;
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < WINDOW_MS && buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].windowStart - b[1].windowStart);
    for (const [key] of oldest.slice(0, buckets.size - MAX_BUCKETS)) buckets.delete(key);
  }
  lastSweep = now;
}

interface Decision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

function consume(key: string, limit: number, now: number): Decision {
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }
  bucket.count++;

  const allowed = bucket.count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: Math.ceil((bucket.windowStart + WINDOW_MS) / 1000),
    retryAfterSec: Math.max(1, Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000)),
  };
}

function applyHeaders(res: Response, decision: Decision): void {
  res.setHeader("RateLimit-Limit", String(decision.limit));
  res.setHeader("RateLimit-Remaining", String(decision.remaining));
  res.setHeader("RateLimit-Reset", String(decision.resetAt));
}

/** Global per-IP limiter. Mount before body parsing. */
export function ipRateLimit(req: Request, res: Response, next: NextFunction): void {
  const decision = consume(`ip:${req.ip || "unknown"}`, IP_LIMIT, Date.now());
  applyHeaders(res, decision);
  if (!decision.allowed) {
    res.setHeader("Retry-After", String(decision.retryAfterSec));
    res.status(429).json({ error: "rate_limited", retry_after_seconds: decision.retryAfterSec });
    return;
  }
  next();
}

/**
 * Per-verified-client limiter. Called from requireApiKey after the key is
 * valid; returns false when the response has already been sent as 429.
 */
export function clientRateLimit(clientId: string, res: Response): boolean {
  const decision = consume(`client:${clientId}`, CLIENT_LIMIT, Date.now());
  applyHeaders(res, decision);
  if (!decision.allowed) {
    res.setHeader("Retry-After", String(decision.retryAfterSec));
    res.status(429).json({ error: "rate_limited", retry_after_seconds: decision.retryAfterSec });
    return false;
  }
  return true;
}

/** Test helper: clears all buckets. */
export function resetRateLimitState(): void {
  buckets.clear();
  lastSweep = Date.now();
}
