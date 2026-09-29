import { Request, Response, NextFunction } from "express";

/**
 * Fixed-window rate limiter, in-memory. Good enough for a single-instance
 * MVP; swap for a Redis-backed limiter before running multiple instances
 * behind a load balancer (in-memory state won't be shared across them).
 *
 * Keys by API key when present, otherwise by IP — so an unauthenticated
 * caller can't dodge the limit by omitting a key.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-api-key") || req.ip || "unknown";
  const now = Date.now();

  if (now - lastCleanup >= WINDOW_MS) {
    for (const [bucketKey, value] of buckets) {
      if (now - value.windowStart >= WINDOW_MS) buckets.delete(bucketKey);
    }
    lastCleanup = now;
  }

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  bucket.count++;

  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - bucket.count);
  const resetAt = Math.ceil((bucket.windowStart + WINDOW_MS) / 1000);
  res.setHeader("RateLimit-Limit", String(MAX_REQUESTS_PER_WINDOW));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(resetAt));

  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({ error: "rate_limited", retry_after_seconds: retryAfterSec });
  }

  next();
}
