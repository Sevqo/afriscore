import type { NextFunction, Request, Response } from "express";
import { logger } from "../logging";
import type { RequestWithContext } from "./requestContext";

/**
 * Consistent error envelope.
 *
 * Chosen shape (flat, backwards compatible with the existing API):
 *
 *   {
 *     "error": "invalid_input",           // stable machine-readable code (string)
 *     "message": "legal_name is required", // human-readable explanation
 *     "details": { ... },                  // optional, endpoint-specific
 *     "required_scope": "trust_score",     // optional, endpoint-specific
 *     "request_id": "…"                    // correlation id, also an x-request-id header
 *   }
 *
 * The top-level `error` stays a string so every existing client/test assertion
 * (`body.error === "invalid_input"`) keeps working; `message`, `request_id`
 * and (where already present) `details`/`required_scope`/`detail` are additive.
 * The nested-object variant `{error: {code, message, request_id}}` was
 * rejected because it would break the current contract.
 *
 * Routes and middleware have not been edited, so the envelope is applied
 * centrally by `errorEnvelope`, which wraps `res.json` for 4xx/5xx responses
 * whose body carries a top-level string `error`. That also covers errors sent
 * by middleware mounted before the JSON body parser (e.g. 429 rate limits).
 */

const DEFAULT_MESSAGES: Record<string, string> = {
  invalid_input: "Request body failed validation.",
  invalid_json: "Request body is not valid JSON.",
  payload_too_large: "Request body is too large.",
  unsupported_media_type: "Unsupported request content type.",
  not_found: "Resource not found.",
  missing_api_key: "An x-api-key header is required.",
  invalid_api_key: "The API key is invalid or revoked.",
  admin_auth_required: "A valid x-admin-token header is required.",
  admin_auth_not_configured: "Admin authentication is not configured on this server.",
  consent_required: "Active consent granting the required scope is required.",
  account_already_connected: "This provider account is already connected to the business.",
  account_disconnected: "Reconnect the account before syncing.",
  invalid_event_pattern: "Unknown webhook event pattern.",
  target_not_allowed: "Webhook target URL is not allowed.",
  rate_limited: "Too many requests; retry later.",
  missing_params: "Required parameters are missing.",
  internal_error: "Internal server error.",
};

/** Human-readable message for a code, optionally derived from a route's `detail`. */
export function messageForCode(code: string, detail?: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  return DEFAULT_MESSAGES[code] ?? "Request failed.";
}

function isErrorBody(body: unknown): body is Record<string, unknown> & { error: string } {
  return (
    !!body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as Record<string, unknown>).error === "string"
  );
}

/**
 * Middleware that normalises every 4xx/5xx `res.json` body to the envelope
 * above. Mount it after `requestContext` (it needs `req.requestId`) and before
 * any middleware that can answer with an error, e.g. the rate limiter.
 */
export function errorEnvelope(req: RequestWithContext, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = ((body?: unknown) => {
    if (isErrorBody(body) && res.statusCode >= 400) {
      const { error, message, ...rest } = body;
      return originalJson({
        error,
        message: typeof message === "string" && message ? message : messageForCode(error, rest.detail),
        request_id: rest.request_id ?? req.requestId,
        ...rest,
      });
    }
    return originalJson(body);
  }) as Response["json"];

  next();
}

/** Convenience helper for new code paths that want to emit the envelope explicitly. */
export function sendError(
  res: Response,
  status: number,
  code: string,
  options: { message?: string; details?: unknown; extra?: Record<string, unknown> } = {}
): Response {
  const requestId = (res.req as RequestWithContext | undefined)?.requestId;
  return res.status(status).json({
    error: code,
    message: options.message ?? messageForCode(code),
    request_id: requestId,
    ...(options.details !== undefined ? { details: options.details } : {}),
    ...options.extra,
  });
}

const STATUS_CODES: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  406: "not_acceptable",
  408: "request_timeout",
  409: "conflict",
  413: "payload_too_large",
  415: "unsupported_media_type",
  422: "unprocessable_entity",
  429: "rate_limited",
};

/**
 * Terminal Express error handler. Maps body-parser / HTTP errors to 4xx codes
 * instead of leaking them as 500s, never returns internal error messages for
 * 5xx, and always includes the request id.
 */
export function errorHandler(err: unknown, req: RequestWithContext, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const candidate = (err ?? {}) as {
    type?: string;
    status?: number;
    statusCode?: number;
    name?: string;
    message?: string;
    stack?: string;
  };

  let status = 500;
  let code = "internal_error";
  let message: string | undefined;

  switch (candidate.type) {
    case "entity.parse.failed":
      status = 400;
      code = "invalid_json";
      break;
    case "entity.too.large":
      status = 413;
      code = "payload_too_large";
      break;
    case "encoding.unsupported":
    case "charset.unsupported":
      status = 415;
      code = "unsupported_media_type";
      break;
    case "request.aborted":
      status = 400;
      code = "request_aborted";
      break;
    default: {
      const httpStatus =
        typeof candidate.status === "number" ? candidate.status : typeof candidate.statusCode === "number" ? candidate.statusCode : undefined;
      if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
        status = httpStatus;
        code = STATUS_CODES[httpStatus] ?? "request_error";
      }
      break;
    }
  }

  const logFields = {
    request_id: req.requestId,
    method: req.method,
    path: req.path.replace(/((?:checkout|buyer|share|presentations)\/)[a-f0-9]{64}/g, '$1[redacted]'),
    status,
    error_code: code,
    error_name: candidate.name,
    // Log the message so operators can debug; the response body never does for 5xx.
    message: candidate.message,
    stack: status >= 500 ? candidate.stack : undefined,
  };
  if (status >= 500) logger.error("request_failed", logFields);
  else logger.warn("request_rejected", logFields);

  // Never leak an exception message on a 5xx; 4xx bodies use the mapped message.
  message = status >= 500 ? undefined : messageForCode(code);

  res.status(status).json({ error: code, message });
}
