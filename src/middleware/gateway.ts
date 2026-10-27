import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** Optional origin lock for the Cloudflare gateway; normal tenant auth still applies. */
export function requireGateway(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.AFRICORE_GATEWAY_SECRET;
  if (!expected || (req.method === 'GET' && ['/v1/health', '/v1/readiness'].includes(req.path))) return next();
  const supplied = Buffer.from(req.header('x-africore-gateway-secret') || '');
  const wanted = Buffer.from(expected);
  if (wanted.length < 32 || supplied.length !== wanted.length || !timingSafeEqual(supplied, wanted)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(403).json({ error: 'gateway_required' });
  }
  // Prevent downstream diagnostics from retaining this transport credential.
  delete req.headers['x-africore-gateway-secret'];
  next();
}
