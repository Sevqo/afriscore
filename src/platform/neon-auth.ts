import { createRemoteJWKSet, jwtVerify } from "jose";
import { dbGet, dbRun, dbTransaction, isPostgres } from "../db/adapter";
import { randomUUID } from "node:crypto";
import { hash, now, passwordHash, secret } from "./crypto";
const rejected = () =>
  Object.assign(new Error("Managed session invalid or expired"), {
    status: 401,
  });
let cached:
  { url: string; keys: ReturnType<typeof createRemoteJWKSet> } | undefined;
export function neonAuthURL() {
  const value = process.env.NEON_AUTH_BASE_URL;
  if (!value) return null;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !url.hostname.includes(".neonauth.") ||
    !/\.(?:neon\.tech|neon\.build)$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid managed auth configuration");
  return url.href.replace(/\/$/, "");
}
export async function neonIdentity(token: string) {
  const base = neonAuthURL();
  if (!base || !isPostgres) throw rejected();
  if (!cached || cached.url !== base)
    cached = {
      url: base,
      keys: createRemoteJWKSet(new URL(base + "/.well-known/jwks.json"), {
        timeoutDuration: 5000,
      }),
    };
  let claims;
  try {
    claims = (
      await jwtVerify(token, cached.keys, {
        issuer: new URL(base).origin,
        audience: new URL(base).origin,
        algorithms: ["EdDSA"],
        maxTokenAge: "16m",
      })
    ).payload;
  } catch {
    throw rejected();
  }
  if (
    typeof claims.sub !== "string" ||
    typeof claims.email !== "string" ||
    !claims.iat ||
    !claims.exp ||
    claims.banned === true
  )
    throw rejected();
  const provider = "neon:" + new URL(base).origin;
  const managed = await dbGet(
    `SELECT m.id,m.email,m."emailVerified",m.banned,l.user_id,u.email AS app_email,u.verified AS app_verified,d.revoked_before,
      EXISTS(SELECT 1 FROM ac_revoked_access_tokens r WHERE r.token_hash=? AND r.expires_at>?) AS token_revoked
      FROM neon_auth."user" m LEFT JOIN ac_identity_links l ON l.provider=? AND l.subject=m.id::text
      LEFT JOIN ac_users u ON u.id=l.user_id LEFT JOIN ac_account_details d ON d.user_id=l.user_id WHERE m.id=?`,
    [hash(token),now(),provider,claims.sub],
  );
  if (
    !managed ||
    managed.banned || managed.token_revoked ||
    managed.email.toLowerCase() !== claims.email.toLowerCase()
  )
    throw rejected();
  let linked = managed.user_id ? {user_id:managed.user_id} : undefined;
  if (!linked)
    await dbTransaction(async () => {
      await dbGet('SELECT id FROM neon_auth."user" WHERE id=? FOR UPDATE', [
        claims.sub,
      ]);
      linked = await dbGet(
        "SELECT user_id FROM ac_identity_links WHERE provider=? AND subject=?",
        [provider, claims.sub],
      );
      if (linked) return;
      const email = managed.email.toLowerCase();
      if (await dbGet("SELECT id FROM ac_users WHERE email=?", [email]))
        throw Object.assign(
          new Error(
            "Existing identity requires explicit migration; accounts are never merged by email",
          ),
          { status: 409 },
        );
      const id = randomUUID();
      await dbRun(
        "INSERT INTO ac_users(id,email,password_hash,verified,created_at) VALUES (?,?,?,?,?)",
        [
          id,
          email,
          await passwordHash(secret()),
          managed.emailVerified ? 1 : 0,
          now(),
        ],
      );
      await dbRun("INSERT INTO ac_profiles(user_id,updated_at) VALUES (?,?)", [
        id,
        now(),
      ]);
      await dbRun(
        "INSERT INTO ac_identity_links(provider,subject,user_id) VALUES (?,?,?)",
        [provider, claims.sub, id],
      );
      linked = { user_id: id };
    });
  const details = managed.user_id ? managed : await dbGet(
    "SELECT revoked_before FROM ac_account_details WHERE user_id=?",
    [linked!.user_id],
  );
  if (
    details?.revoked_before &&
    claims.iat * 1000 <= Date.parse(details.revoked_before)
  )
    throw rejected();
  const identity=managed.user_id&&managed.app_email===managed.email.toLowerCase()&&Number(managed.app_verified)===(managed.emailVerified?1:0)
    ? {email:managed.app_email,verified:managed.app_verified}
    : await syncManagedIdentity(linked!.user_id,managed);
  return {
    id: linked!.user_id,
    email: identity.email,
    verified: identity.verified,
  };
}

/** Provider identity has already been verified against the fixed issuer and subject. */
export async function syncManagedIdentity(userId:string,managed:{email:string;emailVerified:boolean}){
  // A verified unchanged identity needs no transaction or uniqueness lock.
  // This is still a fresh database read on every request, never a cross-request
  // authorization cache; changed/contested emails take the locked path below.
  const observed=await dbGet('SELECT id,email,verified FROM ac_users WHERE id=?',[userId]);
  if(observed&&observed.email===managed.email.toLowerCase()&&Number(observed.verified)===(managed.emailVerified?1:0))return observed;
  return dbTransaction(async()=>{
    if(isPostgres&&managed.emailVerified)await dbGet('SELECT pg_advisory_xact_lock(hashtext(?))',['identity-email:'+managed.email.toLowerCase()]);
    const current=await dbGet('SELECT id,email,verified FROM ac_users WHERE id=?'+(isPostgres?' FOR UPDATE':''),[userId]);
    if(!current)throw rejected();
    // Unverified proposals never replace the last trusted email. Invalidate
    // ownership-dependent privileges until the provider verifies the proposal.
    if(!managed.emailVerified){if(Number(current.verified)!==0)await dbRun('UPDATE ac_users SET verified=0 WHERE id=?',[current.id]);return {...current,verified:0};}
    const email=managed.email.toLowerCase();
    const conflict=await dbGet('SELECT id FROM ac_users WHERE email=? AND id<>?',[email,current.id]);
    if(conflict)throw Object.assign(new Error('Verified email conflicts with an existing identity; explicit account review required'),{status:409});
    if(current.email!==email||Number(current.verified)!==1)await dbRun('UPDATE ac_users SET email=?,verified=1 WHERE id=?',[email,current.id]);
    return {...current,email,verified:1};
  });
}
