import { Router } from 'express';
import { z } from 'zod';
import { dbAll, dbGet, dbRun } from '../db';
import { access, route, fail, audit, Access } from '../platform/auth';
import { now, unseal } from '../platform/crypto';
import { atomic } from '../operations/store';
import { emit } from '../operations/events';
import { schemaRegistry, passportInput, credentialTypes } from './contracts';
import {
  flags,
  list,
  get,
  put,
  change,
  operator,
  decode,
  sandbox,
  origin,
} from './store';
import {
  passport,
  createPassport,
  collectEvidence,
  submitIdentity,
  reviewIdentity,
  uploadDocument,
  relationship,
  respondRelationship,
  correction,
} from './domain';
import {
  applyIssuer,
  issuerMetadata,
  reviewIssuer,
  rotateKey,
  requestIssuance,
  issue,
  credential,
  credentials,
  changeStatus,
  statusList,
  verifyCredential,
} from './credentials';
import {
  verificationRequest,
  grant,
  consume,
  revokeGrant,
  verifyPresentation,
} from './sharing';
import { makeBatch, runAnchorQueue, proofFor, verifyProof } from './proofs';
export const trust = Router();
const uuid = (v: unknown) => z.string().uuid().parse(v);
async function admin(req: any) {
  const a = await access(req, 'admin');
  sandbox(a);
  return a;
}
const publicChecks = new Map<string, { count: number; until: number }>();
function bounded(req: any) {
  const key = req.ip || 'unknown',
    current = publicChecks.get(key);
  if (publicChecks.size > 10000) publicChecks.clear();
  if (!current || current.until < Date.now())
    publicChecks.set(key, { count: 1, until: Date.now() + 60000 });
  else if (++current.count > 30) fail(429, 'Verification limit:30/minute');
  if (!flags().public_verification) fail(503, 'Public verification disabled');
}
trust.get(
  '/trust/config',
  route(async (_req, res) => res.json(flags())),
);
trust.get(
  '/trust/schemas',
  route(async (_req, res) =>
    res.json({
      data: schemaRegistry.map((s) => ({
        ...s,
        id: origin() + '/api/v1/trust/schemas/' + s.type,
      })),
    }),
  ),
);
trust.get(
  '/trust/schemas/:type',
  route(async (req, res) => {
    const type = z.enum(credentialTypes).parse(req.params.type);
    res.json({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: type,
      type: 'object',
      required: [
        '@context',
        'id',
        'type',
        'issuer',
        'validFrom',
        'validUntil',
        'credentialSubject',
        'credentialStatus',
      ],
      properties: {
        credentialSubject: {
          type: 'object',
          required: ['id', 'evidence'],
          properties: {
            evidence: {
              type: 'object',
              required: [
                'schema_version',
                'assurance_level',
                'source_categories',
                'limitations',
              ],
              properties: {
                assurance_level: { type: 'integer', minimum: 0, maximum: 3 },
                schema_version: { const: '1.0' },
              },
            },
          },
        },
      },
    });
  }),
);
trust.get(
  '/trust/issuers/:id',
  route(async (req, res) =>
    res.json(await issuerMetadata(uuid(req.params.id))),
  ),
);
trust.get(
  '/trust/status/:issuer/:purpose',
  route(async (req, res) => {
    const status = await statusList(
      uuid(req.params.issuer),
      String(req.params.purpose),
    );
    res.type('application/vc+jwt').send(status.token);
  }),
);
trust.post(
  '/trust/verify',
  route(async (req, res) => {
    bounded(req);
    const d = z
      .object({
        credential: z.string().min(20).max(100000),
        issuer_jwk: z.record(z.string(), z.unknown()).optional(),
      })
      .strict()
      .parse(req.body);
    res.json(await verifyCredential(d.credential, d.issuer_jwk));
  }),
);
trust.post(
  '/trust/verify-presentation',
  route(async (req, res) => {
    bounded(req);
    const d = z
      .object({
        presentation: z.string().min(20).max(900000),
        audience: z.string().min(5).max(200),
        nonce: z.string().min(16).max(200),
      })
      .strict()
      .parse(req.body);
    res.json(await verifyPresentation(d.presentation, d.audience, d.nonce));
  }),
);
trust.post(
  '/trust/verify-proof',
  route(async (req, res) => {
    bounded(req);
    const d = z
      .object({
        credential: z.string().max(100000),
        proof: z
          .object({
            version: z.literal('africore-merkle-v1'),
            salt: z.string().regex(/^0x[a-f0-9]{64}$/),
            commitment: z.string().regex(/^0x[a-f0-9]{64}$/),
            root: z.string().regex(/^0x[a-f0-9]{64}$/),
            proof: z.array(z.string().regex(/^0x[a-f0-9]{64}$/)).max(32),
            batch_ref: z.string().regex(/^0x[a-f0-9]{64}$/),
            chain_id: z.number().nullable(),
            contract_address: z.string().nullable(),
          })
          .passthrough(),
      })
      .strict()
      .parse(req.body);
    res.json(await verifyProof(d.credential, d.proof));
  }),
);
trust.get(
  '/trust/public/:id',
  route(async (req, res) => {
    const row = await dbGet(
      "SELECT * FROM ac3_objects WHERE id=? AND kind='passport'",
      [uuid(req.params.id)],
    );
    if (!row) fail(404, 'Public profile not found');
    const p = decode(row);
    if (!p.public_profile) fail(404, 'Public profile not enabled');
    res.json({
      id: p.id,
      display_name: p.display_name,
      category: p.category,
      industry: p.industry,
      country: p.country,
      verification_status: p.verification_status,
      subject: p.subject,
      disclaimer:
        'Minimal profile approved for public disclosure. No private credentials or trustworthiness guarantee.',
    });
  }),
);
trust.post(
  '/trust/presentations/:token',
  route(async (req, res) =>
    res.json(await consume(req, String(req.params.token))),
  ),
);
trust.get(
  '/organizations/:org/trust/passport',
  route(async (req, res) => res.json(await passport(await access(req)))),
);
trust.post(
  '/organizations/:org/trust/passport',
  route(async (req, res) =>
    res.status(201).json(await createPassport(await admin(req), req.body)),
  ),
);
trust.patch(
  '/organizations/:org/trust/passport',
  route(async (req, res) => {
    const a = await admin(req),
      input = passportInput.partial().parse(req.body);
    res.json(
      await atomic(a, async () => {
        const p = (await list(a, 'passport'))[0];
        if (!p) fail(404, 'Passport not created');
        const d: any = { ...input };
        if (
          (d.display_name && d.display_name !== p.display_name) ||
          (d.country && d.country !== p.country)
        ) {
          d.verification_status = 'not_submitted';
          for (const e of await list(a, 'evidence'))
            if (e.source_kind === 'profile' && e.status === 'active')
              await change(a, e, { status: 'needs_review' });
          const dependent = await dbAll(
            "SELECT id FROM ac3_credentials WHERE org_id=? AND environment=? AND status='active' AND schema_id IN ('BusinessIdentityCredential','BusinessRegistrationReviewCredential')",
            [a.org, a.environment],
          );
          for (const c of dependent) {
            await dbRun(
              "UPDATE ac3_credentials SET status='suspended' WHERE id=?",
              [c.id],
            );
            await emit(a, 'credential.suspended', {
              id: c.id,
              reason: 'passport_identity_changed',
            });
          }
        }
        return change(a, p, d);
      }),
    );
  }),
);
trust.post(
  '/organizations/:org/trust/evidence',
  route(async (req, res) => {
    const a = await admin(req);
    res.status(201).json(await atomic(a, () => collectEvidence(a, req.body)));
  }),
);
trust.post(
  '/organizations/:org/trust/identity-reviews',
  route(async (req, res) => {
    const a = await admin(req);
    res.status(201).json(await atomic(a, () => submitIdentity(a, req.body)));
  }),
);
trust.post(
  '/organizations/:org/trust/documents',
  route(async (req, res) =>
    res.status(201).json(await uploadDocument(await admin(req), req.body)),
  ),
);
trust.get(
  '/organizations/:org/trust/documents/:id/download',
  route(async (req, res) => {
    const a = await access(req, 'admin'),
      d = await get(a, uuid(req.params.id), 'document');
    if (d.retention_until < now()) fail(410, 'Document expired');
    res
      .type('application/octet-stream')
      .attachment(d.filename)
      .send(Buffer.from(d.content_base64, 'base64'));
    await audit(a.org, a.actor, 'trust.document_downloaded', d.id);
  }),
);
trust.get(
  '/organizations/:org/trust/credentials',
  route(async (req, res) =>
    res.json({ data: await credentials(await access(req)) }),
  ),
);
trust.get(
  '/organizations/:org/trust/credentials/:id',
  route(async (req, res) =>
    res.json(await credential(await access(req), uuid(req.params.id))),
  ),
);
trust.post(
  '/organizations/:org/trust/issuance-requests',
  route(async (req, res) => {
    const a = await admin(req);
    res.status(201).json(await atomic(a, () => requestIssuance(a, req.body)));
  }),
);
trust.get(
  '/organizations/:org/trust/issuance-requests',
  route(async (req, res) =>
    res.json({
      data: await list(await access(req, 'admin'), 'issuance_request', true),
    }),
  ),
);
trust.post(
  '/organizations/:org/trust/credentials',
  route(async (req, res) => {
    const a = await admin(req),
      d = z.object({ request_id: z.string().uuid() }).strict().parse(req.body);
    res.status(201).json(await issue(a, d.request_id));
  }),
);
trust.post(
  '/organizations/:org/trust/credentials/:id/status',
  route(async (req, res) => {
    const d = z
      .object({
        status: z.enum(['active', 'suspended', 'revoked']),
        reason: z.string().min(10).max(1000),
      })
      .strict()
      .parse(req.body);
    res.json(
      await changeStatus(
        await admin(req),
        uuid(req.params.id),
        d.status,
        d.reason,
      ),
    );
  }),
);
trust.get(
  '/organizations/:org/trust/credentials/:id/proof',
  route(async (req, res) =>
    res.json(await proofFor(await access(req), uuid(req.params.id))),
  ),
);
trust.get(
  '/organizations/:org/trust/issuers',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    const issuers = await dbAll(
      'SELECT id FROM ac3_issuers WHERE org_id=? AND environment=?',
      [a.org, a.environment],
    );
    res.json({
      data: await Promise.all(issuers.map((i) => issuerMetadata(i.id))),
    });
  }),
);
trust.post(
  '/organizations/:org/trust/issuers',
  route(async (req, res) => {
    const a = await admin(req);
    res.status(201).json(await atomic(a, () => applyIssuer(a, req.body)));
  }),
);
trust.post(
  '/organizations/:org/trust/issuers/:id/rotate',
  route(async (req, res) => {
    const a = await admin(req),
      d = z
        .object({
          compromise: z.boolean(),
          reason: z.string().min(10).max(1000),
        })
        .strict()
        .parse(req.body);
    await audit(a.org, a.actor, 'issuer.rotation_reason', d.reason);
    res.json(
      await atomic(a, () => rotateKey(a, uuid(req.params.id), d.compromise)),
    );
  }),
);
trust.get(
  '/organizations/:org/trust/relationships',
  route(async (req, res) =>
    res.json({ data: await list(await access(req), 'relationship', true) }),
  ),
);
trust.post(
  '/organizations/:org/trust/relationships',
  route(async (req, res) => {
    const a = await admin(req);
    res.status(201).json(await atomic(a, () => relationship(a, req.body)));
  }),
);
trust.post(
  '/organizations/:org/trust/relationships/:id/respond',
  route(async (req, res) => {
    const a = await admin(req);
    res.json(
      await atomic(a, () =>
        respondRelationship(a, uuid(req.params.id), req.body),
      ),
    );
  }),
);
trust.get(
  '/organizations/:org/trust/requests',
  route(async (req, res) =>
    res.json({
      data: await list(await access(req), 'verification_request', true),
    }),
  ),
);
trust.post(
  '/organizations/:org/trust/requests',
  route(async (req, res) =>
    res.status(201).json(await verificationRequest(await admin(req), req.body)),
  ),
);
trust.post(
  '/organizations/:org/trust/requests/:id/reject',
  route(async (req, res) => {
    const a = await admin(req),
      request = await get(a, uuid(req.params.id), 'verification_request', true);
    if (request.peer_org !== a.org || request.status !== 'pending')
      fail(403, 'Holder must reject a pending request');
    res.json(await atomic(a, () => change(a, request, { status: 'rejected' })));
  }),
);
trust.get(
  '/organizations/:org/trust/grants',
  route(async (req, res) => {
    const a = await access(req);
    res.json({
      data: await dbAll(
        'SELECT id,recipient_org,expires_at,revoked_at,consumed_at,one_time,created_at FROM ac3_grants WHERE org_id=? AND environment=?',
        [a.org, a.environment],
      ),
      access: await list(a, 'share_access'),
    });
  }),
);
trust.post(
  '/organizations/:org/trust/grants',
  route(async (req, res) =>
    res.status(201).json(await grant(await admin(req), req.body)),
  ),
);
trust.post(
  '/organizations/:org/trust/grants/:id/revoke',
  route(async (req, res) =>
    res.json(await revokeGrant(await admin(req), uuid(req.params.id))),
  ),
);
trust.get(
  '/organizations/:org/trust/history',
  route(async (req, res) => {
    const a = await access(req);
    res.json({
      data: await dbAll(
        "SELECT id,actor,action,resource_id,created_at FROM ac_audit WHERE org_id=? AND (action LIKE 'trust.%' OR action LIKE 'credential.%' OR action LIKE 'sharing.%' OR action LIKE 'issuer.%') ORDER BY created_at DESC LIMIT 200",
        [a.org],
      ),
    });
  }),
);
trust.post(
  '/organizations/:org/trust/corrections',
  route(async (req, res) => {
    const a = await admin(req);
    res.status(201).json(await atomic(a, () => correction(a, req.body)));
  }),
);
async function operations(req: any) {
  const u = await operator(req);
  return {
    actor: u.id,
    org: 'trust-operations',
    environment: 'sandbox',
    role: 'operator',
    api: false,
  } as Access;
}
trust.get(
  '/internal/trust/operations',
  route(async (req, res) => {
    await operations(req);
    res.json({
      issuers: await dbAll(
        'SELECT id,name,status,types,environment FROM ac3_issuers ORDER BY created_at DESC LIMIT 100',
      ),
      reviews: (
        await dbAll(
          "SELECT * FROM ac3_objects WHERE kind IN ('identity_review','correction') ORDER BY created_at DESC LIMIT 100",
        )
      ).map(decode),
      batches: (
        await dbAll(
          'SELECT id,environment,root,state,data,attempts,created_at FROM ac3_batches ORDER BY created_at DESC LIMIT 100',
        )
      ).map((r) => ({ ...r, data: JSON.parse(unseal(r.data)) })),
      credential_status: await dbAll(
        'SELECT status,COUNT(*) AS count FROM ac3_credentials GROUP BY status',
      ),
      flags: flags(),
      milestones: [
        { id: 'credential_engine', status: 'sandbox' },
        { id: 'local_contract', status: 'test_required' },
        { id: 'openid_interop', status: 'gated' },
        { id: 'production', status: 'gated' },
      ],
      kai: {
        mode: 'read_only_runbook_search',
        autonomous_trust_actions: false,
      },
    });
  }),
);
trust.post(
  '/internal/trust/issuers/:id/review',
  route(async (req, res) => {
    const a = await operations(req);
    res.json(await reviewIssuer(a, uuid(req.params.id), req.body));
  }),
);
trust.post(
  '/internal/trust/identity/:id/review',
  route(async (req, res) => {
    const a = await operations(req),
      row = await dbGet(
        "SELECT org_id FROM ac3_objects WHERE id=? AND kind='identity_review'",
        [uuid(req.params.id)],
      );
    if (!row) fail(404, 'Review not found');
    res.json(
      await atomic({ ...a, org: row.org_id }, () =>
        reviewIdentity(
          { ...a, org: row.org_id },
          String(req.params.id),
          req.body,
        ),
      ),
    );
  }),
);
trust.get(
  '/internal/trust/documents/:id/download',
  route(async (req, res) => {
    const a = await operations(req),
      row = await dbGet(
        "SELECT * FROM ac3_objects WHERE id=? AND kind='document'",
        [uuid(req.params.id)],
      );
    if (!row) fail(404, 'Document not found');
    const d = decode(row);
    if (d.retention_until < now()) fail(410, 'Document expired');
    res
      .type('application/octet-stream')
      .attachment(d.filename)
      .send(Buffer.from(d.content_base64, 'base64'));
    await audit(row.org_id, a.actor, 'trust.document_review_download', d.id);
  }),
);
trust.post(
  '/internal/trust/corrections/:id/resolve',
  route(async (req, res) => {
    const a = await operations(req),
      d = z
        .object({
          decision: z.enum(['uphold', 'reject', 'request_information']),
          reason: z.string().min(10).max(2000),
        })
        .strict()
        .parse(req.body),
      row = await dbGet(
        "SELECT * FROM ac3_objects WHERE id=? AND kind='correction'",
        [uuid(req.params.id)],
      );
    if (!row) fail(404, 'Correction not found');
    const owner = { ...a, org: row.org_id };
    res.json(
      await atomic(owner, async () => {
        const record = await get(owner, String(req.params.id), 'correction');
        if (record.status === 'resolved')
          fail(409, 'Correction already resolved');
        if (d.decision === 'uphold') {
          if (record.target_kind === 'evidence') {
            const e = await get(owner, record.resource_id, 'evidence');
            await change(owner, e, { status: 'disputed' });
            for (const request of await list(owner, 'issuance_request'))
              if (
                request.credential_id &&
                request.evidence_ids.includes(e.id)
              ) {
                await dbRun(
                  "UPDATE ac3_credentials SET status='suspended' WHERE id=? AND org_id=? AND status='active'",
                  [request.credential_id, owner.org],
                );
                await emit(owner, 'credential.suspended', {
                  id: request.credential_id,
                  reason: 'source_evidence_disputed',
                });
              }
          } else {
            await dbRun(
              "UPDATE ac3_credentials SET status='suspended' WHERE id=? AND org_id=? AND status!='revoked'",
              [record.resource_id, owner.org],
            );
            await emit(owner, 'credential.suspended', {
              id: record.resource_id,
              reason: 'correction_review',
            });
          }
        }
        return change(owner, record, {
          status:
            d.decision === 'request_information'
              ? 'additional_information_required'
              : 'resolved',
          decision: d.decision,
          reason: d.reason,
          history: [
            ...record.history,
            { status: d.decision, actor: a.actor, reason: d.reason, at: now() },
          ],
        });
      }),
    );
  }),
);
trust.post(
  '/internal/trust/batches',
  route(async (req, res) => {
    const a = await operations(req);
    res.status(201).json(await makeBatch(a));
  }),
);
trust.post(
  '/internal/trust/anchors/process',
  route(async (req, res) => {
    await operations(req);
    res.json(await runAnchorQueue());
  }),
);

