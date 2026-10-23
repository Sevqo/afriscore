import type { Request, Response } from "express";

/**
 * Shared `limit`/`offset` query parsing for list endpoints.
 *
 * Responses stay plain arrays for backwards compatibility; pagination metadata
 * travels in `X-Total-Count`, `X-Limit` and `X-Offset` headers. Limits are
 * clamped to a maximum so a caller cannot request an unbounded result set.
 */
export interface Pagination {
  limit: number;
  offset: number;
}

export function parsePagination(req: Request, options: { defaultLimit?: number; maxLimit?: number } = {}): Pagination {
  const defaultLimit = options.defaultLimit ?? 100;
  const maxLimit = options.maxLimit ?? 500;

  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);

  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}

export function setPaginationHeaders(res: Response, pagination: Pagination, total: number): void {
  res.setHeader("X-Total-Count", String(total));
  res.setHeader("X-Limit", String(pagination.limit));
  res.setHeader("X-Offset", String(pagination.offset));
}
