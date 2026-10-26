import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { dbAll, dbGet, dbRun, dbTransaction } from '../db';
import { hash, now, passwordHash, passwordMatches, secret } from './crypto';
import { permitted } from './domain';

export const auth = Router();
export const fail = (status: number, message: string): never => {
  throw Object.assign(new Error(message), { status });
};
export const route =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof ZodError) {
        res
          .status(400)
          .json({ error: 'validation_error', issues: error.issues });
        return;
      }
      if ((error as any).status) {
        res.status((error as any).status).json({
          error: 'request_rejected',
          message: (error as Error).message,
        });
        return;
      }
      next(error);
    }
  };
export async function audit(
  org: string,
  actor: string,
  action: string,
  resource?: string,
) {
  await dbRun(
    'INSERT INTO ac_audit(id,org_id,actor,action,resource_id,created_at) VALUES (?,?,?,?,?,?)',
    [randomUUID(), org, actor, action, resource || null, now()],
  );
}
function sessionCookieName() {
  return process.env.AFRICORE_DEMO_SESSION === 'true' &&
    process.env.NODE_ENV !== 'production'
    ? 'ac_demo_session'
    : 'ac_session';
}
function sessionToken(req: Request) {
  return new RegExp(
    '(?:^|;\\s*)' + sessionCookieName() + '=([a-f0-9]{64})(?:;|$)',
  ).exec(req.headers.cookie || '')?.[1];
}
export async function user(req: Request) {
  const token = sessionToken(req);
  if (!token) fail(401, 'Sign in required');
  const row = await dbGet(
    'SELECT u.id,u.email,u.verified FROM ac_users u JOIN ac_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',
    [hash(token!), now()],
  );
  return row || fail(401, 'Session expired');
}
export interface Access {
  actor: string;
  org: string;
  environment: string;
  role: string;
  api: boolean;
}
export async function access(
  req: Request,
  capability = 'read',
): Promise<Access> {
  const org = String(req.params.org),
    environment = String(req.headers['x-environment'] || 'sandbox');
  if (!['sandbox', 'production'].includes(environment))
    fail(400, 'Invalid environment');
  const key = req.headers.authorization?.match(
    /^Bearer (ac_[a-f0-9]{64})$/,
  )?.[1];
  if (key) {
    const credential = await dbGet(
      'SELECT * FROM ac_credentials WHERE key_hash=? AND org_id=? AND environment=? AND revoked_at IS NULL',
      [hash(key), org, environment],
    );
    if (!credential || !JSON.parse(credential.scopes).includes(capability))
      fail(403, 'Credential scope or organization denied');
    await audit(org, credential.id, 'api.' + capability, req.path);
    return { actor: credential.id, org, environment, role: 'api', api: true };
  }
  const u = await user(req);
  const m = await dbGet(
    'SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',
    [org, u.id],
  );
  if (!m || !permitted(m.role, capability))
    fail(403, 'Organization permission denied');
  if (environment === 'production' && !u.verified)
    fail(403, 'Verify your email before accessing production');
  return { actor: u.id, org, environment, role: m.role, api: false };
}
// Browser mutations require same origin; JSON-only writes also prevent cross-site form CSRF.
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      res.status(403).json({ error: 'cross_site_request' });
      return;
    }
    const origin = req.headers.origin;
    if (
      origin &&
      origin !==
        (process.env.AFRICORE_PUBLIC_ORIGIN ||
          `${req.protocol}://${req.get('host')}`)
    ) {
      res.status(403).json({ error: 'origin_denied' });
      return;
    }
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'json_required' });
      return;
    }
  }
  next();
}
const attempts = new Map<string, { n: number; until: number }>();
auth.use((req, res, next) => {
  const key = req.ip || 'unknown',
    stamp = Date.now();
  for (const [k, v] of attempts) if (v.until < stamp) attempts.delete(k);
  const bucket = attempts.get(key) || { n: 0, until: stamp + 900000 };
  bucket.n++;
  attempts.set(key, bucket);
  if (bucket.n > 40 || attempts.size > 10000) {
    res.status(429).json({ error: 'auth_rate_limit' });
    return;
  }
  next();
});
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(200),
});
async function tokenFor(userId: string, purpose: string) {
  const value = secret();
  await dbRun(
    'INSERT INTO ac_tokens(token_hash,user_id,purpose,expires_at) VALUES (?,?,?,?)',
    [
      hash(value),
      userId,
      purpose,
      new Date(Date.now() + 3600000).toISOString(),
    ],
  );
  return value;
}
async function session(res: Response, id: string) {
  const value = secret();
  await dbRun(
    'INSERT INTO ac_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)',
    [hash(value), id, new Date(Date.now() + 86400000).toISOString()],
  );
  res.setHeader(
    'Set-Cookie',
    `${sessionCookieName()}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  );
  res.setHeader('Cache-Control', 'no-store');
}
auth.post(
  '/signup',
  route(async (req, res) => {
    // Delivery integration is intentionally gated; production cannot create stranded accounts.
    if (process.env.NODE_ENV === 'production')
      fail(503, 'Self-service registration awaits configured email delivery');
    const data = credentials.parse(req.body),
      id = randomUUID();
    await dbTransaction(async () => {
      if (await dbGet('SELECT id FROM ac_users WHERE email=?', [data.email]))
        fail(409, 'Account already exists');
      await dbRun(
        'INSERT INTO ac_users(id,email,password_hash,created_at) VALUES (?,?,?,?)',
        [id, data.email, await passwordHash(data.password), now()],
      );
    });
    const verification_token = await tokenFor(id, 'verify');
    await session(res, id);
    res.status(201).json({
      id,
      email: data.email,
      verified: false,
      delivery: 'development-only',
      verification_token,
    });
  }),
);
auth.post(
  '/signin',
  route(async (req, res) => {
    const data = credentials.parse(req.body),
      u = await dbGet('SELECT * FROM ac_users WHERE email=?', [data.email]);
    // Equal expensive derivation for unknown users reduces account timing disclosure.
    const fallback = '00000000000000000000000000000000:' + '0'.repeat(128);
    if (
      !(await passwordMatches(data.password, u?.password_hash || fallback)) ||
      !u
    )
      fail(401, 'Invalid email or password');
    await session(res, u.id);
    res.json({ id: u.id, email: u.email, verified: !!u.verified });
  }),
);
auth.post(
  '/signout',
  route(async (req, res) => {
    const token = sessionToken(req);
    if (token)
      await dbRun('DELETE FROM ac_sessions WHERE token_hash=?', [hash(token)]);
    res.setHeader(
      'Set-Cookie',
      sessionCookieName() + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
    );
    res.json({ signed_out: true });
  }),
);
auth.get(
  '/me',
  route(async (req, res) => res.json(await user(req))),
);
auth.post(
  '/recover',
  route(async (req, res) => {
    if (process.env.NODE_ENV === 'production')
      fail(503, 'Password recovery awaits configured email delivery');
    const email = z
      .string()
      .email()
      .transform((v) => v.toLowerCase())
      .parse(req.body.email);
    const u = await dbGet('SELECT id FROM ac_users WHERE email=?', [email]);
    const recovery_token = u ? await tokenFor(u.id, 'recover') : secret();
    res.json({
      message: 'If the account exists, a recovery was prepared.',
      delivery: 'development-only',
      recovery_token,
    });
  }),
);
auth.post(
  '/verify',
  route(async (req, res) => {
    const token = z.string().length(64).parse(req.body.token);
    await dbTransaction(async () => {
      const row = await dbGet(
        "SELECT * FROM ac_tokens WHERE token_hash=? AND purpose='verify' AND expires_at>?",
        [hash(token), now()],
      );
      if (!row) fail(400, 'Invalid or expired verification');
      const consumed = await dbRun('DELETE FROM ac_tokens WHERE token_hash=?', [
        hash(token),
      ]);
      if (!consumed.changes) fail(400, 'Token already used');
      await dbRun('UPDATE ac_users SET verified=1 WHERE id=?', [row.user_id]);
    });
    res.json({ verified: true });
  }),
);
auth.post(
  '/reset',
  route(async (req, res) => {
    const data = z
      .object({
        token: z.string().length(64),
        password: z.string().min(12).max(200),
      })
      .parse(req.body);
    await dbTransaction(async () => {
      const row = await dbGet(
        "SELECT * FROM ac_tokens WHERE token_hash=? AND purpose='recover' AND expires_at>?",
        [hash(data.token), now()],
      );
      if (!row) fail(400, 'Invalid or expired recovery');
      const consumed = await dbRun('DELETE FROM ac_tokens WHERE token_hash=?', [
        hash(data.token),
      ]);
      if (!consumed.changes) fail(400, 'Token already used');
      await dbRun('UPDATE ac_users SET password_hash=? WHERE id=?', [
        await passwordHash(data.password),
        row.user_id,
      ]);
      await dbRun('DELETE FROM ac_sessions WHERE user_id=?', [row.user_id]);
      await dbRun(
        "DELETE FROM ac_tokens WHERE user_id=? AND purpose='recover'",
        [row.user_id],
      );
    });
    res.json({ reset: true });
  }),
);