trust.get(
  '/organizations/:org/trust/sources',
  route(async (req, res) => {
    const a = await access(req),
      org = await dbGet('SELECT name FROM ac_organizations WHERE id=?', [
        a.org,
      ]);
    const records = await dbAll(
      "SELECT id,kind,data FROM ac_records WHERE org_id=? AND environment=? AND kind IN ('invoices','orders') ORDER BY created_at DESC LIMIT 100",
      [a.org, a.environment],
    );
    const payments = await dbAll(
      "SELECT id,provider_ref FROM ac_events WHERE org_id=? AND environment=? AND status='succeeded' ORDER BY created_at DESC LIMIT 100",
      [a.org, a.environment],
    );
    const shipments = await (
      await import('../operations/store')
    ).all(a, 'shipments');
    const relations = await list(a, 'relationship', true);
    const data = [
      { kind: 'profile', id: a.org, label: org.name },
      ...records.map((r) => ({
        kind: r.kind === 'invoices' ? 'invoice' : 'order',
        id: r.id,
        label: JSON.parse(r.data).reference,
      })),
      ...payments.map((r) => ({
        kind: 'payment',
        id: r.id,
        label: r.provider_ref,
      })),
      ...shipments.map((r) => ({
        kind: 'shipment',
        id: r.id,
        label: r.tracking_reference,
      })),
      ...relations
        .filter((r) => r.status === 'confirmed')
        .map((r) => ({
          kind: 'relationship',
          id: r.id,
          label: r.relationship,
        })),
    ];
    res.json({ data: data.map((d) => ({ ...d, key: d.kind + ':' + d.id })) });
  }),
);
trust.get(
  '/organizations/:org/trust/credentials/:id/export',
  route(async (req, res) => {
    const a = await access(req),
      c = await credential(a, uuid(req.params.id));
    res.json({
      profile: 'VC2-JOSE-ES256-minimal-v1',
      credential: c.token,
      issuer_metadata: await issuerMetadata(c.issuer_id),
      status_lists: {
        revocation: (await statusList(c.issuer_id, 'revocation')).token,
        suspension: (await statusList(c.issuer_id, 'suspension')).token,
      },
      proof: await proofFor(a, c.id),
      exported_at: now(),
      status_freshness:
        'Refresh status lists after their signed validity period; offline snapshots do not establish future status.',
    });
  }),
);

