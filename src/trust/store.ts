import { randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db';
import { Access, fail, audit, user } from '../platform/auth';
import { seal, unseal, now } from '../platform/crypto';
export const flags = () => ({
  passport_beta: process.env.AFRICORE_PASSPORT_BETA !== 'false',
  credential_issuance: process.env.AFRICORE_CREDENTIAL_ISSUANCE !== 'false',
  external_issuers: false,
  trust_sharing: process.env.AFRICORE_TRUST_SHARING !== 'false',
  public_verification: process.env.AFRICORE_PUBLIC_VERIFICATION !== 'false',
  testnet_anchoring: process.env.AFRICORE_TESTNET_ANCHORING === 'true',
  production_anchoring: false,
  selective_disclosure: false,
  experimental_index: true,
});
export function sandbox(a: Access) {
  if (a.environment !== 'sandbox')
    fail(
      503,
      'Stage 3 production issuance and trust mutations are disabled pending key, governance and privacy review',
    );
  if (!flags().passport_beta) fail(503, 'Passport beta disabled');
}
export function decode(r: any) {
  return {
    ...JSON.parse(unseal(r.data)),
    id: r.id,
    org_id: r.org_id,
    environment: r.environment,
    kind: r.kind,
    peer_org: r.peer_org,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
export async function list(a: Access, kind: string, peers = false) {
  return (
    await dbAll(
      'SELECT * FROM ac3_objects WHERE environment=? AND kind=? AND ' +
        (peers ? '(org_id=? OR peer_org=?)' : 'org_id=?') +
        ' ORDER BY created_at DESC',
      [a.environment, kind, a.org, ...(peers ? [a.org] : [])],
    )
  ).map(decode);
}
export async function get(a: Access, id: string, kind: string, peers = false) {
  const r = await dbGet(
    'SELECT * FROM ac3_objects WHERE id=? AND kind=? AND environment=? AND ' +
      (peers ? '(org_id=? OR peer_org=?)' : 'org_id=?'),
    [id, kind, a.environment, a.org, ...(peers ? [a.org] : [])],
  );
  if (!r) fail(404, 'Trust record not found');
  return decode(r);
}
export async function put(
  a: Access,
  kind: string,
  data: any,
  id = randomUUID(),
  peer: string | null = null,
) {
  const at = now();
  await dbRun(
    'INSERT INTO ac3_objects(id,org_id,environment,kind,peer_org,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
    [id, a.org, a.environment, kind, peer, seal(JSON.stringify(data)), at, at],
  );
  await audit(a.org, a.actor, 'trust.' + kind + '.created', id);
  return {
    ...data,
    id,
    org_id: a.org,
    kind,
    peer_org: peer,
    environment: a.environment,
    created_at: at,
    updated_at: at,
  };
}
export async function change(a: Access, object: any, patch: any) {
  const data = { ...object, ...patch };
  const r = await dbRun(
    'UPDATE ac3_objects SET data=?,updated_at=? WHERE id=? AND org_id=? AND environment=?',
    [
      seal(JSON.stringify(data)),
      now(),
      object.id,
      object.org_id,
      a.environment,
    ],
  );
  if (!r.changes) fail(409, 'Trust record changed');
  await audit(a.org, a.actor, 'trust.' + object.kind + '.updated', object.id);
  return { ...data, updated_at: now() };
}
export async function operator(req: any) {
  const u = await user(req);
  const allowed = (process.env.AFRICORE_TRUST_OPERATOR_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase());
  if (!u.verified || !allowed.includes(u.email))
    fail(403, 'Verified trust-operator allowlist required');
  return u;
}
export async function organization(id: string) {
  const row = await dbGet('SELECT id,name FROM ac_organizations WHERE id=?', [
    id,
  ]);
  return row || fail(404, 'Organization not found');
}
export const origin = () => {
  const configured = process.env.AFRICORE_PUBLIC_ORIGIN;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production')
    fail(503, 'Public origin required');
  return 'http://localhost:' + (process.env.PORT || 4000);
};
