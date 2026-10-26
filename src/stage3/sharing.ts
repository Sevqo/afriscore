import { z } from 'zod';
import { decodeProtectedHeader, compactVerify, importJWK } from 'jose';
import { dbAll, dbGet, dbRun } from '../db';
import { Access, audit, fail, user } from '../platform/auth';
import { hash, secret, seal, unseal, now } from '../platform/crypto';
import { atomic } from '../stage2/store';
import { emit } from '../stage2/events';
import { get, list, put, change, organization, sandbox, flags } from './store';
import { requestInput, grantInput } from './contracts';
import { credential, signed, verifyCredential } from './credentials';
export async function verificationRequest(a: Access, input: any) {
  sandbox(a);
  const d = requestInput.parse(input);
  if (d.holder_org === a.org)
    fail(400, 'A verification request must name another business');
  await organization(d.holder_org);
  return atomic(a, async () => {
    const r = await put(
      a,
      'verification_request',
      {
        ...d,
        status: 'pending',
        nonce: secret(),
        requested_by: a.actor,
        expires_at: new Date(
          Date.now() + d.expires_days * 86400000,
        ).toISOString(),
      },
      undefined,
      d.holder_org,
    );
    await emit({ ...a, org: d.holder_org }, 'verification.requested', {
      id: r.id,
      requester_org: a.org,
      types: d.types,
    });
    return r;
  });
}
export async function grant(a: Access, input: any) {
  sandbox(a);
  if (!flags().trust_sharing) fail(503, 'Trust sharing disabled');
  const d = grantInput.parse(input);
  if (d.recipient_org === a.org) fail(400, 'Choose a separate recipient');
  await organization(d.recipient_org);
  return atomic(a, async () => {
    const p = (await list(a, 'passport'))[0];
    if (!p) fail(409, 'Passport required');
    const tokens: string[] = [],
      types: string[] = [];
    for (const id of [...new Set(d.credential_ids)]) {
      const c = await credential(a, id);
      const result = await verifyCredential(c.token);
      if (result.overall !== 'meets_sandbox_policy')
        fail(409, 'Only currently acceptable credentials can be shared');
      tokens.push(c.token);
      types.push(c.type);
    }
    let request: any = null;
    if (d.request_id) {
      request = await get(a, d.request_id, 'verification_request', true);
      if (
        request.peer_org !== a.org ||
        request.org_id !== d.recipient_org ||
        request.status !== 'pending' ||
        request.expires_at < now()
      )
        fail(403, 'Request recipient, holder, expiry or state mismatch');
      if (request.types.some((type: string) => !types.includes(type)))
        fail(400, 'Required credential types are missing');
      if (types.some((type) => !request.types.includes(type)))
        fail(400, 'Do not disclose unrequested credential types');
      if (request.purpose !== d.purpose)
        fail(400, 'Purpose must match the reviewed request');
    }
    const { randomUUID } = await import('node:crypto'),
      id = randomUUID(),
      token = secret(),
      expires = new Date(
        Math.min(
          Date.now() + d.expires_hours * 3600000,
          request ? Date.parse(request.expires_at) : Infinity,
        ),
      ).toISOString(),
      nonce = request?.nonce || secret();
    const presentation = {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      id: 'urn:uuid:' + id,
      type: ['VerifiablePresentation'],
      holder: p.subject,
      verifiableCredential: tokens.map((token) => ({
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: 'EnvelopedVerifiableCredential',
        id: 'data:application/vc+jwt,' + token,
      })),
      aud: 'urn:uuid:' + d.recipient_org,
      nonce,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.parse(expires) / 1000),
      authorization: {
        grant_id: id,
        purpose: d.purpose,
        request_id: d.request_id || null,
      },
    };
    const vp = await signed(p.id, a.environment, presentation, 'vp+jwt');
    await dbRun(
      'INSERT INTO ac3_grants(id,org_id,environment,recipient_org,token_hash,data,expires_at,one_time,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        id,
        a.org,
        a.environment,
        d.recipient_org,
        hash(token),
        seal(JSON.stringify({ ...d, nonce, presentation: vp, types })),
        expires,
        d.one_time ? 1 : 0,
        now(),
      ],
    );
    if (request)
      await change(a, request, {
        status: 'approved',
        grant_id: id,
        approved_by: a.actor,
      });
    await emit(a, 'sharing.grant_created', {
      id,
      recipient_org: d.recipient_org,
      credential_count: tokens.length,
    });
    return {
      id,
      url: '/trust/share/' + token,
      expires_at: expires,
      recipient_org: d.recipient_org,
      one_time: d.one_time,
      disclosed_types: types,
      copy_limitation:
        'Revocation stops future access; cannot erase copies already disclosed.',
    };
  });
}
export async function consume(req: any, token: string) {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  const u = await user(req);
  const row = await dbGet('SELECT * FROM ac3_grants WHERE token_hash=?', [
    hash(token),
  ]);
  if (!row) fail(404, 'Share link not found');
  const member = await dbGet(
    'SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',
    [row.recipient_org, u.id],
  );
  if (!member) fail(403, 'Sign in as a member of the named recipient business');
  const a: Access = {
    org: row.org_id,
    environment: row.environment,
    actor: u.id,
    role: member.role,
    api: false,
  };
  return atomic(a, async () => {
    const current = await dbGet('SELECT * FROM ac3_grants WHERE id=?', [
      row.id,
    ]);
    if (
      current.revoked_at ||
      current.expires_at < now() ||
      (current.one_time && current.consumed_at)
    )
      fail(410, 'Share expired, revoked or already used');
    const data = JSON.parse(unseal(current.data));
    for (const id of data.credential_ids) {
      const c = await credential(a, id);
      if ((await verifyCredential(c.token)).overall !== 'meets_sandbox_policy')
        fail(409, 'Credential no longer acceptable');
    }
    if (current.one_time) {
      const consumed = await dbRun(
        'UPDATE ac3_grants SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND revoked_at IS NULL',
        [now(), current.id],
      );
      if (!consumed.changes) fail(409, 'Share already consumed');
    }
    await put(a, 'share_access', {
      grant_id: current.id,
      recipient_org: row.recipient_org,
      user_id: u.id,
      at: now(),
    });
    await audit(a.org, u.id, 'sharing.accessed', current.id);
    return {
      presentation: data.presentation,
      media_type: 'application/vp+jwt',
      disclosed_types: data.types,
      purpose: data.purpose,
      recipient_org: row.recipient_org,
      nonce: data.nonce,
      expires_at: current.expires_at,
    };
  });
}
export async function revokeGrant(a: Access, id: string) {
  sandbox(a);
  const r = await dbRun(
    'UPDATE ac3_grants SET revoked_at=? WHERE id=? AND org_id=? AND environment=? AND revoked_at IS NULL',
    [now(), id, a.org, a.environment],
  );
  if (!r.changes) fail(404, 'Active sharing grant not found');
  await emit(a, 'sharing.grant_revoked', { id });
  return { id, revoked: true, previous_copies_erased: false };
}
export async function verifyPresentation(
  token: string,
  audience: string,
  nonce: string,
) {
  const report: any = {
    signature: 'invalid',
    holder_binding: 'unchecked',
    audience: 'unchecked',
    nonce: 'unchecked',
    authorization: 'unchecked',
    credentials: [],
    overall: 'failed',
    policy: 'africore-presentation-v1',
    verified_at: now(),
  };
  try {
    if (token.length > 900000) throw Error('Presentation too large');
    const header = decodeProtectedHeader(token);
    if (
      header.alg !== 'ES256' ||
      header.typ !== 'vp+jwt' ||
      header.jku ||
      header.x5u
    )
      throw Error('Unsupported presentation header');
    const key = await dbGet('SELECT * FROM ac3_keys WHERE id=?', [header.kid]);
    if (!key || !['active', 'retired'].includes(key.state))
      throw Error('Holder key unavailable or compromised');
    const result = await compactVerify(
      token,
      await importJWK(JSON.parse(key.public_jwk), 'ES256'),
      { algorithms: ['ES256'] },
    );
    report.signature = 'valid';
    const vp = JSON.parse(Buffer.from(result.payload).toString());
    if (vp.holder !== 'urn:uuid:' + key.owner_id)
      throw Error('Holder binding mismatch');
    report.holder_binding = 'managed_holder_signature';
    if (vp.aud !== audience) throw Error('Audience mismatch');
    report.audience = 'matched';
    if (vp.nonce !== nonce) throw Error('Nonce mismatch');
    report.nonce = 'matched';
    if (
      vp.exp < Math.floor(Date.now() / 1000) ||
      vp.iat > Math.floor(Date.now() / 1000) + 30
    )
      throw Error('Presentation expired or future-dated');
    const grant = await dbGet('SELECT * FROM ac3_grants WHERE id=?', [
      vp.authorization.grant_id,
    ]);
    if (
      !grant ||
      grant.revoked_at ||
      grant.expires_at < now() ||
      'urn:uuid:' + grant.recipient_org !== audience
    )
      throw Error('Authorization expired or revoked');
    const data = JSON.parse(unseal(grant.data));
    if (data.nonce !== nonce || data.presentation !== token)
      throw Error('Request substitution detected');
    report.authorization = 'current_grant';
    for (const envelope of vp.verifiableCredential || []) {
      if (!envelope.id.startsWith('data:application/vc+jwt,'))
        throw Error('Unsupported credential envelope');
      const result = await verifyCredential(
        envelope.id.slice('data:application/vc+jwt,'.length),
      );
      report.credentials.push(result);
    }
    if (!report.credentials.length) throw Error('Empty presentation');
    report.overall = report.credentials.every(
      (c: any) => c.overall === 'meets_sandbox_policy',
    )
      ? 'meets_sandbox_policy'
      : 'failed';
    return report;
  } catch (error) {
    report.reason = (error as Error).message;
    return report;
  }
}
