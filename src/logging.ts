import type { NextFunction, Request, Response } from "express";
import { config, LogLevelName } from "./config";
import type { RequestWithContext } from "./middleware/requestContext";

/**
 * Structured JSON logger.
 *
 * Every line is one JSON object: `{timestamp, level, event, ...fields}` with an
 * ISO-8601 timestamp so log aggregators can order events across instances.
 * `LOG_LEVEL` (debug|info|warn|error, default info) filters at emit time.
 *
 * Safety rules:
 * - Never pass request/response bodies, headers, tokens, API keys or webhook
 *   secrets in `fields`; log identifiers and metadata only.
 * - `info`/`debug` go to stdout, `warn`/`error` to stderr, so a log shipper can
 *   treat them differently. Levels call `console.*` dynamically, which keeps
 *   the test suite's console.log silencing effective.
 */

export type LogFields = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function isLevelEnabled(level: LogLevelName): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[config.logLevel];
}

function serialise(level: LogLevelName, event: string, fields: LogFields): string {
  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  return JSON.stringify(record, (_key, value) => {
    if (value instanceof Error) {
      return { name: value.name, message: value.message };
    }
    return value;
  });
}

function emit(level: LogLevelName, event: string, fields: LogFields = {}): void {
  if (!isLevelEnabled(level)) return;
  const line = serialise(level, event, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/**
 * Per-request access log. Runs early (so 4xx/429 responses are logged too) and
 * records on `finish`, when `req.client` has been populated by the auth
 * middleware — that is how `client_id` is attached without trusting a header.
 * Query strings and bodies are deliberately excluded from `path`/log fields.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const context = req as RequestWithContext & { client?: { id: string } };
    logger.info("http_request", {
      request_id: context.requestId,
      method: req.method,
      // req.path excludes the query string; req.originalUrl would log it.
      path: req.path.replace(/((?:checkout|buyer|share|presentations)\/)[a-f0-9]{64}/g, '$1[redacted]'),
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 1000) / 1000,
      client_id: context.client?.id,
      ip: req.ip,
      user_agent: req.header("user-agent")?.slice(0, 200),
    });
  });

  next();
}
