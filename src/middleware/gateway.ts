import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request, Response, NextFunction } from 'express';

/** Gateway authentication precedes all trusted metadata and application auth. */
export function requireGateway(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.AFRICORE_GATEWAY_SECRET;
  if (req.method === 'GET' && ['/v1/health', '/v1/readiness'].includes(req.path)) return next();
  if (!expected && process.env.NODE_ENV !== 'production') return next();
  const supplied = Buffer.from(req.header('x-africore-gateway-secret') || '');
  const keys=[expected,process.env.AFRICORE_GATEWAY_SECRET_PREVIOUS].filter((value):value is string=>!!value&&value.length>=32);
  let accepted=false;
  for(const key of keys){const wanted=Buffer.from(key);if(supplied.length===wanted.length)accepted=timingSafeEqual(supplied,wanted)||accepted;}
  if (!expected || expected.length<32 || !accepted) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(403).json({ error: 'gateway_required' });
  }
  // Prevent downstream diagnostics from retaining this transport credential.
  delete req.headers['x-africore-gateway-secret'];
  // Render may append proxy hops. Only the authenticated edge's overwritten
  // single-address header establishes rate-limit identity, never arbitrary XFF.
  const client=req.header('x-africore-client-ip');
  delete req.headers['x-africore-client-ip'];
  if(client){if(!isIP(client))return res.status(403).json({error:'invalid_gateway_metadata'});Object.defineProperty(req,'ip',{value:client,configurable:true});}
  next();
}
