import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { configureTestEnv,productFixtureBody } from './helpers';
configureTestEnv('stage3');
import { createApp } from '../app';
import { migrate, dbGet, dbAll, dbRun, closeDb } from '../db';
import { Access } from '../platform/auth';
import { credentialTypes } from '../trust/contracts';
import { commitmentFor, inclusion, proofDomain } from '../trust/proofs';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { verifyCredential } from '../trust/credentials';
import { now, unseal } from '../platform/crypto';
import fs from 'node:fs';
let server: any,
  base = '',
  owner = '',
  issuerCookie = '',
  recipientCookie = '',
  stranger = '',
  org = '',
  issuerOrg = '',
  recipientOrg = '',
  issuerId = '',
  passportId = '',
  evidenceId = '',
  credentialId = '',
  token = '',
  grantId = '',
  shareToken = '',
  presentation = '',
  shareNonce = '';
const unique = randomUUID();
async function api(
  path: string,
  method = 'GET',
  body?: any,
  cookie = owner,
  headers: any = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Connection: 'close',
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(productFixtureBody(path,method,body)),
  });
  let data: any;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return {
    status: r.status,
    data,
    cookie: r.headers.get('set-cookie')?.split(';')[0] || '',
  };
}
const path = (o: string, s: string) =>
  '/api/v1/organizations/' + o + '/trust' + s;
