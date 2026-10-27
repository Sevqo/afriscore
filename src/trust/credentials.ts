import {
  generateKeyPair,
  exportJWK,
  importJWK,
  CompactSign,
  compactVerify,
  decodeProtectedHeader,
} from 'jose';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dbAll, dbGet, dbRun } from '../db';
import { Access, audit, fail } from '../platform/auth';
import { seal, unseal, now, hash } from '../platform/crypto';
import { atomic } from '../operations/store';
import { emit } from '../operations/events';
import {
  credentialTypes,
  schemaRegistry,
  issueInput,
  minimalCredential,
} from './contracts';
import { get, list, put, change, origin, sandbox, flags } from './store';
import { commitmentFor } from './proofs';
export async function newKey(owner: string, environment: string) {
  const pair = await generateKeyPair('ES256', { extractable: true }),
    publicJwk = await exportJWK(pair.publicKey),
    privateJwk = await exportJWK(pair.privateKey),
    id = owner + '#' + randomUUID();
  await dbRun(
    'INSERT INTO ac3_keys(id,owner_id,environment,state,public_jwk,private_sealed,created_at) VALUES (?,?,?,?,?,?,?)',
    [
      id,
      owner,
      environment,
      'active',
      JSON.stringify({ ...publicJwk, kid: id, alg: 'ES256', use: 'sig' }),
      seal(JSON.stringify(privateJwk)),
      now(),
    ],
  );
  return id;
}
export async function signed(
  owner: string,
  environment: string,
  payload: any,
  typ = 'vc+jwt',
) {
  const key = await dbGet(
    "SELECT * FROM ac3_keys WHERE owner_id=? AND environment=? AND state='active' ORDER BY created_at DESC",
    [owner, environment],
  );
  if (!key) fail(503, 'No active signing key');
  const privateKey = await importJWK(
    JSON.parse(unseal(key.private_sealed)),
    'ES256',
  );
  return new CompactSign(Buffer.from(JSON.stringify(payload)))
    .setProtectedHeader({
      alg: 'ES256',
      kid: key.id,
      typ,
      cty: typ === 'vc+jwt' ? 'vc' : 'vp',
    })
    .sign(privateKey);
}
export async function issuerMetadata(id: string) {
  const i = await dbGet(
    'SELECT id,name,status,types,environment,review FROM ac3_issuers WHERE id=?',
    [id],
  );
  if (!i) fail(404, 'Issuer not found');
  const keys = await dbAll(
    'SELECT id,state,public_jwk,created_at FROM ac3_keys WHERE owner_id=?',
    [id],
  );
  return {
    ...i,
    types: JSON.parse(i.types),
    review: {
      method: JSON.parse(i.review).method,
      at: JSON.parse(i.review).at || null,
      recognized: false,
    },
    issuer: 'urn:uuid:' + id,
    recognized: i.status === 'approved' && i.environment === 'production',
    authority:
      i.environment === 'sandbox'
        ? 'sandbox_only_no_institutional_authority'
        : 'unverified',
    jwks: {
      keys: keys.map((k) => ({
        ...JSON.parse(k.public_jwk),
        state: k.state,
        created_at: k.created_at,
      })),
    },
  };
}
export async function applyIssuer(a: Access, input: any) {
  sandbox(a);
  const { z } = await import('zod');
  const d = z
    .object({
      name: z.string().min(2).max(150),
      types: z.array(z.enum(credentialTypes)).min(1).max(9),
      statement: z.string().min(10).max(1000),
    })
    .strict()
    .parse(input);
  const id = randomUUID();
  await dbRun(
    'INSERT INTO ac3_issuers(id,org_id,environment,name,status,types,review,created_at) VALUES (?,?,?,?,?,?,?,?)',
    [
      id,
      a.org,
      a.environment,
      d.name,
      'pending',
      JSON.stringify(d.types),
      JSON.stringify({
        statement: d.statement,
        method: 'application_only',
        recognized: false,
      }),
      now(),
    ],
  );
  await audit(a.org, a.actor, 'issuer.applied', id);
  return { id, status: 'pending' };
}
export async function reviewIssuer(a: Access, id: string, input: any) {
  const { z } = await import('zod');
  const d = z
    .object({
      decision: z.enum(['approve_sandbox', 'suspend', 'revoke']),
      reason: z.string().min(10).max(1000),
    })
    .strict()
    .parse(input);
  const i = await dbGet('SELECT * FROM ac3_issuers WHERE id=?', [id]);
  if (!i || i.environment !== 'sandbox') fail(404, 'Sandbox issuer not found');
  if (d.decision === 'approve_sandbox') {
    if (i.status === 'revoked')
      fail(409, 'Revoked issuer cannot be reactivated');
    await newKey(id, 'sandbox');
  }
  await dbRun('UPDATE ac3_issuers SET status=?,review=? WHERE id=?', [
    d.decision === 'approve_sandbox'
      ? 'approved_sandbox'
      : d.decision === 'suspend'
        ? 'suspended'
        : 'revoked',
    JSON.stringify({
      method: 'sandbox_operator_review',
      reason: d.reason,
      operator: a.actor,
      recognized: false,
      at: now(),
    }),
    id,
  ]);
  await audit(i.org_id, a.actor, 'issuer.' + d.decision, id);
  return issuerMetadata(id);
}
export async function rotateKey(
  a: Access,
  issuer: string,
  compromise: boolean,
) {
  sandbox(a);
  const i = await dbGet(
    'SELECT * FROM ac3_issuers WHERE id=? AND org_id=? AND environment=?',
    [issuer, a.org, a.environment],
  );
  if (!i || i.status !== 'approved_sandbox')
    fail(403, 'Approved sandbox issuer authority required');
  await dbRun(
    "UPDATE ac3_keys SET state=? WHERE owner_id=? AND environment=? AND state='active'",
    [compromise ? 'compromised' : 'retired', issuer, a.environment],
  );
  if (compromise) {
    const affected = await dbAll(
      "SELECT id,org_id FROM ac3_credentials WHERE issuer_id=? AND status!='revoked'",
      [issuer],
    );
    await dbRun(
      "UPDATE ac3_credentials SET status='revoked' WHERE issuer_id=? AND status!='revoked'",
      [issuer],
    );
    await audit(a.org, a.actor, 'issuer.key_compromised', issuer);
    for (const c of affected)
      await emit({ ...a, org: c.org_id }, 'credential.revoked', {
        id: c.id,
        reason: 'issuer_key_compromise',
      });
  }
  const kid = await newKey(issuer, a.environment);
  await audit(a.org, a.actor, 'issuer.key_rotated', kid);
  return { kid, compromised_previous: compromise };
}
export async function requestIssuance(a: Access, input: any) {
  sandbox(a);
  const d = issueInput.parse(input);
  if (d.holder_org !== a.org)
    fail(403, 'Holder must authorize its own evidence');
  const issuer = await dbGet(
    'SELECT * FROM ac3_issuers WHERE id=? AND environment=?',
    [d.issuer_id, a.environment],
  );
  if (
    !issuer ||
    issuer.status !== 'approved_sandbox' ||
    !JSON.parse(issuer.types).includes(d.type)
  )
    fail(403, 'Issuer is not approved for this sandbox credential type');
  await get(a, (await list(a, 'passport'))[0]?.id, 'passport');
  const evidence = [];
  for (const id of [...new Set(d.evidence_ids)]) {
    const e = await get(a, id, 'evidence');
    if (e.status !== 'active' || e.retention_until < now())
      fail(409, 'Evidence is not active or has expired');
    evidence.push({
      id: e.id,
      source_kind: e.source_kind,
      assurance_level: e.assurance_level,
      method: e.method,
      facts: e.facts,
      limitations: e.limitations,
      source_hash: e.source_hash,
    });
  }
  return put(
    a,
    'issuance_request',
    {
      ...d,
      evidence,
      status: 'pending',
      authorized_by: a.actor,
      authorized_at: now(),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    undefined,
    issuer.org_id,
  );
}
export const context = () => [
  'https://www.w3.org/ns/credentials/v2',
  Object.fromEntries([
    ...credentialTypes.map((t) => [t, 'https://africore.example/vocab#' + t]),
    ['AfriCoreEvidence', 'https://africore.example/vocab#AfriCoreEvidence'],
    [
      'evidence',
      { '@id': 'https://africore.example/vocab#evidence', '@type': '@json' },
    ],
    ['displayName', 'https://schema.org/name'],
    ['country', 'https://schema.org/addressCountry'],
  ]),
];
export async function issue(a: Access, requestId: string) {
  sandbox(a);
  if (!flags().credential_issuance) fail(503, 'Credential issuance disabled');
  return atomic(a, async () => {
    const request = await get(a, requestId, 'issuance_request', true);
    if (
      request.peer_org === a.org &&
      request.status === 'issued' &&
      request.credential_id
    )
      return {
        ...(await credential(
          { ...a, org: request.org_id },
          request.credential_id,
        )),
        duplicate: true,
      };
    if (
      request.peer_org !== a.org ||
      request.status !== 'pending' ||
      request.expires_at < now()
    )
      fail(403, 'An active holder-authorized issuance request is required');
    const i = await dbGet(
      'SELECT * FROM ac3_issuers WHERE id=? AND org_id=? AND environment=?',
      [request.issuer_id, a.org, a.environment],
    );
    if (
      !i ||
      i.status !== 'approved_sandbox' ||
      !JSON.parse(i.types).includes(request.type)
    )
      fail(403, 'Approved issuer type authority required');
    const holder: Access = { ...a, org: request.org_id };
    const passport = (await list(holder, 'passport'))[0];
    if (!passport) fail(409, 'Holder passport missing');
    const evidence = [];
    for (const id of request.evidence_ids) {
      const e = await get(holder, id, 'evidence');
      if (
        e.status !== 'active' ||
        !(await (await import('./domain')).sourceCurrent(holder, e))
      )
        fail(
          409,
          'Source evidence expired or changed; refresh evidence and authorization',
        );
      const prior = request.evidence.find((v: any) => v.id === id);
      if (
        !prior ||
        prior.source_hash !== e.source_hash ||
        prior.assurance_level !== e.assurance_level
      )
        fail(409, 'Evidence changed; request authorization again');
      evidence.push(e);
    }
    const allowed: Record<string, string[]> = {
      BusinessIdentityCredential: ['profile'],
      BusinessRegistrationReviewCredential: ['profile'],
      PaymentActivityCredential: ['payment'],
      TradingHistoryCredential: ['order'],
      InvoiceSettlementCredential: ['invoice'],
      DeliveryCompletionCredential: ['shipment'],
      SupplierRelationshipCredential: ['relationship'],
      CustomerRelationshipCredential: ['relationship'],
      BusinessDataCoverageCredential: [
        'profile',
        'payment',
        'invoice',
        'order',
        'shipment',
        'relationship',
      ],
    };
    if (evidence.some((e) => !allowed[request.type].includes(e.source_kind)))
      fail(400, 'Evidence category does not support this credential');
    if (
      request.type === 'TradingHistoryCredential' &&
      evidence.some(
        (e) =>
          e.facts.payment_status !== 'paid' ||
          !['delivered', 'fulfilled'].includes(e.facts.fulfillment_status),
      )
    )
      fail(
        409,
        'Completed paid orders are required for trading-history claims',
      );
    if (
      request.type === 'SupplierRelationshipCredential' &&
      evidence.some((e) => e.facts.relationship !== 'supplier')
    )
      fail(409, 'Supplier relationship evidence required');
    if (
      request.type === 'CustomerRelationshipCredential' &&
      evidence.some((e) => e.facts.relationship !== 'customer')
    )
      fail(409, 'Customer relationship evidence required');
    for (const e of evidence.filter((e) =>
      ['payment', 'invoice', 'order'].includes(e.source_kind),
    )) {
      let requestIds: string[] = [];
      if (e.source_kind === 'payment') {
        const source = await dbGet(
          'SELECT request_id FROM ac_events WHERE id=? AND org_id=? AND environment=?',
          [e.source_id, holder.org, a.environment],
        );
        if (source) requestIds = [source.request_id];
      } else {
        const documents = [e.source_id];
        if (e.source_kind === 'order')
          for (const row of await dbAll(
            "SELECT id,data FROM ac_records WHERE org_id=? AND environment=? AND kind='invoices'",
            [holder.org, a.environment],
          ))
            if (JSON.parse(row.data).order_id === e.source_id)
              documents.push(row.id);
        for (const doc of documents)
          requestIds.push(
            ...(
              await dbAll(
                'SELECT id FROM ac_requests WHERE document_id=? AND org_id=? AND environment=?',
                [doc, holder.org, a.environment],
              )
            ).map((r) => r.id),
          );
      }
      for (const id of requestIds)
        if (
          await dbGet(
            "SELECT id FROM ac_events WHERE request_id=? AND org_id=? AND environment=? AND status='reversed'",
            [id, holder.org, a.environment],
          )
        )
          fail(
            409,
            'Reversed payment evidence requires financial review before credential issuance',
          );
    }
    if (
      request.type === 'BusinessRegistrationReviewCredential' &&
      passport.verification_status !== 'document_reviewed'
    )
      fail(409, 'Manual document review required');
    if (
      request.type === 'InvoiceSettlementCredential' &&
      evidence.some((e) => e.facts.payment_status !== 'paid')
    )
      fail(409, 'Settled invoice evidence required');
    if (
      request.type === 'DeliveryCompletionCredential' &&
      evidence.some((e) => e.facts.status !== 'delivered')
    )
      fail(409, 'Delivery completion evidence required');
    if (
      request.type.endsWith('RelationshipCredential') &&
      evidence.some((e) => e.facts.status !== 'confirmed')
    )
      fail(409, 'Counterparty confirmation required');
    await dbRun('UPDATE ac3_issuers SET next_index=next_index+1 WHERE id=?', [
      i.id,
    ]);
    const counter = await dbGet(
        'SELECT next_index FROM ac3_issuers WHERE id=?',
        [i.id],
      ),
      index = Number(counter.next_index) - 1;
    if (index >= 131072)
      fail(503, 'Status-list capacity reached; operator migration required');
    const id = randomUUID(),
      until = new Date(
        Date.now() + request.valid_days * 86400000,
      ).toISOString(),
      level = Math.min(...evidence.map((e) => e.assurance_level));
    const facts = evidence.map((e) => e.facts),
      dates = facts
        .map((f) => f.occurred_at)
        .filter(Boolean)
        .sort();
    const period = {
      from: dates[0] || request.authorized_at,
      to: dates[dates.length - 1] || request.authorized_at,
    };
    let summary: any = { recorded_evidence_count: evidence.length, period };
    if (request.type === 'BusinessIdentityCredential')
      summary = {
        display_name: passport.display_name,
        country: passport.country,
        identity_status: passport.verification_status,
        representative_authority: passport.representative_authority,
      };
    if (request.type === 'BusinessRegistrationReviewCredential')
      summary = {
        review_result: 'document_reviewed',
        jurisdiction: passport.country,
        registry_source_verified: false,
        representative_authority: 'not_independently_verified',
      };
    if (request.type === 'PaymentActivityCredential') {
      const totals: Record<string, number> = {};
      for (const f of facts)
        totals[f.currency] = (totals[f.currency] || 0) + f.amount_minor;
      summary = {
        event_count: facts.length,
        totals_minor_by_currency: totals,
        period,
        provider_confirmation: 'sandbox_simulation_only',
      };
    }
    if (request.type === 'InvoiceSettlementCredential')
      summary = {
        settled_invoice_count: facts.length,
        currencies: [...new Set(facts.map((f) => f.currency))],
        period,
        settlement_source: 'recorded_sandbox_allocations',
      };
    if (request.type === 'DeliveryCompletionCredential')
      summary = {
        completed_shipments: facts.length,
        assurance_types: [...new Set(facts.map((f) => f.assurance))],
        period,
        live_courier_verified: false,
      };
    if (request.type.endsWith('RelationshipCredential'))
      summary = {
        confirmed_relationship_count: facts.length,
        relationship_types: [...new Set(facts.map((f) => f.relationship))],
        independence: 'not_independently_verified',
      };
    if (request.type === 'BusinessDataCoverageCredential')
      summary = {
        categories: [...new Set(evidence.map((e) => e.source_kind))],
        source_verified_count: evidence.filter((e) => e.assurance_level >= 2)
          .length,
        observed_at: now(),
      };
    const vc: any = {
      '@context': context(),
      id: 'urn:uuid:' + id,
      type: ['VerifiableCredential', request.type],
      issuer: 'urn:uuid:' + i.id,
      validFrom: now(),
      validUntil: until,
      credentialSubject: {
        id: passport.subject,
        displayName: passport.display_name,
        country: passport.country,
        evidence: {
          schema_version: '1.0',
          claim_summary: summary,
          evidence_count: evidence.length,
          source_categories: [...new Set(evidence.map((e) => e.source_kind))],
          assurance_level: level,
          method: 'sandbox_review_of_authorized_records',
          limitations:
            'Sandbox evidence and issuer only. A valid signature is not proof of business reliability or institutional authority.',
          coverage: 'minimal_claims_no_raw_financial_records',
        },
      },
      credentialSchema: {
        id: origin() + '/api/v1/trust/schemas/' + request.type,
        type: 'JsonSchema',
      },
      credentialStatus: ['revocation', 'suspension'].map((p) => ({
        id: origin() + '/api/v1/trust/status/' + i.id + '/' + p + '#' + index,
        type: 'BitstringStatusListEntry',
        statusPurpose: p,
        statusListIndex: String(index),
        statusListCredential:
          origin() + '/api/v1/trust/status/' + i.id + '/' + p,
      })),
    };
    const token = await signed(i.id, a.environment, vc),
      header = decodeProtectedHeader(token),
      salt =
        '0x' + (await import('node:crypto')).randomBytes(32).toString('hex'),
      commitment = commitmentFor(token, salt);
    await dbRun(
      'INSERT INTO ac3_credentials(id,org_id,environment,issuer_id,key_id,schema_id,status,status_index,token_sealed,salt_sealed,commitment,fingerprint,valid_until,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        id,
        holder.org,
        a.environment,
        i.id,
        header.kid,
        request.type,
        'active',
        index,
        seal(token),
        seal(salt),
        commitment,
        hash(request.id),
        until,
        now(),
      ],
    );
    await change(a, request, { status: 'issued', credential_id: id });
    await audit(holder.org, a.actor, 'credential.issued', id);
    await emit(holder, 'credential.issued', {
      id,
      issuer_id: i.id,
      type: request.type,
      assurance_level: level,
    });
    return credential(holder, id);
  });
}
export async function credential(a: Access, id: string) {
  const r = await dbGet(
    'SELECT * FROM ac3_credentials WHERE id=? AND org_id=? AND environment=?',
    [id, a.org, a.environment],
  );
  if (!r) fail(404, 'Credential not found');
  const token = unseal(r.token_sealed),
    payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );
  return {
    id: r.id,
    type: r.schema_id,
    issuer_id: r.issuer_id,
    status:
      r.status === 'active' && r.valid_until < now() ? 'expired' : r.status,
    valid_until: r.valid_until,
    created_at: r.created_at,
    credential: payload,
    token,
    commitment: r.commitment,
    salt: unseal(r.salt_sealed),
    media_type: 'application/vc+jwt',
  };
}
export async function credentials(a: Access) {
  const rows = await dbAll(
    'SELECT id FROM ac3_credentials WHERE org_id=? AND environment=? ORDER BY created_at DESC',
    [a.org, a.environment],
  );
  return Promise.all(rows.map((r) => credential(a, r.id)));
}
export async function changeStatus(
  a: Access,
  id: string,
  status: string,
  reason: string,
) {
  sandbox(a);
  return atomic(a, async () => {
    const r = await dbGet(
      'SELECT c.* FROM ac3_credentials c JOIN ac3_issuers i ON i.id=c.issuer_id WHERE c.id=? AND i.org_id=? AND c.environment=?',
      [id, a.org, a.environment],
    );
    if (!r) fail(403, 'Issuing organization authority required');
    if (r.status === 'revoked')
      fail(409, 'Revocation is permanent; issue a corrected credential');
    await dbRun('UPDATE ac3_credentials SET status=? WHERE id=?', [status, id]);
    await put(a, 'status_event', {
      credential_id: id,
      status,
      reason,
      at: now(),
    });
    await emit(
      { ...a, org: r.org_id },
      'credential.' + (status === 'active' ? 'resumed' : status),
      { id, issuer_id: r.issuer_id },
    );
    return { id, status };
  });
}
export async function statusList(issuer: string, purpose: string) {
  if (!['revocation', 'suspension'].includes(purpose))
    fail(400, 'Unsupported status purpose');
  const i = await issuerMetadata(issuer),
    bits = Buffer.alloc(16384);
  for (const r of await dbAll(
    'SELECT status,status_index FROM ac3_credentials WHERE issuer_id=?',
    [issuer],
  ))
    if (r.status === (purpose === 'revocation' ? 'revoked' : 'suspended'))
      bits[Math.floor(r.status_index / 8)] |= 1 << (7 - (r.status_index % 8));
  const url = origin() + '/api/v1/trust/status/' + issuer + '/' + purpose;
  const vc = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: url,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: 'urn:uuid:' + issuer,
    validFrom: now(),
    validUntil: new Date(Date.now() + 300000).toISOString(),
    credentialSubject: {
      id: url + '#list',
      type: 'BitstringStatusList',
      statusPurpose: purpose,
      encodedList: 'u' + gzipSync(bits).toString('base64url'),
      ttl: 300000,
    },
  };
  return {
    credential: vc,
    token: await signed(issuer, i.environment, vc),
    media_type: 'application/vc+jwt',
  };
}
export async function verifyCredential(token: string, externalJwk?: any) {
  const report: any = {
    policy: 'africore-minimal-v1',
    verified_at: now(),
    signature: 'invalid',
    schema: 'unchecked',
    issuer_authority: 'unknown',
    key: 'unknown',
    period: 'unchecked',
    status: 'unchecked',
    anchor: 'not_checked',
    evidence_freshness: 'snapshot_at_issuance_not_live_registry',
    holder_binding: 'not_proven_by_bearer_credential',
    overall: 'failed',
    limitations: [
      'Signature validity does not prove the claim true.',
      'Credential disclosure can be copied by a recipient.',
    ],
  };
  try {
    if (token.length > 100000) fail(400, 'Credential too large');
    const header = decodeProtectedHeader(token);
    if (
      header.alg !== 'ES256' ||
      header.typ !== 'vc+jwt' ||
      header.jku ||
      header.x5u
    )
      throw Error('Unsupported JOSE header');
    const key = await dbGet('SELECT * FROM ac3_keys WHERE id=?', [
      header.kid || '',
    ]);
    if (!key && !externalJwk) {
      report.reason =
        'Unknown issuer key; supply a pinned public JWK for cryptographic-only verification';
      return report;
    }
    const jwk = key ? JSON.parse(key.public_jwk) : externalJwk;
    if (jwk.d) throw Error('Public JWK only');
    const result = await compactVerify(token, await importJWK(jwk, 'ES256'), {
      algorithms: ['ES256'],
    });
    report.signature = 'valid';
    const vc = minimalCredential.parse(
      JSON.parse(Buffer.from(result.payload).toString()),
    );
    if (
      new Set(vc.credentialStatus.map((s) => s.statusPurpose)).size !== 2 ||
      Date.parse(vc.validUntil) <= Date.parse(vc.validFrom)
    )
      throw Error('Invalid validity or status profile');
    report.issuer = vc.issuer;
    report.credential_id = vc.id;
    report.type = vc.type?.[1];
    const schema = schemaRegistry.find((s) => s.type === vc.type?.[1]);
    if (
      !schema ||
      !Array.isArray(vc['@context']) ||
      vc['@context'][0] !== 'https://www.w3.org/ns/credentials/v2' ||
      !vc.type.includes('VerifiableCredential') ||
      !vc.credentialSubject?.id ||
      !vc.credentialSubject.evidence ||
      !Number.isFinite(Date.parse(vc.validFrom)) ||
      !Number.isFinite(Date.parse(vc.validUntil))
    )
      throw Error('Unsupported VC structure');
    report.schema = 'supported';
    report.assurance = vc.credentialSubject.evidence.assurance_level;
    report.period =
      Date.parse(vc.validFrom) <= Date.now() &&
      Date.parse(vc.validUntil) > Date.now()
        ? 'current'
        : 'expired_or_not_yet_valid';
    report.key = key?.state || 'externally_supplied_unrecognized';
    if (!key) {
      report.overall = 'requires_review';
      return report;
    }
    if (vc.issuer !== 'urn:uuid:' + key.owner_id)
      throw Error('Issuer/key mismatch');
    const i = await issuerMetadata(key.owner_id);
    report.issuer_authority = i.authority;
    report.issuer_status = i.status;
    const stored = await dbGet(
      'SELECT status,status_index,token_sealed FROM ac3_credentials WHERE id=? AND issuer_id=?',
      [String(vc.id).replace('urn:uuid:', ''), key.owner_id],
    );
    if (stored && unseal(stored.token_sealed) === token)
      report.status = stored.status;
    else report.status = 'unknown';
    report.status_checked_at = now();
    const acceptable =
      report.period === 'current' &&
      report.status === 'active' &&
      ['active', 'retired'].includes(key.state) &&
      ['approved_sandbox', 'approved'].includes(i.status);
    report.overall = acceptable ? 'meets_sandbox_policy' : 'failed';
    return report;
  } catch (error) {
    report.reason = (error as Error).message.slice(0, 200);
    return report;
  }
}
