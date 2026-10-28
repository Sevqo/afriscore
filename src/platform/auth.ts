import {workspaceRouteAllowed} from './workspace-capabilities';
import {withServiceRequest,checkServiceAccess,marketplaceRequest} from '../marketplace/request';
import {catalogFor} from '../marketplace/engine';
import { newPassword } from './password-policy';
import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { dbAll, dbGet, dbRun, dbTransaction } from '../db';
import { hash, now, passwordHash, passwordMatches, secret } from './crypto';
import { permitted } from './domain';
import { createWorkspace, resolveWorkspace, selectWorkspace } from './accounts';
import {neonAuthURL,neonIdentity} from './neon-auth';

export const auth = Router();
auth.get('/config',(_req,res)=>{res.setHeader('Cache-Control','no-store');res.json({provider:neonAuthURL()?'neon':'legacy',auth_url:neonAuthURL()});});
auth.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(neonAuthURL() && ['/signup','/signin','/verify','/recover','/reset'].includes(req.path)) {
    res.status(409).json({message:'Use the configured managed authentication service'}); return;
  }
  next();
});
export const fail = (status: number, message: string): never => {
  throw Object.assign(new Error(message), { status });
};
export const route =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await withServiceRequest(req,res,()=>fn(req,res));
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
async function resolveUser(req: Request) {
  if(neonAuthURL()) {
    const bearer=req.headers.authorization?.match(/^Bearer (eyJ[A-Za-z0-9_.-]+)$/)?.[1];
    if(!bearer) fail(401,'Managed sign in required');
    return neonIdentity(bearer!);
  }
  const token = sessionToken(req);
  if (!token) fail(401, 'Sign in required');
  const row = await dbGet(
    'SELECT u.id,u.email,u.verified FROM ac_users u JOIN ac_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',
    [hash(token!), now()],
  );
  return row || fail(401, 'Session expired');
}
export async function user(req:Request){
  const context=marketplaceRequest.getStore();
  if(!context)return resolveUser(req);
  return context.identity||=(resolveUser(req));
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
  const workspace = await dbGet('SELECT kind,status FROM ac_workspaces WHERE id=?',[org]);
  if(workspace?.status && workspace.status!=='active') fail(403,'Workspace inactive');
  const kind=workspace?.kind||'business';
  if(!workspaceRouteAllowed(req.method,req.route?.path,kind,String(req.params.kind||'')))fail(403,'This route is not available to this workspace type');
  if(kind==='developer'&&environment!=='sandbox')fail(403,'Developer production access requires separate review');
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
    const a={ actor: credential.id, org, environment, role: 'api', api: true };
    await checkServiceAccess(req,a);return a;
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
  const a={ actor: u.id, org, environment, role: m.role, api: false };
  await checkServiceAccess(req,a);return a;
}
// Browser mutations require same origin; JSON-only writes also prevent cross-site form CSRF.
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      res.status(403).json({ error: 'cross_site_request' });
      return;
    }
    const origin = req.headers.origin;
    const developmentOrigins = process.env.NODE_ENV === 'development' ? (process.env.AFRICORE_DEV_ORIGINS || '').split(',').filter(Boolean) : [];
    if (
      origin && !developmentOrigins.includes(origin) &&
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
  // Credential guessing protection must not lock out ordinary signed-in navigation.
  if(req.method!=='POST'||!['/signup','/signin','/verify','/recover','/reset'].includes(req.path)){next();return;}
  const key = req.ip || 'unknown',
    stamp = Date.now();
  for (const [k, v] of attempts) if (v.until < stamp) attempts.delete(k);
  const bucket = attempts.get(key) || { n: 0, until: stamp + 900000 };
  bucket.n++;
  attempts.set(key, bucket);
  if (bucket.n > 40 || attempts.size > 10000) {
    res.setHeader('Retry-After',String(Math.max(1,Math.ceil((bucket.until-stamp)/1000))));
    res.status(429).json({ error: 'auth_rate_limit',message:'Too many authentication attempts. Please wait before trying again.' });
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
  password: z.string().min(1).max(400),
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
    const data = credentials.extend({password:newPassword}).parse(req.body),
      id = randomUUID();
    await dbTransaction(async () => {
      if (await dbGet('SELECT id FROM ac_users WHERE email=?', [data.email]))
        fail(409, 'Account already exists');
      await dbRun(
        'INSERT INTO ac_users(id,email,password_hash,created_at) VALUES (?,?,?,?)',
        [id, data.email, await passwordHash(data.password), now()],
      );
      await dbRun('INSERT INTO ac_profiles(user_id,updated_at) VALUES (?,?)', [id, now()]);
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

auth.get('/account', route(async (req, res) => {
  const started=performance.now();
  const u = await user(req);
  const identityAt=performance.now(),resolved=await resolveWorkspace(u.id),workspaceAt=performance.now();
  const service_catalog=resolved.workspace?await catalogFor({org:resolved.workspace.id,actor:u.id,environment:'sandbox',role:resolved.workspace.role,api:false}):null;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Server-Timing',`identity;dur=${(identityAt-started).toFixed(1)},workspaces;dur=${(workspaceAt-identityAt).toFixed(1)},services;dur=${(performance.now()-workspaceAt).toFixed(1)}`);
  res.json({ user: u, ...resolved,service_catalog });
}));

auth.get('/sessions',route(async(req,res)=>{
  const u=await user(req),managed=neonAuthURL();
  if(managed) {
    const rows=await dbAll(`SELECT s.id,s."createdAt" AS created_at,s."updatedAt" AS updated_at,s."expiresAt" AS expires_at,s."userAgent" AS user_agent FROM neon_auth.session s JOIN ac_identity_links l ON s."userId"::text=l.subject WHERE l.user_id=? AND l.provider=? AND s."expiresAt">CURRENT_TIMESTAMP ORDER BY s."createdAt" DESC LIMIT 100`,[u.id,'neon:'+new URL(managed).origin]);
    res.json({data:rows,provider:'neon'});
  } else {
    const rows=await dbAll('SELECT token_hash,expires_at FROM ac_sessions WHERE user_id=? AND expires_at>?',[u.id,now()]);
    res.json({data:rows.map((r:any,index:number)=>({id:'session-'+index,expires_at:r.expires_at,current:r.token_hash===hash(sessionToken(req)||'')})),provider:'legacy'});
  }
}));

auth.post('/workspaces',route(async(req,res)=>{
  const u=await user(req);
  const w=await createWorkspace(u.id,req.body);
  res.status(w.existing?200:201).json({...w,account:await resolveWorkspace(u.id)});
}));

auth.patch('/account',route(async(req,res)=>{
  const u=await user(req);
  const d=z.object({display_name:z.string().trim().min(1).max(100),currency:z.enum(['KES','USD','EUR','GBP','UGX','TZS','RWF']),timezone:z.string().max(100).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone'),primary_experience:z.enum(['personal','business','developer'])}).strict().parse(req.body);
  await dbRun(`UPDATE ac_profiles SET display_name=?,currency=?,timezone=?,primary_experience=?,updated_at=? WHERE user_id=?`,[d.display_name,d.currency,d.timezone,d.primary_experience,now(),u.id]);
  res.json(await resolveWorkspace(u.id));
}));

auth.post('/signout-all',route(async(req,res)=>{
  const u=await user(req);
  await dbTransaction(async()=>{
    await dbRun('DELETE FROM ac_sessions WHERE user_id=?',[u.id]);
    await dbRun('INSERT INTO ac_account_details(user_id,revoked_before) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET revoked_before=excluded.revoked_before',[u.id,now()]);
  });
  res.json({signed_out:true});
}));

auth.post('/account/deletion-request',route(async(req,res)=>{
  const u=await user(req);
  await dbRun('INSERT INTO ac_account_details(user_id,deletion_requested_at) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET deletion_requested_at=excluded.deletion_requested_at',[u.id,now()]);
  res.json({requested:true,message:'Deletion review requested. Financial and signed history is retained pending review.'});
}));

auth.post('/account/workspace', route(async (req, res) => {
  const u = await user(req);
  const { workspace_id } = z.object({workspace_id:z.string().uuid()}).parse(req.body);
  if (!await selectWorkspace(u.id,workspace_id)) fail(403,'Workspace membership required');
  res.setHeader('Cache-Control','no-store');
  res.json(await resolveWorkspace(u.id));
}));
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
    if(neonAuthURL()) {
      await user(req);
      const bearer=req.headers.authorization!.slice(7);
      await dbRun('DELETE FROM ac_revoked_access_tokens WHERE expires_at<?',[now()]);
      await dbRun('INSERT INTO ac_revoked_access_tokens(token_hash,expires_at) VALUES (?,?) ON CONFLICT(token_hash) DO NOTHING',[hash(bearer),new Date(Date.now()+960000).toISOString()]);
    }
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
        password: newPassword,
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