trust.post(
  '/internal/trust/batches/:id/retry',
  route(async (req, res) => {
    await operations(req);
    const id = uuid(req.params.id),
      result = await dbRun(
        "UPDATE ac3_batches SET state='retrying',attempts=0,next_at=? WHERE id=? AND state='failed'",
        [now(), id],
      );
    if (!result.changes) fail(409, 'Only failed batches may be retried');
    res.json({ id, state: 'retrying' });
  }),
);

trust.post(
  '/organizations/:org/trust/issuance-requests/:id/cancel',
  route(async (req, res) => {
    const a = await admin(req),
      r = await get(a, uuid(req.params.id), 'issuance_request');
    if (r.status !== 'pending')
      fail(409, 'Only pending authorization can be cancelled');
    res.json(
      await atomic(a, () =>
        change(a, r, { status: 'cancelled', cancelled_at: now() }),
      ),
    );
  }),
);

trust.post(
  '/organizations/:org/trust/verify',
  route(async (req, res) => {
    bounded(req);
    const a = await access(req),
      d = z
        .object({
          credential_id: z.string().uuid(),
          verify_anchor: z.boolean().default(false),
        })
        .strict()
        .parse(req.body),
      c = await credential(a, d.credential_id),
      report = await verifyCredential(c.token);
    if (d.verify_anchor) {
      const proof = await proofFor(a, c.id);
      report.anchor =
        proof.status === 'not_batched'
          ? 'not_batched'
          : await verifyProof(c.token, proof);
      if (
        typeof report.anchor === 'object' &&
        !report.anchor.onchain &&
        report.overall === 'meets_sandbox_policy'
      )
        report.overall = 'requires_review';
    }
    report.anchor_policy = 'Optional unless required by the verifier policy';
    await atomic(a, async () => {
      await put(a, 'verification_result', report);
      await emit(
        a,
        report.overall === 'failed'
          ? 'verification.failed'
          : 'verification.completed',
        { id: c.id, outcome: report.overall },
      );
    });
    res.json(report);
  }),
);
trust.get(
  '/organizations/:org/trust/reports',
  route(async (req, res) =>
    res.json({ data: await list(await access(req), 'verification_result') }),
  ),
);
