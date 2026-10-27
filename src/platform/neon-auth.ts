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
  if (
    await dbGet(
      "SELECT token_hash FROM ac_revoked_access_tokens WHERE token_hash=? AND expires_at>?",
      [hash(token), now()],
    )
  )
    throw rejected();
  const managed = await dbGet(
    'SELECT id,email,"emailVerified",banned FROM neon_auth."user" WHERE id=?',
    [claims.sub],
  );
  if (
    !managed ||
    managed.banned ||
    managed.email.toLowerCase() !== claims.email.toLowerCase()
  )
    throw rejected();
  const provider = "neon:" + new URL(base).origin;
  let linked = await dbGet(
    "SELECT user_id FROM ac_identity_links WHERE provider=? AND subject=?",
    [provider, claims.sub],
  );
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
  const details = await dbGet(
    "SELECT revoked_before FROM ac_account_details WHERE user_id=?",
    [linked!.user_id],
  );
  if (
    details?.revoked_before &&
    claims.iat * 1000 <= Date.parse(details.revoked_before)
  )
    throw rejected();
  await dbRun("UPDATE ac_users SET verified=?,email=? WHERE id=?", [
    managed.emailVerified ? 1 : 0,
    managed.email.toLowerCase(),
    linked!.user_id,
  ]);
  return {
    id: linked!.user_id,
    email: managed.email.toLowerCase(),
    verified: managed.emailVerified ? 1 : 0,
  };
}