async function setup(label: string) {
  const email = label + '-' + unique + '@example.test',
    u = await api(
      '/api/auth/signup',
      'POST',
      { email, password: 'synthetic-credential-password-123' },
      '',
    );
  const cookie = u.cookie;
  await api(
    '/api/auth/verify',
    'POST',
    { token: u.data.verification_token },
    cookie,
  );
  const result = await api(
    '/api/v1/organizations',
    'POST',
    {
      name: label + ' synthetic business',
      business_type: 'Supplier',
      industry: 'Trade',
      location: 'Nairobi',
      email,
      phone: '+254700000000',
    },
    cookie,
  );
  return { cookie, org: result.data.id, email, id: u.data.id };
}
before(async () => {
  await migrate();
  server = createApp().listen(0);
  await new Promise<void>((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
  const a = await setup('holder'),
    b = await setup('issuer'),
    c = await setup('recipient'),
    d = await setup('stranger');
  owner = a.cookie;
  org = a.org;
  issuerCookie = b.cookie;
  issuerOrg = b.org;
  recipientCookie = c.cookie;
  recipientOrg = c.org;
  stranger = d.cookie;
  process.env.AFRICORE_TRUST_OPERATOR_EMAILS = b.email;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await closeDb();
});
test('passport is private, stable, tenant-scoped and migration safe', async () => {
  const r = await api(path(org, '/passport'), 'POST', {
    display_name: 'Synthetic Amani Supplies',
    category: 'Supplier',
    industry: 'Trade',
    country: 'KE',
  });
  assert.equal(r.status, 201);
  passportId = r.data.id;
  assert.equal(r.data.subject, 'urn:uuid:' + passportId);
  assert.equal(r.data.public_profile, false);
  assert.equal(
    (
      await api(path(org, '/passport'), 'POST', {
        display_name: 'Duplicate',
        category: 'Supplier',
        industry: 'Trade',
        country: 'KE',
      })
    ).status,
    409,
  );
  assert.equal(
    (await api('/api/v1/trust/public/' + passportId, 'GET', undefined, ''))
      .status,
    404,
  );
  assert.equal(
    (await api(path(org, '/passport'), 'GET', undefined, stranger)).status,
    403,
  );
  await migrate();
  assert.equal(
    (await api(path(org, '/passport'))).data.passport.id,
    passportId,
  );
  assert.equal(
    (
      await api(path(org, '/passport'), 'GET', undefined, owner, {
        'X-Environment': 'production',
      })
    ).status,
    402,
  );
});
test('evidence derives assurance from actual records and never accepts invented source verification', async () => {
  const body = {
    source_kind: 'profile',
    source_id: org,
    lawful_basis: 'consent',
    purpose: 'Create synthetic minimal business identity evidence.',
  };
  const r = await api(path(org, '/evidence'), 'POST', body);
  assert.equal(r.status, 201);
  evidenceId = r.data.id;
  assert.equal(r.data.assurance_level, 0);
  assert.equal(
    (await api(path(org, '/evidence'), 'POST', { ...body, assurance_level: 3 }))
      .status,
    400,
  );
  assert.equal(
    (await api(path(org, '/evidence'), 'POST', body)).data.duplicate,
    true,
  );
  assert.equal(
    (
      await api(path(org, '/evidence'), 'POST', {
        ...body,
        source_id: recipientOrg,
      })
    ).status,
    403,
  );
  const p = (await api(path(org, '/passport'))).data;
  assert.equal(p.index.value, 20);
  assert.equal(
    p.index.components.filter((c: any) => c.source_verified_count > 0).length,
    0,
  );
  const raw = await dbGet('SELECT data FROM ac3_objects WHERE id=?', [
    evidenceId,
  ]);
  assert.ok(!raw.data.includes('minimal business'));
});
test('issuer approval is separately governed and sandbox authority is never institutional recognition', async () => {
  const application = await api(
    path(issuerOrg, '/issuers'),
    'POST',
    {
      name: 'Synthetic Sandbox Issuer',
      types: credentialTypes,
      statement: 'Disposable issuer for local conformance exercises.',
    },
    issuerCookie,
  );
  assert.equal(application.status, 201);
  issuerId = application.data.id;
  assert.equal(
    (
      await api(
        '/api/v1/internal/trust/issuers/' + issuerId + '/review',
        'POST',
        {
          decision: 'approve_sandbox',
          reason: 'Reviewed synthetic sandbox application only.',
        },
        owner,
      )
    ).status,
    403,
  );
  const reviewed = await api(
    '/api/v1/internal/trust/issuers/' + issuerId + '/review',
    'POST',
    {
      decision: 'approve_sandbox',
      reason: 'Reviewed synthetic sandbox application only.',
    },
    issuerCookie,
  );
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.data.recognized, false);
  assert.equal(
    reviewed.data.authority,
    'sandbox_only_no_institutional_authority',
  );
  assert.ok(!JSON.stringify(reviewed.data).includes('private_sealed'));
});
test('holder authorizes minimal evidence, approved issuer signs and raw custody is encrypted', async () => {
  assert.equal(
    (
      await api(path(org, '/issuance-requests'), 'POST', {
        issuer_id: issuerId,
        holder_org: org,
        type: 'BusinessIdentityCredential',
        evidence_ids: [evidenceId, evidenceId],
        valid_days: 90,
        consent: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api(
        path(issuerOrg, '/credentials'),
        'POST',
        { request_id: evidenceId },
        issuerCookie,
      )
    ).status,
    404,
  );
  const request = await api(path(org, '/issuance-requests'), 'POST', {
    issuer_id: issuerId,
    holder_org: org,
    type: 'BusinessIdentityCredential',
    evidence_ids: [evidenceId],
    valid_days: 90,
    consent: true,
  });
  assert.equal(request.status, 201);
  assert.equal(
    (
      await api(path(org, '/credentials'), 'POST', {
        request_id: request.data.id,
      })
    ).status,
    403,
  );
  const issued = await api(
    path(issuerOrg, '/credentials'),
    'POST',
    { request_id: request.data.id },
    issuerCookie,
  );
  assert.equal(issued.status, 201);
  credentialId = issued.data.id;
  token = issued.data.token;
  assert.equal(
    issued.data.credential.credentialSubject.evidence.assurance_level,
    0,
  );
  assert.ok(!token.includes('Synthetic'));
  assert.equal(
    (
      await api(
        path(issuerOrg, '/credentials'),
        'POST',
        { request_id: request.data.id },
        issuerCookie,
      )
    ).data.duplicate,
    true,
  );
  const raw = await dbGet('SELECT * FROM ac3_credentials WHERE id=?', [
    credentialId,
  ]);
  assert.notEqual(raw.token_sealed, token);
  assert.notEqual(raw.salt_sealed, issued.data.salt);
  const key = await dbGet('SELECT * FROM ac3_keys WHERE id=?', [raw.key_id]);
  assert.ok(!key.private_sealed.includes('"d"'));
  assert.equal(
    (
      await api(
        path(org, '/credentials/' + credentialId),
        'GET',
        undefined,
        stranger,
      )
    ).status,
    403,
  );
});
test('JOSE verification detects tampering, expiry and issuer mismatch without trusting embedded URLs', async () => {
  const result = await verifyCredential(token);
  assert.equal(result.signature, 'valid');
  assert.equal(result.overall, 'meets_sandbox_policy');
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.credentialSubject.displayName = 'Tampered';
  const tampered = [
    parts[0],
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    parts[2],
  ].join('.');
  assert.equal((await verifyCredential(tampered)).signature, 'invalid');
  const original = await dbGet(
    'SELECT token_sealed FROM ac3_credentials WHERE id=?',
    [credentialId],
  );
  assert.ok(original);
  assert.equal(
    (await api('/api/v1/trust/verify', 'POST', { credential: token }, '')).data
      .status,
    'active',
  );
});
test('fresh signed bitstring lists and independent Node crypto implementation validate the credential', async () => {
  const metadata = (
    await api('/api/v1/trust/issuers/' + issuerId, 'GET', undefined, '')
  ).data;
  const status_lists: any = {};
  for (const purpose of ['revocation', 'suspension']) {
    const r = await fetch(
      base + '/api/v1/trust/status/' + issuerId + '/' + purpose,
    );
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /application\/vc\+jwt/);
    status_lists[purpose] = await r.text();
  }
  const importer = new Function('path', 'return import(path)');
  const { verifyBundle } = await importer(
    new URL(
      '../../scripts/verify-credential.mjs',
      'file:///' +
        process.cwd().split('\\').join('/') +
        '/dist/__tests__/stage3.test.js',
    ).href,
  );
  const result = await verifyBundle({
    credential: token,
    issuer_metadata: metadata,
    status_lists,
  });
  assert.equal(result.signature, 'valid');
  assert.equal(result.status, 'active');
  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync(
    '.tmp/stage3-verification-bundle.json',
    JSON.stringify({
      credential: token,
      issuer_metadata: metadata,
      status_lists,
    }),
  );
  fs.writeFileSync(
    '.tmp/stage3-demo-sample.json',
    JSON.stringify(
      { credential: token, issuer_metadata: metadata, status_lists },
      null,
      2,
    ),
  );
});
test('relationship requires separate counterparty authority and resists self-confirmation', async () => {
  const r = await api(path(org, '/relationships'), 'POST', {
    counterparty_org: recipientOrg,
    relationship: 'supplier',
    statement: 'Synthetic supply relationship for local testing.',
    consent: true,
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await api(path(org, '/relationships/' + r.data.id + '/respond'), 'POST', {
        decision: 'confirm',
        statement: 'Improper self confirmation attempt.',
      })
    ).status,
    403,
  );
  const confirmed = await api(
    path(recipientOrg, '/relationships/' + r.data.id + '/respond'),
    'POST',
    {
      decision: 'confirm',
      statement: 'Separate synthetic counterparty confirms relationship.',
    },
    recipientCookie,
  );
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.status, 'confirmed');
  assert.equal(
    (await api(path(org, '/relationships'), 'GET', undefined, stranger)).status,
    403,
  );
});
test('recipient-bound requests and one-time presentations enforce purpose, nonce, audience and replay', async () => {
  const r = await api(
    path(recipientOrg, '/requests'),
    'POST',
    {
      holder_org: org,
      types: ['BusinessIdentityCredential'],
      purpose: 'Synthetic supplier onboarding verification.',
    },
    recipientCookie,
  );
  assert.equal(r.status, 201);
  const body = {
    recipient_org: recipientOrg,
    credential_ids: [credentialId],
    purpose: r.data.purpose,
    expires_hours: 24,
    one_time: true,
    request_id: r.data.id,
    consent: true,
  };
  assert.equal(
    (
      await api(path(org, '/grants'), 'POST', {
        ...body,
        purpose: 'Substituted verification purpose.',
      })
    ).status,
    400,
  );
  const shared = await api(path(org, '/grants'), 'POST', body);
  assert.equal(shared.status, 201);
  grantId = shared.data.id;
  shareToken = shared.data.url.split('/').pop();
  const raw = await dbGet('SELECT * FROM ac3_grants WHERE id=?', [grantId]);
  assert.notEqual(raw.token_hash, shareToken);
  assert.ok(!raw.data.includes(token));
  assert.equal(
    (
      await api(
        '/api/v1/trust/presentations/' + shareToken,
        'POST',
        {},
        stranger,
      )
    ).status,
    403,
  );
  const access = await api(
    '/api/v1/trust/presentations/' + shareToken,
    'POST',
    {},
    recipientCookie,
  );
  assert.equal(access.status, 200);
  presentation = access.data.presentation;
  shareNonce = access.data.nonce;
  assert.equal(
    (
      await api(
        '/api/v1/trust/presentations/' + shareToken,
        'POST',
        {},
        recipientCookie,
      )
    ).status,
    410,
  );
  const verified = await api(
    '/api/v1/trust/verify-presentation',
    'POST',
    { presentation, audience: 'urn:uuid:' + recipientOrg, nonce: shareNonce },
    '',
  );
  assert.equal(verified.data.overall, 'meets_sandbox_policy');
  assert.equal(
    (
      await api(
        '/api/v1/trust/verify-presentation',
        'POST',
        { presentation, audience: 'urn:uuid:' + org, nonce: shareNonce },
        '',
      )
    ).data.overall,
    'failed',
  );
  assert.equal(
    (
      await api(
        '/api/v1/trust/verify-presentation',
        'POST',
        {
          presentation,
          audience: 'urn:uuid:' + recipientOrg,
          nonce: 'wrong-nonce-1234567890',
        },
        '',
      )
    ).data.overall,
    'failed',
  );
});
test('revocation of a grant blocks future authorization without claiming erasure of prior copies', async () => {
  const r = await api(path(org, '/grants/' + grantId + '/revoke'), 'POST', {});
  assert.equal(r.status, 200);
  assert.equal(r.data.previous_copies_erased, false);
  assert.equal(
    (
      await api(
        '/api/v1/trust/verify-presentation',
        'POST',
        {
          presentation,
          audience: 'urn:uuid:' + recipientOrg,
          nonce: shareNonce,
        },
        '',
      )
    ).data.overall,
    'failed',
  );
});
test('Merkle commitments are randomized, domain-separated and tamper-evident', async () => {
  const salts = ['0x' + '01'.repeat(32), '0x' + '02'.repeat(32)],
    commits = salts.map((s) => commitmentFor(token, s));
  assert.notEqual(commits[0], commits[1]);
  const tree = StandardMerkleTree.of(
    commits.map((c) => [proofDomain, c]),
    ['bytes32', 'bytes32'],
  );
  for (const [index, value] of tree.entries()) {
    assert.equal(inclusion(value[1], tree.root, tree.getProof(index)), true);
    assert.equal(
      inclusion(
        commitmentFor(token + 'x', salts[index]),
        tree.root,
        tree.getProof(index),
      ),
      false,
    );
  }
});
test('real queued anchor can be independently reconciled on the configured local chain', async () => {
  const r = await api(
    '/api/v1/internal/trust/batches',
    'POST',
    {},
    issuerCookie,
  );
  assert.equal(r.status, 201);
  if (process.env.AFRICORE_ANCHOR_RPC) {
    await api(
      '/api/v1/internal/trust/anchors/process',
      'POST',
      {},
      issuerCookie,
    );
    await dbRun('UPDATE ac3_batches SET next_at=? WHERE id=?', [
      new Date(0).toISOString(),
      r.data.id,
    ]);
    await api(
      '/api/v1/internal/trust/anchors/process',
      'POST',
      {},
      issuerCookie,
    );
    const proof = (
      await api(path(org, '/credentials/' + credentialId + '/proof'))
    ).data;
    assert.equal(proof.status, 'confirmed');
    const verify = await api(
      '/api/v1/trust/verify-proof',
      'POST',
      { credential: token, proof },
      '',
    );
    assert.equal(verify.data.inclusion, true);
    assert.equal(verify.data.onchain, true);
    const bundle = JSON.parse(
      fs.readFileSync('.tmp/stage3-verification-bundle.json', 'utf8'),
    );
    bundle.proof = proof;
    fs.writeFileSync(
      '.tmp/stage3-verification-bundle.json',
      JSON.stringify(bundle),
    );
  } else
    assert.equal(
      (await api(path(org, '/credentials/' + credentialId + '/proof'))).data
        .status,
      'queued',
    );
});
test('rotation preserves retired-key signatures; suspension and permanent revocation override integrity', async () => {
  const rotation = await api(
    path(issuerOrg, '/issuers/' + issuerId + '/rotate'),
    'POST',
    { compromise: false, reason: 'Routine synthetic key rotation test.' },
    issuerCookie,
  );
  assert.equal(rotation.status, 200);
  assert.equal((await verifyCredential(token)).overall, 'meets_sandbox_policy');
  assert.equal(
    (
      await api(path(org, '/credentials/' + credentialId + '/status'), 'POST', {
        status: 'revoked',
        reason: 'Unauthorized holder cannot revoke issuer assertion.',
      })
    ).status,
    403,
  );
  await api(
    path(issuerOrg, '/credentials/' + credentialId + '/status'),
    'POST',
    {
      status: 'suspended',
      reason: 'Synthetic review pending additional evidence.',
    },
    issuerCookie,
  );
  assert.equal((await verifyCredential(token)).signature, 'valid');
  assert.equal((await verifyCredential(token)).overall, 'failed');
  await api(
    path(issuerOrg, '/credentials/' + credentialId + '/status'),
    'POST',
    {
      status: 'active',
      reason: 'Synthetic review completed with no correction.',
    },
    issuerCookie,
  );
  await api(
    path(issuerOrg, '/credentials/' + credentialId + '/status'),
    'POST',
    {
      status: 'revoked',
      reason: 'Synthetic permanent correction demonstration.',
    },
    issuerCookie,
  );
  assert.equal((await verifyCredential(token)).status, 'revoked');
  assert.equal(
    (
      await api(
        path(issuerOrg, '/credentials/' + credentialId + '/status'),
        'POST',
        {
          status: 'active',
          reason: 'Attempting to undo permanent revocation.',
        },
        issuerCookie,
      )
    ).status,
    409,
  );
});
test('documents, manual review and corrections preserve assurance limits and private custody', async () => {
  const r = await api(path(org, '/identity-reviews'), 'POST', {
    legal_name: 'Synthetic Amani Supplies',
    jurisdiction: 'Kenya',
    registration_number: 'SYNTHETIC-ONLY',
    representative_statement:
      'I am authorized for this synthetic demonstration.',
    evidence_ids: [evidenceId],
    consent: true,
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await api(
        '/api/v1/internal/trust/identity/' + r.data.id + '/review',
        'POST',
        {
          decision: 'document_reviewed',
          reason: 'Synthetic manual review, no registry query.',
        },
        issuerCookie,
      )
    ).status,
    409,
  );
  const text = 'Synthetic document; not a government registration.';
  const upload = await api(path(org, '/documents'), 'POST', {
    review_id: r.data.id,
    filename: 'synthetic.txt',
    content_type: 'text/plain',
    content_base64: Buffer.from(text).toString('base64'),
  });
  assert.equal(upload.status, 201);
  const raw = await dbGet('SELECT data FROM ac3_objects WHERE id=?', [
    upload.data.id,
  ]);
  assert.ok(!raw.data.includes(text));
  const reviewed = await api(
    '/api/v1/internal/trust/identity/' + r.data.id + '/review',
    'POST',
    {
      decision: 'document_reviewed',
      reason: 'Synthetic manual review, no registry query.',
    },
    issuerCookie,
  );
  assert.equal(reviewed.status, 200);
  assert.equal(
    (await api(path(org, '/passport'))).data.passport.verification_status,
    'document_reviewed',
  );
  assert.equal(
    (await api('/api/v1/internal/trust/operations', 'GET', undefined, owner))
      .status,
    403,
  );
  const correction = await api(path(org, '/corrections'), 'POST', {
    resource_id: evidenceId,
    kind: 'evidence',
    reason: 'Synthetic source needs a correction to its assertion.',
  });
  assert.equal(correction.status, 201);
  assert.equal(
    (
      await api(
        '/api/v1/internal/trust/corrections/' + correction.data.id + '/resolve',
        'POST',
        {
          decision: 'uphold',
          reason: 'Synthetic correction upheld; old evidence retained.',
        },
        issuerCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await api(path(org, '/passport'))).data.evidence.find(
      (e: any) => e.id === evidenceId,
    ).status,
    'disputed',
  );
});
test('production trust mutations and cross-tenant API access remain denied', async () => {
  assert.equal(
    (
      await api(
        path(org, '/passport'),
        'POST',
        {
          display_name: 'Production',
          category: 'Trade',
          industry: 'Trade',
          country: 'KE',
        },
        owner,
        { 'X-Environment': 'production' },
      )
    ).status,
    402,
  );
  assert.equal(
    (await api(path(org, '/grants'), 'GET', undefined, stranger)).status,
    403,
  );
  assert.equal(
    (
      await api(
        path(org, '/documents/' + evidenceId + '/download'),
        'GET',
        undefined,
        stranger,
      )
    ).status,
    403,
  );
});

test('unrecognized valid issuer is never promoted to authoritative trust', async () => {
  const { generateKeyPair, exportJWK, CompactSign } = await import('jose');
  const pair = await generateKeyPair('ES256', { extractable: true }),
    payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );
  payload.issuer = 'did:web:unrecognized.example';
  const external = await new CompactSign(Buffer.from(JSON.stringify(payload)))
    .setProtectedHeader({
      alg: 'ES256',
      kid: 'did:web:unrecognized.example#key1',
      typ: 'vc+jwt',
    })
    .sign(pair.privateKey);
  const report = await verifyCredential(
    external,
    await exportJWK(pair.publicKey),
  );
  assert.equal(report.signature, 'valid');
  assert.equal(report.issuer_authority, 'unknown');
  assert.equal(report.overall, 'requires_review');
  assert.equal(report.status, 'unchecked');
});

test('valid signatures cannot bypass expiry, malformed profile or issuer-key binding', async () => {
  const { signed } = await import('../trust/credentials');
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString(),
  );
  const expired = await signed(issuerId, 'sandbox', {
    ...payload,
    validFrom: new Date(Date.now() - 86400000).toISOString(),
    validUntil: new Date(Date.now() - 1000).toISOString(),
  });
  const result = await verifyCredential(expired);
  assert.equal(result.signature, 'valid');
  assert.equal(result.period, 'expired_or_not_yet_valid');
  assert.equal(result.overall, 'failed');
  const { credentialStatus, ...withoutStatus } = payload;
  assert.equal(
    (await verifyCredential(await signed(issuerId, 'sandbox', withoutStatus)))
      .overall,
    'failed',
  );
  const wrong = await signed(issuerId, 'sandbox', {
    ...payload,
    issuer: 'urn:uuid:' + recipientOrg,
  });
  assert.match((await verifyCredential(wrong)).reason, /Issuer\/key mismatch/);
});

