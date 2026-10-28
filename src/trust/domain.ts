import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { dbAll, dbGet, dbRun } from '../db';
import { Access, audit, fail } from '../platform/auth';
import { hash, now } from '../platform/crypto';
import { atomic } from '../operations/store';
import { record } from '../platform/payments';
import { emit } from '../operations/events';
import {entitlement,recordUsage,raiseAlerts} from '../marketplace/engine';
import {
  passportInput,
  evidenceInput,
  identityInput,
  relationshipInput,
} from './contracts';
import { list, get, put, change, sandbox, organization } from './store';
import { newKey, credentials } from './credentials';
export async function passport(a: Access) {
  const p = (await list(a, 'passport'))[0];
  if (!p) return { passport: null };
  const [evidence, creds, relations, requests, grants] = await Promise.all([
    list(a, 'evidence'),
    credentials(a),
    list(a, 'relationship', true),
    list(a, 'verification_request', true),
    dbAll(
      'SELECT id,recipient_org,expires_at,revoked_at,consumed_at,one_time,created_at FROM ac3_grants WHERE org_id=? AND environment=?',
      [a.org, a.environment],
    ),
  ]);
  return {
    passport: p,
    credentials: creds.map(({ token, salt, credential, ...c }) => ({
      ...c,
      claims: credential.credentialSubject,
    })),
    evidence,
    relationships: relations,
    requests,
    grants,
    index: evidenceIndex(evidence, relations),
    identity_reviews: await list(a, 'identity_review'),
    disputes: await list(a, 'correction'),
    privacy: {
      public_profile: p.public_profile,
      raw_financial_records_public: false,
      selective_disclosure: 'minimal_signed_credentials_only',
      copy_limitation:
        'Revoking future access cannot erase copies already disclosed.',
    },
  };
}
export async function createPassport(a: Access, input: unknown) {
  sandbox(a);
  return atomic(a, async () => {
    if ((await list(a, 'passport')).length)
      fail(409, 'Passport already exists');
    const d = passportInput.parse(input),
      id = randomUUID(),
      p = await put(
        a,
        'passport',
        {
          ...d,
          subject: 'urn:uuid:' + id,
          verification_status: 'not_submitted',
          representative_authority: 'account_membership_only',
          status: 'active',
        },
        id,
      );
    await newKey(id, a.environment);
    await emit(a, 'passport.created', { id, public_profile: d.public_profile });
    return p;
  });
}
export function evidenceIndex(evidence: any[], relations: any[]) {
  const categories = [
      'profile',
      'payment',
      'order',
      'shipment',
      'relationship',
    ],
    active = evidence.filter(
      (e) =>
        e.status === 'active' &&
        (!e.retention_until || e.retention_until > now()),
    ),
    components = categories.map((category) => ({
      category,
      weight: 20,
      covered:
        active.some((e) => e.source_kind === category) ||
        (category === 'relationship' &&
          relations.some((r) => r.status === 'confirmed')),
      source_verified_count: active.filter(
        (e) => e.source_kind === category && e.assurance_level >= 2,
      ).length,
    }));
  return {
    methodology: 'evidence-coverage-v1',
    value: components.filter((c) => c.covered).length * 20,
    components,
    missing_data: 'Not observed; no adverse inference',
    purpose:
      'Evidence category coverage only; not creditworthiness, trustworthiness, profitability or fraud probability',
    calculated_at: now(),
  };
}
export async function collectEvidence(a: Access, input: unknown) {
  sandbox(a);
  const d = evidenceInput.parse(input);
  let source: any,
    facts: any = {},
    method = 'self_reported_record',
    limitations = 'No authoritative independent source verification.';
  if (d.source_kind === 'profile') {
    if (d.source_id !== a.org)
      fail(403, 'Profile source must be the current organization');
    source = await dbGet(
      'SELECT id,name,profile,verification_status FROM ac_organizations WHERE id=?',
      [a.org],
    );
    facts = {
      country: JSON.parse(source.profile).country,
      display_name: source.name,
      status: source.verification_status,
    };
  } else if (d.source_kind === 'payment') {
    source = await dbGet(
      'SELECT * FROM ac_events WHERE id=? AND org_id=? AND environment=?',
      [d.source_id, a.org, a.environment],
    );
    if (!source || source.status !== 'succeeded')
      fail(400, 'Successful provider event required');
    facts = {
      status: source.status,
      currency: source.currency,
      amount_minor: Number(source.amount_minor),
      occurred_at: source.created_at,
      simulation: a.environment === 'sandbox',
    };
    method = 'sandbox_provider_simulation';
    limitations =
      'Sandbox event; not real provider-verified business activity.';
  } else if (d.source_kind === 'shipment') {
    source = await (
      await import('../operations/store')
    ).get(a, d.source_id, 'shipments');
    facts = {
      status: source.status,
      assurance: source.delivery_assurance,
      occurred_at: source.updated_at,
      quantity: source.items.reduce((n: number, i: any) => n + i.quantity, 0),
    };
    method = source.delivery_assurance;
    limitations =
      'Delivery assurance reflects its recorded reporter; no live courier verification.';
  } else if (d.source_kind === 'relationship') {
    source = await get(a, d.source_id, 'relationship', true);
    if (source.status !== 'confirmed')
      fail(409, 'Authenticated counterparty confirmation required');
    facts = {
      status: source.status,
      relationship: source.relationship,
      independence: 'not_independently_verified',
    };
    method = 'authenticated_counterparty_confirmation';
    limitations =
      'Separate accounts do not prove counterparties are independent or free of collusion.';
  } else {
    source = await record(
      a,
      d.source_id,
      d.source_kind === 'invoice' ? 'invoices' : 'orders',
    );
    facts = {
      status: source.status,
      payment_status: source.payment_status,
      currency: source.currency,
      total_minor: source.total_minor,
      paid_minor: source.paid_minor,
      fulfillment_status: source.fulfillment_status,
      occurred_at: source.issue_date,
    };
    if (d.source_kind === 'invoice' && source.paid_minor === source.total_minor)
      facts.payment_status = 'paid';
  }
  const sourceHash = hash(JSON.stringify(source));
  const old = (await list(a, 'evidence')).find(
    (e) =>
      e.source_kind === d.source_kind &&
      e.source_id === d.source_id &&
      e.source_hash === sourceHash &&
      e.status === 'active',
  );
  if (old) return { ...old, duplicate: true };
  const e = await put(a, 'evidence', {
    ...d,
    source_hash: sourceHash,
    facts,
    assurance_level: 0,
    method,
    limitations,
    status: 'active',
    observed_at: now(),
    retention_until: new Date(Date.now() + 365 * 86400000).toISOString(),
  });
  await put(
    a,
    'index_snapshot',
    evidenceIndex(
      await list(a, 'evidence'),
      await list(a, 'relationship', true),
    ),
  );
  return e;
}
export async function submitIdentity(a: Access, input: unknown) {
  sandbox(a);
  const d = identityInput.parse(input);
  const p = (await list(a, 'passport'))[0];
  if (!p) fail(409, 'Create passport first');
  for (const id of d.evidence_ids) await get(a, id, 'evidence');
  const review = await put(a, 'identity_review', {
    ...d,
    status: 'pending',
    history: [{ status: 'pending', actor: a.actor, at: now() }],
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
  });
  await change(a, p, { verification_status: 'pending' });
  return review;
}
export async function reviewIdentity(a: Access, id: string, input: any) {
  const d = z
    .object({
      decision: z.enum([
        'additional_information_required',
        'document_reviewed',
        'rejected',
        'revoked',
      ]),
      reason: z.string().trim().min(10).max(2000),
    })
    .strict()
    .parse(input);
  const review = await get(a, id, 'identity_review');
  if (
    ![
      'pending',
      'additional_information_required',
      'document_reviewed',
    ].includes(review.status)
  )
    fail(409, 'Identity review closed');
  if (
    d.decision === 'document_reviewed' &&
    !(await list(a, 'document')).some((doc) => doc.review_id === id)
  )
    fail(
      409,
      'Supporting document is required before a document-reviewed decision',
    );
  const updated = await change(a, review, {
    status: d.decision,
    reviewer: a.actor,
    reason: d.reason,
    history: [
      ...review.history,
      { status: d.decision, actor: a.actor, reason: d.reason, at: now() },
    ],
  });
  const p = (await list(a, 'passport'))[0];
  await change(a, p, {
    verification_status: d.decision,
    representative_authority:
      'document_statement_only_not_independently_verified',
  });
  if (d.decision === 'document_reviewed')
    for (const evidenceId of review.evidence_ids) {
      const e = await get(a, evidenceId, 'evidence');
      if (e.source_kind === 'profile')
        await change(a, e, {
          assurance_level: 1,
          method: 'manual_document_review',
          limitations:
            'Reviewed documentation only; not government registry verification or independent representative authority.',
        });
    }
  if(['document_reviewed','rejected'].includes(d.decision)&&(await entitlement(a,'verification'))?.status==='active'){
    await recordUsage(a,'verification','identity-review:'+review.id,1,'manual_review_completed');await raiseAlerts(a);
  }
  return updated;
}
export async function uploadDocument(a: Access, input: any) {
  sandbox(a);
  const d = z
    .object({
      review_id: z.string().uuid(),
      filename: z.string().regex(/^[a-zA-Z0-9_. -]{1,120}$/),
      content_type: z.enum([
        'application/pdf',
        'image/png',
        'image/jpeg',
        'text/plain',
      ]),
      content_base64: z.string().max(340000),
    })
    .strict()
    .parse(input);
  const review = await get(a, d.review_id, 'identity_review');
  if (!['pending', 'additional_information_required'].includes(review.status))
    fail(409, 'Document submission window closed');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(d.content_base64))
    fail(400, 'Invalid Base64 encoding');
  const b = Buffer.from(d.content_base64, 'base64');
  if (!b.length || b.length > 250000)
    fail(400, 'Document must be at most250KB');
  if (
    d.content_type === 'application/pdf' &&
    b.subarray(0, 5).toString() !== '%PDF-'
  )
    fail(400, 'Invalid PDF');
  if (
    d.content_type === 'image/png' &&
    b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
  )
    fail(400, 'Invalid PNG');
  if (
    d.content_type === 'image/jpeg' &&
    b.subarray(0, 3).toString('hex') !== 'ffd8ff'
  )
    fail(400, 'Invalid JPEG');
  const doc = await put(a, 'document', {
    ...d,
    sha256: createHash('sha256').update(b).digest('hex'),
    retention_until: new Date(Date.now() + 365 * 86400000).toISOString(),
  });
  const { content_base64, ...metadata } = doc;
  return metadata;
}
export async function relationship(a: Access, input: any) {
  sandbox(a);
  const d = relationshipInput.parse(input);
  if (d.counterparty_org === a.org)
    fail(400, 'Cannot confirm a relationship with yourself');
  await organization(d.counterparty_org);
  if (
    (await list(a, 'relationship', true)).some(
      (r) =>
        ((r.org_id === a.org && r.peer_org === d.counterparty_org) ||
          (r.peer_org === a.org && r.org_id === d.counterparty_org)) &&
        r.relationship === d.relationship &&
        ['pending', 'confirmed'].includes(r.status),
    )
  )
    fail(409, 'Relationship already requested');
  return put(
    a,
    'relationship',
    {
      ...d,
      status: 'pending',
      requested_by: a.actor,
      history: [{ status: 'pending', actor: a.actor, at: now() }],
    },
    undefined,
    d.counterparty_org,
  );
}
export async function respondRelationship(a: Access, id: string, input: any) {
  sandbox(a);
  const d = z
    .object({
      decision: z.enum(['confirm', 'reject', 'revoke']),
      statement: z.string().min(10).max(1000),
    })
    .strict()
    .parse(input);
  const r = await get(a, id, 'relationship', true);
  if (
    d.decision !== 'revoke' &&
    (r.peer_org !== a.org ||
      r.requested_by === a.actor ||
      r.status !== 'pending')
  )
    fail(403, 'A different authorized counterparty must respond');
  if (
    d.decision === 'confirm' &&
    (await dbGet(
      'SELECT role FROM ac_memberships WHERE user_id=? AND org_id=?',
      [a.actor, r.org_id],
    ))
  )
    fail(
      403,
      'A member of the requesting business cannot independently confirm it',
    );
  if (d.decision === 'revoke' && r.status !== 'confirmed')
    fail(409, 'Only confirmed relationships can be revoked');
  return change(a, r, {
    status:
      d.decision === 'confirm'
        ? 'confirmed'
        : d.decision === 'reject'
          ? 'rejected'
          : 'revoked',
    confirmed_by: d.decision === 'confirm' ? a.actor : r.confirmed_by,
    assurance: 'authenticated_counterparty_not_independent_source',
    history: [
      ...r.history,
      { status: d.decision, statement: d.statement, actor: a.actor, at: now() },
    ],
  });
}
export async function correction(a: Access, input: any) {
  sandbox(a);
  const d = z
    .object({
      resource_id: z.string().uuid(),
      kind: z.enum(['evidence', 'credential']),
      reason: z.string().min(10).max(2000),
      supporting_statement: z.string().max(3000).default(''),
    })
    .strict()
    .parse(input);
  if (d.kind === 'evidence') await get(a, d.resource_id, 'evidence');
  else if (
    !(await dbGet(
      'SELECT id FROM ac3_credentials WHERE id=? AND org_id=? AND environment=?',
      [d.resource_id, a.org, a.environment],
    ))
  )
    fail(404, 'Credential not found');
  return put(a, 'correction', {
    ...d,
    target_kind: d.kind,
    status: 'pending',
    history: [{ status: 'pending', actor: a.actor, at: now() }],
  });
}

export async function sourceCurrent(a: Access, e: any) {
  if (e.retention_until < now()) return false;
  let source: any;
  if (e.source_kind === 'profile')
    source = await dbGet(
      'SELECT id,name,profile,verification_status FROM ac_organizations WHERE id=?',
      [a.org],
    );
  else if (e.source_kind === 'payment')
    source = await dbGet(
      'SELECT * FROM ac_events WHERE id=? AND org_id=? AND environment=?',
      [e.source_id, a.org, a.environment],
    );
  else if (e.source_kind === 'shipment')
    source = await (
      await import('../operations/store')
    ).get(a, e.source_id, 'shipments');
  else if (e.source_kind === 'relationship')
    source = await get(a, e.source_id, 'relationship', true);
  else
    source = await record(
      a,
      e.source_id,
      e.source_kind === 'invoice' ? 'invoices' : 'orders',
    );
  return !!source && hash(JSON.stringify(source)) === e.source_hash;
}
