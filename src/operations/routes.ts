import {financialOperation} from '../finance/service';
import { operationalSnapshot } from '../metrics';
import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import { dbAll, dbGet, dbRun } from '../db';
import { access, Access, audit, fail, route, user } from '../platform/auth';
import { now, unseal } from '../platform/crypto';
import { all, atomic, change, create, get, list, safeCSV } from './store';
import {
  analyticsQuery,
  financialSnapshot,
  forecast,
  forecastSchema,
  addExpense,
  obligationSchema,
} from './intelligence';
import {
  automationTemplates,
  createAutomation,
  setAutomation,
  runAutomations,
  notificationPreferences,
  requestApproval,
  decideApproval,
} from './automation';
import {
  addEvidence,
  buyerAccess,
  buyerAction,
  buyerView,
  createSale,
  disputeResolve,
  disputeRespond,
  openDispute,
  sellerSaleAction,
  shipmentCreate,
  shipmentTransition,
} from './commerce';
import {
  connectorAction,
  connectorCatalog,
  connect,
  riskSignals,
  sync,
  importConnectorBatch,
} from './integrations';
import { askAssistant } from './assistant';
import { emit } from './events';
export const operations = Router();
const pagination = (q: any) =>
  z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .parse(q);
const key = (req: any) =>
  z.string().min(8).max(150).parse(req.headers['idempotency-key']);