test('withdrawn or stale evidence authorization cannot issue a credential', async () => {
  const fresh = await api(path(org, '/evidence'), 'POST', {
    source_kind: 'profile',
    source_id: org,
    lawful_basis: 'consent',
    purpose: 'Refresh synthetic source before authorizing another credential.',
  });
  assert.equal(fresh.status, 201);
  const body = {
    issuer_id: issuerId,
    holder_org: org,
    type: 'BusinessIdentityCredential',
    evidence_ids: [fresh.data.id],
    valid_days: 90,
    consent: true,
  };
  const withdrawn = await api(path(org, '/issuance-requests'), 'POST', body);
  assert.equal(
    (
      await api(
        path(org, '/issuance-requests/' + withdrawn.data.id + '/cancel'),
        'POST',
        {},
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await api(
        path(issuerOrg, '/credentials'),
        'POST',
        { request_id: withdrawn.data.id },
        issuerCookie,
      )
    ).status,
    403,
  );
  const request = await api(path(org, '/issuance-requests'), 'POST', body);
  const row = await dbGet(
    'SELECT profile,name FROM ac_organizations WHERE id=?',
    [org],
  );
  await dbRun('UPDATE ac_organizations SET name=? WHERE id=?', [
    row.name + ' corrected',
    org,
  ]);
  assert.equal(
    (
      await api(
        path(issuerOrg, '/credentials'),
        'POST',
        { request_id: request.data.id },
        issuerCookie,
      )
    ).status,
    409,
  );
  await dbRun('UPDATE ac_organizations SET name=? WHERE id=?', [row.name, org]);
});

test('expired grants reveal no presentation and compromised keys revoke dependent credentials', async () => {
  const evidence = (await api(path(org, '/passport'))).data.evidence.find(
    (e: any) => e.status === 'active',
  );
  const request = await api(path(org, '/issuance-requests'), 'POST', {
    issuer_id: issuerId,
    holder_org: org,
    type: 'BusinessIdentityCredential',
    evidence_ids: [evidence.id],
    valid_days: 90,
    consent: true,
  });
  const issued = await api(
    path(issuerOrg, '/credentials'),
    'POST',
    { request_id: request.data.id },
    issuerCookie,
  );
  assert.equal(issued.status, 201);
  const shared = await api(path(org, '/grants'), 'POST', {
    recipient_org: recipientOrg,
    credential_ids: [issued.data.id],
    purpose: 'Synthetic grant expiry and key compromise tests.',
    expires_hours: 1,
    one_time: true,
    consent: true,
  });
  assert.equal(shared.status, 201);
  await dbRun('UPDATE ac3_grants SET expires_at=? WHERE id=?', [
    new Date(Date.now() - 1000).toISOString(),
    shared.data.id,
  ]);
  const result = await api(
    '/api/v1/trust/presentations/' + shared.data.url.split('/').pop(),
    'POST',
    {},
    recipientCookie,
  );
  assert.equal(result.status, 410);
  assert.equal(result.data.presentation, undefined);
  const rotated = await api(
    path(issuerOrg, '/issuers/' + issuerId + '/rotate'),
    'POST',
    {
      compromise: true,
      reason: 'Synthetic compromised issuer-key incident exercise.',
    },
    issuerCookie,
  );
  assert.equal(rotated.status, 200);
  assert.equal((await verifyCredential(issued.data.token)).key, 'compromised');
  assert.equal((await verifyCredential(issued.data.token)).status, 'revoked');
  assert.equal((await verifyCredential(issued.data.token)).overall, 'failed');
});

test('connected demo cookie namespace cannot authenticate or replace normal workspace sessions', async () => {
  const old = process.env.AFRICORE_DEMO_SESSION;
  try {
    process.env.AFRICORE_DEMO_SESSION = 'true';
    assert.equal((await api('/api/auth/me')).status, 401);
    const login = await api(
      '/api/auth/signin',
      'POST',
      {
        email: 'holder-' + unique + '@example.test',
        password: 'synthetic-credential-password-123',
      },
      '',
    );
    assert.equal(login.status, 200);
    assert.match(login.cookie, /^ac_demo_session=/);
    assert.equal(
      (await api('/api/auth/me', 'GET', undefined, login.cookie)).status,
      200,
    );
    process.env.AFRICORE_DEMO_SESSION = 'false';
    assert.equal(
      (await api('/api/auth/me', 'GET', undefined, login.cookie)).status,
      401,
    );
    assert.equal((await api('/api/auth/me')).status, 200);
  } finally {
    if (old === undefined) delete process.env.AFRICORE_DEMO_SESSION;
    else process.env.AFRICORE_DEMO_SESSION = old;
  }
});

test('material Passport edits reset review and suspend old identity credentials without changing signed payloads', async () => {
  const evidence = (await api(path(org, '/passport'))).data.evidence.find(
    (e: any) => e.status === 'active',
  );
  const request = await api(path(org, '/issuance-requests'), 'POST', {
    issuer_id: issuerId,
    holder_org: org,
    type: 'BusinessIdentityCredential',
    evidence_ids: [evidence.id],
    valid_days: 90,
    consent: true,
  });
  const issued = await api(
    path(issuerOrg, '/credentials'),
    'POST',
    { request_id: request.data.id },
    issuerCookie,
  );
  assert.equal(issued.status, 201);
  const edited = await api(path(org, '/passport'), 'PATCH', {
    display_name: 'Renamed synthetic holder',
    public_profile: true,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.verification_status, 'not_submitted');
  const after = await api(path(org, '/credentials/' + issued.data.id));
  assert.equal(after.data.token, issued.data.token);
  assert.equal(after.data.status, 'suspended');
  assert.equal(
    (
      await api(path(org, '/issuance-requests'), 'POST', {
        issuer_id: issuerId,
        holder_org: org,
        type: 'BusinessIdentityCredential',
        evidence_ids: [evidence.id],
        valid_days: 90,
        consent: true,
      })
    ).status,
    409,
  );
  const publicProfile = await api(
    '/api/v1/trust/public/' + passportId,
    'GET',
    undefined,
    '',
  );
  assert.equal(publicProfile.status, 200);
  assert.equal(publicProfile.data.legal_name, undefined);
  assert.equal(publicProfile.data.credentials, undefined);
  await api(path(org, '/passport'), 'PATCH', { public_profile: false });
  assert.equal(
    (await api('/api/v1/trust/public/' + passportId, 'GET', undefined, ''))
      .status,
    404,
  );
});
