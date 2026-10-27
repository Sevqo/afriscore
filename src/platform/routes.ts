import { trustEvents } from '../stage3/contracts';
import { stage2Events } from '../stage2/events';
import { Router } from 'express';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { dbAll, dbGet, dbRun, dbTransaction } from '../db';
import { isPostgres } from '../db/adapter';
import { access, audit, fail, route, user } from './auth';
import { currencySchema, documentSchema, roles, totals } from './domain';
import { hash, now, seal, secret } from './crypto';
import {
  deliverWebhooks,
  enqueue,
  mpesaProvider,
  processProviderResult,
  record,
  sandboxProvider,
  save,
  update,
} from './payments';
import { isAllowedWebhookTarget } from '../services/webhookService';
export const platform = Router();
platform.get('/organizations/:org/request-logs',route(async(req,res)=>{
  const a=await access(req,'admin');
  res.json({data:await dbAll('SELECT id,credential_id,method,route,status_code,created_at FROM ac_api_request_logs WHERE org_id=? AND environment=? ORDER BY created_at DESC,id DESC LIMIT 100',[a.org,a.environment]),coverage:'Most recent 100 scoped credential requests; excludes bodies, keys and query strings.'});
}));
platform.get('/organizations/:org/personal-income',route(async(req,res)=>{
  const a=await access(req);
  const w=await dbGet("SELECT id FROM ac_workspaces WHERE id=? AND kind='personal'",[a.org]);
  if(!w) fail(403,'Personal workspace required');
  res.json({data:await dbAll('SELECT * FROM ac_personal_income WHERE workspace_id=? AND environment=? ORDER BY occurred_on DESC,id DESC LIMIT 100',[a.org,a.environment]),source:'manually_recorded'});
}));
platform.post('/organizations/:org/personal-income',route(async(req,res)=>{
  const a=await access(req,'finance');
  if(a.api || !await dbGet("SELECT id FROM ac_workspaces WHERE id=? AND kind='personal'",[a.org])) fail(403,'Personal session required');
  const d=z.object({description:z.string().trim().min(1).max(300),amount_minor:z.number().int().positive().max(100000000000),currency:currencySchema,occurred_on:z.string().date()}).strict().parse(req.body);
  const id=randomUUID();
  await dbTransaction(async()=>{
    await dbRun('INSERT INTO ac_personal_income(id,workspace_id,environment,description,amount_minor,currency,occurred_on,created_at,actor) VALUES (?,?,?,?,?,?,?,?,?)',[id,a.org,a.environment,d.description,d.amount_minor,d.currency,d.occurred_on,now(),a.actor]);
    await audit(a.org,a.actor,'personal_income.recorded',id);
  });
  res.status(201).json({id,...d,source:'manually_recorded',provider_verified:false});
}));
platform.get('/organizations/:org/personal-summary',route(async(req,res)=>{
  const a=await access(req);
  if(!await dbGet("SELECT id FROM ac_workspaces WHERE id=? AND kind='personal'",[a.org])) fail(403,'Personal workspace required');
  const q=z.object({currency:currencySchema.default('KES'),from:z.string().date().optional(),to:z.string().date().optional()}).parse(req.query);
  if(q.from&&q.to&&q.from>q.to) fail(400,'Invalid date range');
  const within=(date:string)=>(!q.from||date>=q.from)&&(!q.to||date<=q.to);
  const sum=(values:number[])=>values.reduce((total,n)=>{if(!Number.isSafeInteger(total+n))fail(409,'Recorded totals exceed the supported range');return total+n;},0);
  const incomes=await dbAll('SELECT * FROM ac_personal_income WHERE workspace_id=? AND environment=? AND currency=?',[a.org,a.environment,q.currency]);
  const expenses=(await dbAll("SELECT data FROM ac2_objects WHERE org_id=? AND environment=? AND kind='expenses'",[a.org,a.environment])).map(r=>JSON.parse(r.data));
  const superseded=new Set(expenses.map(r=>r.supersedes_id).filter(Boolean));
  const expenseRows=await dbAll("SELECT id,data FROM ac2_objects WHERE org_id=? AND environment=? AND kind='expenses'",[a.org,a.environment]);
  const manual=sum(incomes.filter(r=>within(r.occurred_on)).map(r=>Number(r.amount_minor)));
  const out=sum(expenseRows.filter(r=>!superseded.has(r.id)).map(r=>JSON.parse(r.data)).filter(r=>r.currency===q.currency&&within(r.occurred_on)).map(r=>Number(r.amount_minor)));
  const invoices=(await dbAll("SELECT data FROM ac_records WHERE org_id=? AND environment=? AND kind='invoices'",[a.org,a.environment])).map(r=>JSON.parse(r.data));
  res.json({currency:q.currency,environment:a.environment,from:q.from||null,to:q.to||null,manual_income_minor:manual,recorded_expenses_minor:out,recorded_net_minor:manual-out,
    outstanding_invoices_minor:sum(invoices.filter(r=>r.currency===q.currency&&!['draft','voided','paid'].includes(r.status)).map(r=>Math.max(0,r.total_minor-r.paid_minor))),
    coverage:'Manually recorded income and expenses only; net is not a bank balance or profit. Outstanding invoices cover all open dates. Provider payments remain separate payment records.'});
}));
const profileSchema = z.object({
  name: z.string().trim().min(2).max(150),
  business_type: z.string().min(2).max(80),
  industry: z.string().max(100),
  country: z.string().length(2).default('KE'),
  location: z.string().max(200),
  currency: currencySchema.default('KES'),
  email: z.string().email(),
  phone: z.string().max(50),
  registration_number: z.string().max(80).optional(),
  tax_id: z.string().max(80).optional(),
  features: z.array(z.string().max(50)).max(20).default([]),
});
platform.get(
  '/organizations',
  route(async (req, res) => {
    const u = await user(req);
    res.json({
      data: await dbAll(
        "SELECT o.*,m.role FROM ac_organizations o JOIN ac_memberships m ON o.id=m.org_id LEFT JOIN ac_workspaces w ON w.id=o.id WHERE m.user_id=? AND (w.kind IS NULL OR w.kind='business')",
        [u.id],
      ),
    });
  }),
);
platform.post(
  '/organizations',
  route(async (req, res) => {
    const u = await user(req),
      p = profileSchema.parse(req.body),
      id = randomUUID();
    await dbTransaction(async () => {
      await dbRun(
        'INSERT INTO ac_organizations(id,name,profile,created_at) VALUES (?,?,?,?)',
        [id, p.name, JSON.stringify(p), now()],
      );
      await dbRun(
        "INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,'owner')",
        [id, u.id],
      );
      await dbRun("INSERT INTO ac_workspaces(id,kind,status,created_at) VALUES (?,'business','active',?)", [id, now()]);
      await audit(id, u.id, 'organization.created', id);
    });
    res.status(201).json({ id, ...p, verification_status: 'unverified' });
  }),
);
platform.patch(
  '/organizations/:org',
  route(async (req, res) => {
    const a = await access(req, 'admin'),
      p = profileSchema.parse(req.body);
    await dbTransaction(async () => {
      await dbRun('UPDATE ac_organizations SET name=?,profile=? WHERE id=?', [
        p.name,
        JSON.stringify(p),
        a.org,
      ]);
      await audit(a.org, a.actor, 'organization.updated', a.org);
    });
    res.json(p);
  }),
);
platform.get(
  '/organizations/:org/team',
  route(async (req, res) => {
    const a = await access(req);
    res.json({
      data: await dbAll(
        'SELECT u.id,u.email,m.role FROM ac_memberships m JOIN ac_users u ON u.id=m.user_id WHERE m.org_id=?',
        [a.org],
      ),
      invitations: await dbAll(
        'SELECT id,email,role,expires_at,accepted_at FROM ac_invitations WHERE org_id=?',
        [a.org],
      ),
    });
  }),
);
platform.post(
  '/organizations/:org/invitations',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    if (a.api) fail(403, 'Session required');
    const d = z
        .object({
          email: z
            .string()
            .email()
            .transform((v) => v.toLowerCase()),
          role: z.enum(['admin', 'finance', 'operations', 'viewer']),
        })
        .parse(req.body),
      token = secret(),
      id = randomUUID();
    await dbRun(
      'INSERT INTO ac_invitations(id,org_id,email,role,token_hash,expires_at) VALUES (?,?,?,?,?,?)',
      [
        id,
        a.org,
        d.email,
        d.role,
        hash(token),
        new Date(Date.now() + 604800000).toISOString(),
      ],
    );
    await audit(a.org, a.actor, 'invitation.created', id);
    res.status(201).json({
      id,
      token,
      message:
        'Share this invitation token with the intended member. No email was sent.',
    });
  }),
);
platform.post(
  '/invitations/accept',
  route(async (req, res) => {
    const u = await user(req),
      token = z.string().length(64).parse(req.body.token);
    await dbTransaction(async () => {
      const row = await dbGet(
        'SELECT * FROM ac_invitations WHERE token_hash=? AND email=? AND accepted_at IS NULL AND expires_at>?',
        [hash(token), u.email, now()],
      );
      if (!row) fail(400, 'Invalid invitation');
      const used = await dbRun(
        'UPDATE ac_invitations SET accepted_at=? WHERE id=? AND accepted_at IS NULL',
        [now(), row.id],
      );
      if (!used.changes) fail(409, 'Already accepted');
      await dbRun(
        'INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,?) ON CONFLICT(org_id,user_id) DO NOTHING',
        [row.org_id, u.id, row.role],
      );
      await audit(row.org_id, u.id, 'invitation.accepted', row.id);
    });
    res.json({ accepted: true });
  }),
);
platform.patch(
  '/organizations/:org/team/:member',
  route(async (req, res) => {
    const a = await access(req, 'admin'),
      role = z.enum(roles).parse(req.body.role);
    if (a.api || a.actor === req.params.member)
      fail(403, 'Cannot change your own role');
    const target = await dbGet(
      'SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',
      [a.org, String(req.params.member)],
    );
    if (
      !target ||
      ((target.role === 'owner' || role === 'owner') && a.role !== 'owner')
    )
      fail(403, 'Owner permission required');
    await dbTransaction(async () => {
      await dbRun(
        'UPDATE ac_memberships SET role=? WHERE org_id=? AND user_id=?',
        [role, a.org, String(req.params.member)],
      );
      await audit(
        a.org,
        a.actor,
        'membership.updated',
        String(req.params.member),
      );
    });
    res.json({ role });
  }),
);
const kinds = [
  'customers',
  'orders',
  'invoices',
  'applications',
  'transactions',
  'integrations',
] as const;
const kindSchema = z.enum(kinds);
platform.get(
  '/organizations/:org/records/:kind',
  route(async (req, res) => {
    const a = await access(req),
      kind = kindSchema.parse(req.params.kind),
      limit = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .parse(req.query.limit),
      offset = z.coerce
        .number()
        .int()
        .min(0)
        .default(0)
        .parse(req.query.offset);
    const q = z.string().trim().max(200).optional().parse(req.query.q),
      status = z.string().max(100).optional().parse(req.query.status);
    const predicates = ['org_id=?', 'environment=?', 'kind=?'];
    const params: (string | number)[] = [a.org, a.environment, kind];
    if (q) {
      // Literal substring search: SQL wildcard characters in user text stay literal.
      predicates.push("LOWER(data || id || created_at) LIKE ? ESCAPE '\\'");
      params.push('%' + q.toLowerCase().replace(/[\\%_]/g, '\\$&') + '%');
    }
    if (status) {
      predicates.push(
        isPostgres
          ? "(data::jsonb ->> 'status')=?"
          : "json_extract(data, '$.status')=?",
      );
      params.push(status);
    }
    const rows = await dbAll(
      'SELECT * FROM ac_records WHERE ' +
        predicates.join(' AND ') +
        ' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?',
      [...params, limit, offset],
    );
    const data = rows.map((r) => ({
      ...JSON.parse(r.data),
      id: r.id,
      kind: r.kind,
      created_at: r.created_at,
    }));
    res.json({ data, limit, offset });
  }),
);
platform.get(
  '/organizations/:org/records/:kind/:id',
  route(async (req, res) =>
    res.json(
      await record(
        await access(req),
        String(req.params.id),
        kindSchema.parse(req.params.kind),
      ),
    ),
  ),
);
platform.post(
  '/organizations/:org/records/:kind',
  route(async (req, res) => {
    const kind = kindSchema.parse(req.params.kind),
      a = await access(
        req,
        kind === 'applications' || kind === 'integrations'
          ? 'admin'
          : kind === 'invoices' || kind === 'transactions'
            ? 'finance'
            : 'operations',
      );
    let d: any;
    const created = await dbTransaction(async () => {
      if (kind === 'customers')
        d = z
          .object({
            name: z.string().trim().min(1).max(200),
            type: z.enum(['individual', 'business']).default('individual'),
            email: z.string().email().or(z.literal('')).default(''),
            phone: z.string().max(50).default(''),
            notes: z.string().max(3000).default(''),
          })
          .parse(req.body);
      else if (kind === 'orders' || kind === 'invoices') {
        const parsed = documentSchema.parse(req.body);
        await record(a, parsed.customer_id, 'customers');
        if (parsed.order_id) {
          if (kind !== 'invoices') fail(400, 'Only invoices may link orders');
          await dbRun('UPDATE ac_organizations SET name=name WHERE id=?', [
            a.org,
          ]);
          const linked = await dbAll(
            "SELECT data FROM ac_records WHERE org_id=? AND environment=? AND kind='invoices'",
            [a.org, a.environment],
          );
          if (
            linked.some(
              (r) =>
                JSON.parse(r.data).order_id === parsed.order_id &&
                JSON.parse(r.data).status !== 'voided',
            )
          )
            fail(409, 'Order already invoiced');
          const order = await record(a, parsed.order_id, 'orders');
          const { all: stage2Objects } = await import('../stage2/store');
          if (
            (await stage2Objects(a, 'protected_sales')).some(
              (s) =>
                s.order_id === order.id &&
                !['cancelled', 'expired'].includes(s.state),
            )
          )
            fail(409, 'Protected orders use the protected purchase workflow');
          if (
            order.paid_minor > 0 ||
            order.payment_status !== 'unpaid' ||
            order.fulfillment_status === 'cancelled'
          )
            fail(409, 'Paid or cancelled order cannot be invoiced');
          if (order.total_minor !== totals(parsed).total_minor)
            fail(400, 'Linked invoice must equal the order total');
          if (
            order.customer_id !== parsed.customer_id ||
            order.currency !== parsed.currency
          )
            fail(400, 'Order and invoice must share customer and currency');
          await dbRun(
            "UPDATE ac_requests SET status='cancelled' WHERE document_id=? AND org_id=? AND environment=? AND status NOT IN ('paid','cancelled')",
            [parsed.order_id, a.org, a.environment],
          );
        }
        d = {
          ...parsed,
          ...totals(parsed),
          reference:
            (kind === 'orders' ? 'ORD' : 'INV') +
            '-' +
            randomUUID().slice(0, 12).toUpperCase(),
          status: 'draft',
          paid_minor: 0,
          ...(kind === 'orders'
            ? { fulfillment_status: 'unfulfilled', payment_status: 'unpaid' }
            : {}),
        };
      } else if (kind === 'applications')
        d = z
          .object({
            name: z.string().min(2).max(100),
            description: z.string().max(500).default(''),
          })
          .parse(req.body);
      else if (kind === 'integrations') {
        d = z
          .object({ provider: z.enum(['csv', 'sandbox', 'africore_pay']) })
          .parse(req.body);
        d = { ...d, status: 'available', authorization_state: 'sandbox_only' };
      } else fail(405, 'Use the transaction import endpoint');
      const saved = await save(a, kind, d);
      if (kind === 'invoices') await enqueue(a, 'invoice.created', saved);
      return saved;
    });
    res.status(201).json(created);
  }),
);
platform.patch(
  '/organizations/:org/records/:kind/:id',
  route(async (req, res) => {
    const kind = kindSchema.parse(req.params.kind),
      a = await access(
        req,
        kind === 'customers' || kind === 'orders'
          ? 'operations'
          : kind === 'applications' || kind === 'integrations'
            ? 'admin'
            : 'finance',
      );
    const updated = await dbTransaction(async () => {
      await dbRun('UPDATE ac_organizations SET name=name WHERE id=?', [a.org]);
      const d = await record(a, String(req.params.id), kind);
      if (kind === 'orders') {
        const { all: stage2Objects } = await import('../stage2/store');
        if (
          (await stage2Objects(a, 'protected_sales')).some(
            (s) =>
              s.order_id === d.id &&
              !['cancelled', 'expired'].includes(s.state),
          )
        )
          fail(
            409,
            'Use the protected purchase and shipment workflows for this order',
          );
      }
      await dbRun(
        'UPDATE ac_records SET updated_at=updated_at WHERE id=? AND org_id=?',
        [d.id, a.org],
      );
      let result: any;
      if (kind === 'customers')
        result = {
          ...d,
          ...z
            .object({
              name: z.string().trim().min(1).max(200).optional(),
              email: z.string().email().or(z.literal('')).optional(),
              phone: z.string().max(50).optional(),
              notes: z.string().max(3000).optional(),
            })
            .strict()
            .parse(req.body),
        };
      else if (kind === 'orders' && req.body.fulfillment_status) {
        const { all: stage2Objects } = await import('../stage2/store');
        if (
          (await stage2Objects(a, 'shipments')).some((s) => s.order_id === d.id)
        )
          fail(
            409,
            'Use the shipment workflow to preserve evidence provenance',
          );
        const status = z
          .enum(['processing', 'fulfilled', 'cancelled'])
          .parse(req.body.fulfillment_status);
        if (
          d.fulfillment_status === 'cancelled' ||
          d.fulfillment_status === 'fulfilled'
        )
          fail(409, 'Fulfillment is final');
        result = { ...d, fulfillment_status: status };
        if (status === 'cancelled')
          await dbRun(
            "UPDATE ac_requests SET status='cancelled' WHERE document_id=? AND org_id=? AND environment=? AND status NOT IN ('paid','cancelled')",
            [d.id, a.org, a.environment],
          );
      } else if ((kind === 'invoices' || kind === 'orders') && req.body.items) {
        if (d.status !== 'draft' || d.order_id)
          fail(409, 'Only unlinked draft documents can be edited');
        const parsed = documentSchema.parse({ ...d, ...req.body });
        if (parsed.order_id)
          fail(
            400,
            'Create linked invoices with the explicit creation workflow',
          );
        await record(a, parsed.customer_id, 'customers');
        result = { ...d, ...parsed, ...totals(parsed) };
      } else if (kind === 'invoices' || kind === 'orders') {
        const status = z
          .enum(['issued', 'awaiting_payment', 'voided', 'cancelled'])
          .parse(req.body.status);
        if (
          d.status !== 'draft' &&
          !(
            ['issued', 'awaiting_payment'].includes(d.status) &&
            ['voided', 'cancelled'].includes(status)
          )
        )
          fail(409, 'Invalid document transition');
        if (
          (kind === 'invoices' && !['issued', 'voided'].includes(status)) ||
          (kind === 'orders' &&
            !['awaiting_payment', 'cancelled'].includes(status))
        )
          fail(400, 'Invalid state');
        if (d.paid_minor > 0)
          fail(409, 'Paid documents require reversal review');
        result = { ...d, status };
        if (['voided', 'cancelled'].includes(status))
          await dbRun(
            "UPDATE ac_requests SET status='cancelled' WHERE document_id=? AND org_id=? AND environment=? AND status NOT IN ('paid','cancelled')",
            [d.id, a.org, a.environment],
          );
        if (status === 'issued')
          await enqueue(a, 'invoice.issued', { id: d.id });
      } else fail(405, 'Unsupported update');
      await update(a, d.id, result);
      await audit(a.org, a.actor, kind + '.updated', d.id);
      return result;
    });
    res.json(updated);
  }),
);
platform.post(
  '/organizations/:org/payment-requests',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      d = z.object({ document_id: z.string().uuid() }).parse(req.body),
      idempotency = z
        .string()
        .min(8)
        .max(200)
        .parse(req.headers['idempotency-key']);
    const response = await dbTransaction(async () => {
      await dbRun('UPDATE ac_organizations SET name=name WHERE id=?', [a.org]);
      const previous = await dbGet(
        'SELECT * FROM ac_requests WHERE org_id=? AND environment=? AND idempotency_key=?',
        [a.org, a.environment, idempotency],
      );
      if (previous) {
        if (previous.document_id !== d.document_id)
          fail(409, 'Idempotency key already used with different input');
        return {
          status: 200,
          data: {
            ...previous,
            checkout_hash: undefined,
            checkout_url: null,
            message: 'Checkout secret is shown once; use the original URL.',
          },
        };
      }
      if (a.environment !== 'sandbox') await mpesaProvider.initiate({}, '');
      const doc = await record(a, d.document_id);
      const { all: stage2Objects } = await import('../stage2/store');
      if (
        (await stage2Objects(a, 'protected_sales')).some(
          (s) =>
            [doc.id, doc.order_id].filter(Boolean).includes(s.order_id) &&
            !['cancelled', 'expired'].includes(s.state),
        )
      )
        fail(409, 'Use the protected-payment workflow for this order');
      if (
        !['invoices', 'orders'].includes(doc.kind) ||
        !['issued', 'partially_paid', 'awaiting_payment'].includes(doc.status)
      )
        fail(409, 'Issue the document first');
      if (doc.kind === 'orders' && doc.fulfillment_status === 'cancelled')
        fail(409, 'Order is cancelled');
      // Pay against invoice when an order is invoiced; prevent double collection through both documents.
      if (doc.kind === 'orders') {
        const invoices = await dbAll(
          "SELECT data FROM ac_records WHERE org_id=? AND environment=? AND kind='invoices'",
          [a.org, a.environment],
        );
        if (
          invoices.some(
            (r) =>
              JSON.parse(r.data).order_id === doc.id &&
              JSON.parse(r.data).status !== 'voided',
          )
        )
          fail(409, 'Collect against the linked invoice');
      }
      const id = randomUUID(),
        token = secret(),
        amount = doc.total_minor - doc.paid_minor,
        expires = new Date(Date.now() + 86400000).toISOString();
      await dbRun(
        'INSERT INTO ac_requests(id,org_id,environment,document_id,amount_minor,currency,status,checkout_hash,idempotency_key,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [
          id,
          a.org,
          a.environment,
          doc.id,
          amount,
          doc.currency,
          'pending',
          hash(token),
          idempotency,
          expires,
          now(),
        ],
      );
      await enqueue(a, 'payment.pending', { request_id: id });
      await audit(a.org, a.actor, 'payment_request.created', id);
      return {
        status: 201,
        data: {
          id,
          amount_minor: amount,
          currency: doc.currency,
          status: 'pending',
          checkout_url: '/checkout/' + token,
          expires_at: expires,
          environment: a.environment,
        },
      };
    });
    // Publish the checkout only after its transaction is committed.
    res.status(response.status).json(response.data);
  }),
);
platform.get(
  '/checkout/:token',
  route(async (req, res) => {
    const token = z.string().length(64).parse(req.params.token),
      r = await dbGet('SELECT * FROM ac_requests WHERE checkout_hash=?', [
        hash(token),
      ]);
    if (!r) fail(404, 'Checkout not found');
    const org = await dbGet('SELECT name FROM ac_organizations WHERE id=?', [
      r.org_id,
    ]);
    const doc = await dbGet(
      'SELECT data FROM ac_records WHERE id=? AND org_id=?',
      [r.document_id, r.org_id],
    );
    const d = JSON.parse(doc.data);
    res.json({
      id: r.id,
      merchant: org.name,
      reference: d.reference,
      items: d.items,
      amount_minor: Number(r.amount_minor),
      currency: r.currency,
      environment: r.environment,
      status:
        r.expires_at < now() && r.status !== 'paid' ? 'expired' : r.status,
      methods: r.environment === 'sandbox' ? ['sandbox'] : [],
    });
  }),
);
platform.post(
  '/checkout/:token/pay',
  route(async (req, res) => {
    const token = z.string().length(64).parse(req.params.token),
      scenario = z
        .enum([
          'success',
          'failed',
          'delayed',
          'partial',
          'duplicate',
          'reversed',
        ])
        .parse(req.body.scenario);
    const r = await dbGet('SELECT * FROM ac_requests WHERE checkout_hash=?', [
      hash(token),
    ]);
    if (!r) fail(404, 'Checkout not found');
    if (r.environment !== 'sandbox') fail(503, 'Production checkout disabled');
    if (r.expires_at < now() || ['cancelled', 'expired'].includes(r.status))
      fail(410, 'Payment request closed');
    if (scenario === 'reversed' && r.status !== 'paid')
      fail(409, 'No completed payment to reverse');
    const result = await sandboxProvider.initiate(r, scenario);
    res.json(await processProviderResult(r.id, result));
  }),
);
platform.post(
  '/callbacks/:provider',
  route(async (req, res) => {
    if (req.params.provider !== 'sandbox')
      fail(503, 'No verified live callback adapter is enabled');
    const key = process.env.AFRICORE_SANDBOX_CALLBACK_SECRET;
    if (!key || key.length < 32)
      fail(503, 'Sandbox callback signing key is not configured');
    const timestamp = z
      .string()
      .regex(/^\d{10}$/)
      .parse(req.headers['africore-timestamp']);
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
      fail(401, 'Expired callback signature');
    const signature = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(req.headers['africore-signature']);
    const expected = createHmac('sha256', key!)
      .update(timestamp + '.' + (req as any).rawBody)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      fail(401, 'Invalid callback signature');
    const d = z
      .object({
        request_id: z.string().uuid(),
        reference: z.string().min(1).max(200),
        status: z.enum(['pending', 'succeeded', 'failed', 'reversed']),
        amount_minor: z.number().int().positive().max(100000000000),
        currency: currencySchema,
      })
      .parse(req.body);
    const r = await dbGet('SELECT environment FROM ac_requests WHERE id=?', [
      d.request_id,
    ]);
    if (!r || r.environment !== 'sandbox') fail(403, 'Sandbox requests only');
    res.json(await processProviderResult(d.request_id, d));
  }),
);
platform.get(
  '/organizations/:org/payments',
  route(async (req, res) => {
    const a = await access(req);
    res.json({
      data: await dbAll(
        'SELECT id,document_id,amount_minor,currency,status,expires_at,created_at FROM ac_requests WHERE org_id=? AND environment=? ORDER BY created_at DESC LIMIT 100',
        [a.org, a.environment],
      ),
      events: await dbAll(
        'SELECT * FROM ac_events WHERE org_id=? AND environment=? ORDER BY created_at DESC LIMIT 100',
        [a.org, a.environment],
      ),
    });
  }),
);
platform.get(
  '/organizations/:org/reconciliation',
  route(async (req, res) => {
    const a = await access(req);
    res.json({
      allocations: await dbAll(
        'SELECT * FROM ac_allocations WHERE org_id=? AND environment=? ORDER BY created_at DESC LIMIT 100',
        [a.org, a.environment],
      ),
      exceptions: await dbAll(
        'SELECT * FROM ac_exceptions WHERE org_id=? AND environment=? ORDER BY created_at DESC LIMIT 100',
        [a.org, a.environment],
      ),
    });
  }),
);
platform.post(
  '/organizations/:org/reconciliation/:id/review',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      note = z.string().min(5).max(1000).parse(req.body.note);
    const changed = await dbRun(
      "UPDATE ac_exceptions SET status='reviewed' WHERE id=? AND org_id=? AND environment=?",
      [String(req.params.id), a.org, a.environment],
    );
    if (!changed.changes) fail(404, 'Exception not found');
    await audit(
      a.org,
      a.actor,
      'reconciliation.reviewed: ' + note,
      String(req.params.id),
    );
    res.json({
      status: 'reviewed',
      message:
        'Review recorded; original provider event and allocation preserved.',
    });
  }),
);
platform.post(
  '/organizations/:org/import',
  route(async (req, res) => {
    const a = await access(req, 'finance'),
      rows = z
        .array(
          z.object({
            external_id: z.string().min(1).max(150),
            amount_minor: z.number().int().positive().max(100000000000),
            currency: currencySchema,
            type: z.enum(['inflow', 'outflow']),
            occurred_at: z.string().datetime(),
            source: z.string().min(1).max(100),
            counterparty: z.string().max(200).default(''),
          }),
        )
        .min(1)
        .max(1000)
        .parse(req.body.rows);
    let imported = 0;
    await dbTransaction(async () => {
      await dbRun('UPDATE ac_organizations SET name=name WHERE id=?', [a.org]);
      for (const r of rows) {
        const id = hash(
          [a.org, a.environment, r.source, r.external_id].join(':'),
        );
        if (await dbGet('SELECT id FROM ac_records WHERE id=?', [id])) continue;
        await save(
          a,
          'transactions',
          {
            ...r,
            provenance: 'merchant_import',
            provider_verified: false,
            imported_at: now(),
            processing_status: 'recorded',
          },
          id,
        );
        imported++;
      }
    });
    res.status(201).json({ imported, duplicates: rows.length - imported });
  }),
);
platform.get(
  '/organizations/:org/report',
  route(async (req, res) => {
    const a = await access(req),
      rows = await dbAll(
        "SELECT * FROM ac_records WHERE org_id=? AND environment=? AND kind IN ('invoices','transactions')",
        [a.org, a.environment],
      );
    const from = z.string().date().optional().parse(req.query.from),
      to = z.string().date().optional().parse(req.query.to),
      currency = currencySchema.default('KES').parse(req.query.currency);
    const customer = z.string().uuid().optional().parse(req.query.customer_id);
    const invoices = rows
      .filter((r) => r.kind === 'invoices')
      .map((r) => ({ ...JSON.parse(r.data), id: r.id }))
      .filter(
        (r) =>
          r.currency === currency &&
          (!customer || r.customer_id === customer) &&
          (!from || r.issue_date >= from) &&
          (!to || r.issue_date <= to),
      );
    const events = await dbAll(
      "SELECT * FROM ac_events WHERE org_id=? AND environment=? AND status='succeeded' AND currency=?",
      [a.org, a.environment, currency],
    );
    const selectedEvents = events.filter(
      (e) =>
        (!from || e.created_at.slice(0, 10) >= from) &&
        (!to || e.created_at.slice(0, 10) <= to),
    );
    const open = invoices.filter(
      (i) => !['draft', 'voided'].includes(i.status),
    );
    const aging = {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_over_90: 0,
    };
    for (const i of open) {
      const days = Math.floor((Date.now() - Date.parse(i.due_date)) / 86400000),
        key =
          days <= 0
            ? 'current'
            : days <= 30
              ? 'days_1_30'
              : days <= 60
                ? 'days_31_60'
                : days <= 90
                  ? 'days_61_90'
                  : 'days_over_90';
      aging[key] += i.total_minor - i.paid_minor;
    }
    const imported = rows
      .filter((r) => r.kind === 'transactions')
      .map((r) => JSON.parse(r.data))
      .filter(
        (r) =>
          r.currency === currency &&
          (!from || r.occurred_at.slice(0, 10) >= from) &&
          (!to || r.occurred_at.slice(0, 10) <= to),
      );
    const outflows = imported
        .filter((r) => r.type === 'outflow')
        .reduce((s, r) => s + r.amount_minor, 0),
      inflows = selectedEvents.reduce((s, r) => s + Number(r.amount_minor), 0);
    const report = {
      currency,
      environment: a.environment,
      confirmed_inflows_minor: inflows,
      recorded_outflows_minor: outflows,
      net_recorded_movement_minor: inflows - outflows,
      outstanding_minor: open.reduce(
        (s, i) => s + i.total_minor - i.paid_minor,
        0,
      ),
      overdue_minor: open
        .filter((i) => i.due_date < now().slice(0, 10))
        .reduce((s, i) => s + i.total_minor - i.paid_minor, 0),
      aging,
      invoices,
      events: selectedEvents,
      methodology:
        'Confirmed provider events and merchant-recorded outflows. Not profit, custody balances or complete bank cash flow. Currency buckets never combined. Customer filter applies to receivables only.',
    };
    if (req.query.format === 'csv') {
      const cell = (v: any) =>
        '"' +
        String(v ?? '')
          .replace(/^[=+@\-\t\r]/, "'")
          .replace(/"/g, '""') +
        '"';
      res
        .type('text/csv')
        .attachment('africore-receivables.csv')
        .send(
          [
            'reference,customer_id,currency,total_minor,paid_minor,due_date,status',
            ...invoices.map((i) =>
              [
                i.reference,
                i.customer_id,
                i.currency,
                i.total_minor,
                i.paid_minor,
                i.due_date,
                i.status,
              ]
                .map(cell)
                .join(','),
            ),
          ].join('\r\n'),
        );
      return;
    }
    res.json(report);
  }),
);
platform.post(
  '/organizations/:org/credentials',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    if (a.api) fail(403, 'Session required');
    const d = z
      .object({
        application_id: z.string().uuid(),
        scopes: z.array(z.enum(['read', 'finance', 'operations'])).min(1),
      })
      .parse(req.body);
    await record(a, d.application_id, 'applications');
    const value = 'ac_' + secret(),
      id = randomUUID();
    await dbRun(
      'INSERT INTO ac_credentials(id,org_id,application_id,environment,key_hash,scopes,created_at) VALUES (?,?,?,?,?,?,?)',
      [
        id,
        a.org,
        d.application_id,
        a.environment,
        hash(value),
        JSON.stringify(d.scopes),
        now(),
      ],
    );
    await audit(a.org, a.actor, 'credential.created', id);
    res.status(201).json({ id, key: value, display_once: true });
  }),
);
platform.get(
  '/organizations/:org/credentials',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    res.json({
      data: await dbAll(
        'SELECT id,application_id,environment,scopes,created_at,revoked_at FROM ac_credentials WHERE org_id=? AND environment=?',
        [a.org, a.environment],
      ),
    });
  }),
);
platform.delete(
  '/organizations/:org/credentials/:id',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    const changed = await dbRun(
      'UPDATE ac_credentials SET revoked_at=? WHERE id=? AND org_id=? AND environment=?',
      [now(), String(req.params.id), a.org, a.environment],
    );
    if (!changed.changes) fail(404, 'Credential not found');
    await audit(a.org, a.actor, 'credential.revoked', String(req.params.id));
    res.json({ revoked: true });
  }),
);
const subscriptions = [
  ...stage2Events,
  ...trustEvents,
  'invoice.created',
  'invoice.issued',
  'invoice.paid',
  'payment.pending',
  'payment.succeeded',
  'payment.failed',
  'reconciliation.exception_created',
] as const;
platform.post(
  '/organizations/:org/webhooks',
  route(async (req, res) => {
    const a = await access(req, 'admin'),
      d = z
        .object({
          url: z.string().url(),
          subscriptions: z.array(z.enum(subscriptions)).min(1),
        })
        .parse(req.body);
    if (!isAllowedWebhookTarget(d.url))
      fail(400, 'HTTPS public webhook target required');
    const value = secret(),
      id = randomUUID();
    await dbRun(
      'INSERT INTO ac_endpoints(id,org_id,environment,url,secret,subscriptions,created_at) VALUES (?,?,?,?,?,?,?)',
      [
        id,
        a.org,
        a.environment,
        d.url,
        seal(value),
        JSON.stringify(d.subscriptions),
        now(),
      ],
    );
    await audit(a.org, a.actor, 'webhook.created', id);
    res.status(201).json({ id, secret: value, display_once: true });
  }),
);
platform.get(
  '/organizations/:org/webhooks',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    res.json({
      data: await dbAll(
        'SELECT id,url,environment,subscriptions,created_at FROM ac_endpoints WHERE org_id=? AND environment=?',
        [a.org, a.environment],
      ),
      deliveries: await dbAll(
        'SELECT d.id,d.event_type,d.attempts,d.status,d.last_error,d.created_at FROM ac_deliveries d JOIN ac_endpoints e ON e.id=d.endpoint_id WHERE d.org_id=? AND e.environment=? ORDER BY d.created_at DESC LIMIT 100',
        [a.org, a.environment],
      ),
    });
  }),
);
platform.post(
  '/organizations/:org/webhooks/process',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    res.json(await deliverWebhooks(a.org, undefined, undefined, a.environment));
  }),
);
platform.post(
  '/organizations/:org/webhooks/:id/rotate',
  route(async (req, res) => {
    const a = await access(req, 'admin'),
      value = secret();
    const change = await dbRun(
      'UPDATE ac_endpoints SET secret=? WHERE id=? AND org_id=? AND environment=?',
      [seal(value), String(req.params.id), a.org, a.environment],
    );
    if (!change.changes) fail(404, 'Endpoint not found');
    await audit(a.org, a.actor, 'webhook.rotated', String(req.params.id));
    res.json({ secret: value, display_once: true });
  }),
);
platform.post(
  '/organizations/:org/deliveries/:id/replay',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    const change = await dbRun(
      "UPDATE ac_deliveries SET status='pending',attempts=0,next_at=? WHERE id=? AND org_id=? AND endpoint_id IN (SELECT id FROM ac_endpoints WHERE org_id=? AND environment=?)",
      [now(), String(req.params.id), a.org, a.org, a.environment],
    );
    if (!change.changes) fail(404, 'Delivery not found');
    await audit(a.org, a.actor, 'delivery.replayed', String(req.params.id));
    res.json({ queued: true });
  }),
);
platform.get(
  '/organizations/:org/audit',
  route(async (req, res) => {
    const a = await access(req, 'admin');
    res.json({
      data: await dbAll(
        'SELECT * FROM ac_audit WHERE org_id=? ORDER BY created_at DESC LIMIT 100',
        [a.org],
      ),
    });
  }),
);
platform.get(
  '/internal',
  route(async (req, res) => {
    const u = await user(req);
    const allowed = (process.env.AFRICORE_ENGINEERING_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase());
    if (!u.verified || !allowed.includes(u.email))
      fail(403, 'Engineering access required');
    res.json({
      trailhead: {
        documents: [
          'ARCHITECTURE',
          'DATABASE',
          'SECURITY',
          'PAYMENTS',
          'DEPLOYMENT',
          'IMPLEMENTATION_STATUS',
        ],
        search: '/docs',
      },
      compass: {
        source: 'GitHub',
        milestones: ['Phase 1 foundation', 'Phase 2 sandbox pilot'],
      },
      orbit: { metrics: '/v1/metrics', access: 'operator credential required' },
      kai: {
        status: 'not_configured',
        mode: 'read_only',
        message: 'No model provider configured; approved documentation only.',
      },
    });
  }),
);