operations.get(
  '/organizations/:org/intelligence',
  route(async (req, res) => {
    const a = await access(req),
      q = analyticsQuery.parse(req.query),
      snapshot = await financialSnapshot(a, q);
    const { inputs, ...publicData } = snapshot;
    if (req.query.format === 'csv') {
      res
        .type('text/csv')
        .attachment('africore-intelligence.csv')
        .send(
          safeCSV([
            [
              'date',
              'currency',
              'confirmed_inflows_minor',
              'recorded_outflows_minor',
            ],
            ...snapshot.series.map((p) => [
              p.date,
              q.currency,
              p.confirmed_inflows_minor,
              p.recorded_outflows_minor,
            ]),
          ]),
        );
      return;
    }
    res.json(publicData);
  }),
);
operations.post(
  '/organizations/:org/forecasts',
  route(async (req, res) => {
    const a = await access(req),
      input = forecastSchema.parse(req.body),
      result = await forecast(a, input);
    await atomic(a, async () => {
      await create(a,'forecast_snapshots',{forecast:result,configuration:input,captured_at:now(),created_by:a.actor});
      await audit(a.org, a.actor, 'forecast.generated');
      await emit(
        a,
        'cashflow.forecast_updated',
        {
          currency: result.currency,
          horizon: result.horizon,
          scenario: result.scenario,
          classification: 'forecast_estimate',
        },
        { key: 'forecast:' + JSON.stringify(input) + ':' + result.as_of },
      );
    });
    res.json(result);
  }),
);
operations.get(
  '/organizations/:org/expenses',
  route(async (req, res) => {
    const a = await access(req),
      p = pagination(req.query);
    res.json({ data: await list(a, 'expenses', p.limit, p.offset), ...p });
  }),
);
operations.post('/organizations/:org/expenses',route(async(req,res)=>{const a=await access(req,'finance');const run=()=>addExpense(a,req.body);res.status(201).json(req.headers['idempotency-key']?await financialOperation(a,'expense.create',key(req),req.body,run):await run());}));
operations.get(
  '/organizations/:org/obligations',
  route(async (req, res) => {
    const a = await access(req),
      p = pagination(req.query);
    res.json({ data: await list(a, 'obligations', p.limit, p.offset), ...p });
  }),
);
operations.post(
  '/organizations/:org/obligations',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      d = obligationSchema.parse(req.body);
    res.status(201).json(
      await atomic(a, () =>
        create(a, 'obligations', {
          ...d,anchor_day:d.anchor_day||Number(d.next_due_date.slice(8)),
          provenance: 'self_reported',
          classification: 'expected_obligation',
        }),
      ),
    );
  }),
);
operations.patch(
  '/organizations/:org/obligations/:id',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      d = obligationSchema.partial().refine(value=>Object.keys(value).length>0,'Provide an obligation change').parse(req.body);
    res.json(
      await atomic(a, async () =>
        change(a, await get(a, String(req.params.id), 'obligations'), d),
      ),
    );
  }),
);
operations.post(
  '/organizations/:org/assistant',
  route(async (req, res) =>
    res.json(await askAssistant(await access(req), req.body)),
  ),
);
operations.get(
  '/organizations/:org/automations/templates',
  route(async (req, res) => {
    await access(req);
    res.json({
      data: automationTemplates,
      available_actions: ['in_app_notification','create_crm_follow_up','replenishment_suggestion'],
      external_delivery: 'not_configured',
    });
  }),
);
operations.get(
  '/organizations/:org/automations',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      p = pagination(req.query);
    res.json({ data: await list(a, 'automations', p.limit, p.offset), ...p });
  }),
);
operations.post(
  '/organizations/:org/automations',
  route(async (req, res) =>
    res
      .status(201)
      .json(await createAutomation(await access(req, 'finance'), req.body)),
  ),
);
operations.patch(
  '/organizations/:org/automations/:id',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      d = z.object({ enabled: z.boolean() }).strict().parse(req.body);
    res.json(await setAutomation(a, String(req.params.id), d.enabled));
  }),
);
operations.post(
  '/organizations/:org/automations/process',
  route(async (req, res) =>
    res.json(await runAutomations(await access(req, 'finance'))),
  ),
);
operations.get(
  '/organizations/:org/automation-runs',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      p = pagination(req.query);
    res.json({
      data: await dbAll(
        'SELECT * FROM ac2_runs WHERE org_id=? AND environment=? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [a.org, a.environment, p.limit, p.offset],
      ),
      ...p,
    });
  }),
);
operations.get(
  '/organizations/:org/notifications',
  route(async (req, res) => {
    const a = await access(req);
    if (a.api) fail(403, 'Member session required');
    const p = pagination(req.query);
    res.json({
      data: await dbAll(
        'SELECT * FROM ac2_notifications WHERE org_id=? AND environment=? AND user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [a.org, a.environment, a.actor, p.limit, p.offset],
      ),
      preferences: (await all(a, 'notification_preferences')).find(
        (p) => p.user_id === a.actor,
      ) || { paused: false, muted_categories: [] },
      ...p,
    });
  }),
);
operations.patch(
  '/organizations/:org/notifications/:id',
  route(async (req, res) => {
    const a = await access(req);
    if (a.api) fail(403, 'Member session required');
    const changed = await dbRun(
      'UPDATE ac2_notifications SET read_at=? WHERE id=? AND org_id=? AND environment=? AND user_id=?',
      [now(), String(req.params.id), a.org, a.environment, a.actor],
    );
    if (!changed.changes) fail(404, 'Notification not found');
    res.json({ read: true });
  }),
);
operations.put(
  '/organizations/:org/notification-preferences',
  route(async (req, res) =>
    res.json(await notificationPreferences(await access(req), req.body)),
  ),
);
operations.get(
  '/organizations/:org/approvals',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      p = pagination(req.query);
    res.json({
      data: await dbAll(
        'SELECT a.*,b.parameters,b.review_summary,b.resource_hash,b.consumed_at FROM ac2_approvals a LEFT JOIN ac_approval_bindings b ON b.approval_id=a.id WHERE a.org_id=? AND a.environment=? AND (a.requester=? OR a.approver=?) ORDER BY a.created_at DESC LIMIT ? OFFSET ?',
        [a.org, a.environment, a.actor, a.actor, p.limit, p.offset],
      ),
      ...p,
    });
  }),
);
operations.post(
  '/organizations/:org/approvals',
  route(async (req, res) => {
    const a = await access(req, 'finance');
    res.status(201).json(await atomic(a, () => requestApproval(a, req.body)));
  }),
);
operations.post(
  '/organizations/:org/approvals/:id/decide',
  route(async (req, res) =>
    res.json(
      await decideApproval(
        await access(req, 'admin'),
        String(req.params.id),
        req.body,
      ),
    ),
  ),
);
operations.get(
  '/organizations/:org/shipments',
  route(async (req, res) => {
    const a = await access(req),
      p = pagination(req.query);
    res.json({ data: await list(a, 'shipments', p.limit, p.offset), ...p });
  }),
);
operations.post(
  '/organizations/:org/shipments',
  route(async (req, res) =>
    res
      .status(201)
      .json(await shipmentCreate(await access(req, 'operations'), req.body)),
  ),
);
operations.post(
  '/organizations/:org/shipments/:id/transition',
  route(async (req, res) =>
    res.json(
      await shipmentTransition(
        await access(req, 'operations'),
        String(req.params.id),
        req.body,
      ),
    ),
  ),
);
operations.post(
  '/organizations/:org/shipments/:id/evidence',
  route(async (req, res) => {
    const a = await access(req, 'operations');
    res
      .status(201)
      .json(
        await atomic(a, () =>
          addEvidence(a, String(req.params.id), 'shipments', req.body),
        ),
      );
  }),
);
operations.get(
  '/organizations/:org/protected-sales',
  route(async (req, res) => {
    const a = await access(req),
      p = pagination(req.query);
    res.json({
      data: await list(a, 'protected_sales', p.limit, p.offset),
      ...p,
      production_enabled: false,
    });
  }),
);
operations.post(
  '/organizations/:org/protected-sales',
  route(async (req, res) =>
    res
      .status(201)
      .json(await createSale(await access(req, 'finance'), req.body, key(req))),
  ),
);
operations.get(
  '/organizations/:org/protected-sales/:id',
  route(async (req, res) =>
    res.json(
      await get(await access(req), String(req.params.id), 'protected_sales'),
    ),
  ),
);
operations.post(
  '/organizations/:org/protected-sales/:id/action',
  route(async (req, res) =>
    res.json(
      await sellerSaleAction(
        await access(req, 'finance'),
        String(req.params.id),
        req.body,
        key(req),
      ),
    ),
  ),
);
operations.get(
  '/buyer/:token',
  route(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await buyerView(String(req.params.token)));
  }),
);
operations.post(
  '/buyer/:token/action',
  route(async (req, res) =>
    res.json(await buyerAction(String(req.params.token), req.body, key(req))),
  ),
);
operations.post(
  '/buyer/:token/disputes',
  route(async (req, res) =>
    res
      .status(201)
      .json(await openDispute(String(req.params.token), req.body, key(req))),
  ),
);
operations.post(
  '/buyer/:token/disputes/:id/evidence',
  route(async (req, res) => {
    const { a, sale } = await buyerAccess(String(req.params.token)),
      d = await get(a, String(req.params.id), 'disputes');
    if (d.protected_sale_id !== sale.id) fail(404, 'Dispute not found');
    if (d.status === 'resolved' || d.deadline < now())
      fail(409, 'Evidence window is closed');
    res
      .status(201)
      .json(
        await atomic(a, () =>
          addEvidence(a, d.id, 'disputes', req.body, 'buyer_reported'),
        ),
      );
  }),
);
operations.get(
  '/buyer/:token/disputes/:id/evidence',
  route(async (req, res) => {
    const { a, sale } = await buyerAccess(String(req.params.token)),
      d = await get(a, String(req.params.id), 'disputes');
    if (d.protected_sale_id !== sale.id) fail(404, 'Dispute not found');
    res.json({
      data: await dbAll(
        'SELECT id,statement,source,assurance,filename,content_type,sha256,created_at FROM ac2_evidence WHERE org_id=? AND environment=? AND resource_id=? AND retention_until>?',
        [a.org, a.environment, d.id, now()],
      ),
    });
  }),
);
operations.get(
  '/organizations/:org/disputes',
  route(async (req, res) => {
    const a = await access(req),
      p = pagination(req.query);
    res.json({ data: await list(a, 'disputes', p.limit, p.offset), ...p });
  }),
);
operations.post(
  '/organizations/:org/disputes/:id/respond',
  route(async (req, res) =>
    res.json(
      await disputeRespond(
        await access(req, 'operations'),
        String(req.params.id),
        req.body,
      ),
    ),
  ),
);
operations.post(
  '/organizations/:org/disputes/:id/resolve',
  route(async (req, res) =>
    res.json(
      await disputeResolve(
        await access(req, 'admin'),
        String(req.params.id),
        req.body,
        key(req),
      ),
    ),
  ),
);
operations.get(
  '/organizations/:org/evidence/:resource',
  route(async (req, res) => {
    const a = await access(req),
      resource = z.string().uuid().parse(req.params.resource);
    res.json({
      data: await dbAll(
        'SELECT id,resource_id,resource_kind,actor,source,assurance,statement,filename,content_type,sha256,created_at,retention_until FROM ac2_evidence WHERE org_id=? AND environment=? AND resource_id=? AND retention_until>? ORDER BY created_at',
        [a.org, a.environment, resource, now()],
      ),
    });
  }),
);
operations.get(
  '/organizations/:org/evidence/:resource/:id/download',
  route(async (req, res) => {
    const a = await access(req);
    const e = await dbGet(
      'SELECT * FROM ac2_evidence WHERE id=? AND resource_id=? AND org_id=? AND environment=? AND retention_until>?',
      [
        String(req.params.id),
        String(req.params.resource),
        a.org,
        a.environment,
        now(),
      ],
    );
    if (!e || !e.content_base64) fail(404, 'Evidence file not found');
    res.setHeader('Content-Type', 'application/octet-stream');
    res
      .attachment(e.filename)
      .send(Buffer.from(unseal(e.content_base64,JSON.stringify(['evidence',e.org_id,e.environment,e.id])), 'base64'));
    await audit(a.org, a.actor, 'evidence.downloaded', e.id);
  }),
);
operations.get(
  '/organizations/:org/connectors/catalog',
  route(async (req, res) => {
    await access(req);
    res.json({ data: connectorCatalog });
  }),
);
operations.get(
  '/organizations/:org/connectors',
  route(async (req, res) => {
    const a = await access(req),
      p = pagination(req.query);
    res.json({ data: await list(a, 'connectors', p.limit, p.offset), ...p });
  }),
);
operations.post(
  '/organizations/:org/connectors',
  route(async (req, res) =>
    res.status(201).json(await connect(await access(req, 'admin'), req.body)),
  ),
);
operations.post(
  '/organizations/:org/connectors/:id/sync',
  route(async (req, res) =>
    res.json(await sync(await access(req, 'admin'), String(req.params.id))),
  ),
);
operations.post(
  '/organizations/:org/connectors/:id/action',
  route(async (req, res) =>
    res.json(
      await connectorAction(
        await access(req, 'admin'),
        String(req.params.id),
        req.body,
      ),
    ),
  ),
);
operations.get(
  '/organizations/:org/risk-signals',
  route(async (req, res) =>
    res.json(await riskSignals(await access(req, 'admin'))),
  ),
);
operations.post(
  '/organizations/:org/risk-signals/review',
  route(async (req, res) => {
    const a = await access(req, 'admin'),
      d = z
        .object({
          signal_id: z.string().max(100),
          note: z.string().min(5).max(1000),
        })
        .strict()
        .parse(req.body);
    if (!(await riskSignals(a)).signals.some((s) => s.id === d.signal_id))
      fail(404, 'Signal not found');
    res
      .status(201)
      .json(
        await atomic(a, () =>
          create(a, 'risk_reviews', { ...d, reviewer: a.actor, at: now() }),
        ),
      );
  }),
);
const docNames = [
  'STAGE3_PLAN',
  'BUSINESS_PASSPORT',
  'TRUST_NETWORK',
  'CREDENTIAL_ARCHITECTURE',
  'CREDENTIAL_SCHEMAS',
  'ISSUER_GOVERNANCE',
  'VERIFICATION_ENGINE',
  'PRIVACY_AND_SHARING',
  'BLOCKCHAIN_ARCHITECTURE',
  'SMART_CONTRACTS',
  'KEY_MANAGEMENT',
  'PROOF_ANCHORING',
  'COMPLIANCE_GAPS_STAGE3',
  'STAGE3_TEST_RESULTS',
  'STAGE3_SECURITY_REVIEW',
  'DEMO_LOGIN',
  'STAGE2_PLAN',
  'INTELLIGENCE',
  'FORECASTING',
  'AUTOMATIONS',
  'AI_ASSISTANT',
  'PROTECTED_PAYMENTS',
  'DISPUTES',
  'DELIVERY_EVIDENCE',
  'ILLUSTRATION_SYSTEM',
  'COMPLIANCE_GAPS_STAGE2',
  'STAGE2_TEST_RESULTS',
  'ARCHITECTURE',
  'DATABASE',
  'SECURITY',
  'DEPLOYMENT',
];
async function engineer(req: any) {
  const u = await user(req),
    allowed = (process.env.AFRICORE_ENGINEERING_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase());
  if (!u.verified || !allowed.includes(u.email))
    fail(403, 'Verified engineering allowlist required');
  return u;
}
operations.get(
  '/internal/stage2/docs',
  route(async (req, res) => {
    await engineer(req);
    const q = z.string().max(200).default('').parse(req.query.q).toLowerCase();
    const data = [];
    for (const name of docNames) {
      try {
        const text = await fs.readFile(
          path.join(process.cwd(), 'docs', name + '.md'),
          'utf8',
        );
        if (!q || (name + ' ' + text).toLowerCase().includes(q))
          data.push({ name, text: text.slice(0, 18000) });
      } catch {}
    }
    res.json({
      data,
      kai: {
        mode: 'read_only_document_search',
        generative_provider: 'separate_configuration_required',
      },
    });
  }),
);
operations.get(
  '/internal/stage2/operations',
  route(async (req, res) => {
    await engineer(req);
    const rows = await dbAll(
        'SELECT status,COUNT(*) AS total FROM ac2_runs GROUP BY status',
      ),
      ai = await dbAll(
        'SELECT provider,model,status,COUNT(*) AS requests,SUM(input_tokens) AS input_tokens,SUM(output_tokens) AS output_tokens FROM ac2_ai_usage GROUP BY provider,model,status',
      );
    const dbStarted = Date.now();
    await dbGet('SELECT 1 AS ok');
    res.json({
      runtime: operationalSnapshot(),
      database_probe_ms: Date.now() - dbStarted,
      automations: rows,
      ai_usage: ai,
      ai_cost: {
        available: false,
        reason:
          'No verified pricing or billing feed configured; token counts are not costs.',
      },
      deliveries: await dbAll(
        'SELECT status,COUNT(*) AS total FROM ac_deliveries GROUP BY status',
      ),
      approvals: await dbAll(
        'SELECT status,COUNT(*) AS total FROM ac2_approvals GROUP BY status',
      ),
      risk_policy: 'Review signals only; no fraud verdicts.',
      production_protected_payments: false,
    });
  }),
);

operations.post(
  '/organizations/:org/connectors/:id/import',
  route(async (req, res) =>
    res.json(
      await importConnectorBatch(
        await access(req, 'admin'),
        String(req.params.id),
      ),
    ),
  ),
);
