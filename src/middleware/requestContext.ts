import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export interface RequestWithContext extends Request {
  requestId?: string;
}

export function requestContext(req: RequestWithContext, res: Response, next: NextFunction) {
  const supplied = req.header("x-request-id");
  const requestId = supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  next();
}
