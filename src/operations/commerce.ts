import {
  evidenceSchema,
  shipmentSchema,
  saleSchema,
  disputeSchema,
} from './contracts';
export {
  evidenceSchema,
  shipmentSchema,
  saleSchema,
  disputeSchema,
} from './contracts';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db';
import { Access, audit, fail } from '../platform/auth';
import { currencySchema } from '../platform/domain';
import { hash, now, secret, seal } from '../platform/crypto';
import { record, update, save } from '../platform/payments';
import { atomic, change, create, day, get, all, minor } from './store';
import { emit } from './events';
import { notify, requireApproval } from './automation';
import {quantityMilli} from '../inventory/quantity';
import {dispatchShipmentStock} from '../inventory/service';

const shipmentNext: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['ready_for_dispatch', 'cancelled'],
  ready_for_dispatch: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivery_exception', 'returned'],
  out_for_delivery: ['delivered', 'delivery_exception', 'returned'],
  delivery_exception: ['out_for_delivery', 'returned'],
  delivered: ['returned'],
  returned: [],
  cancelled: [],
};
export async function shipmentCreate(a: Access, input: unknown) {
  const d = shipmentSchema.parse(input);
  return atomic(a, async () => {
    const order = await record(a, d.order_id, 'orders');
    if (
      order.fulfillment_status === 'cancelled' ||
      order.status === 'cancelled'
    )
      fail(409, 'Cancelled order cannot ship');
    if (new Set(d.items.map((i) => i.item_index)).size !== d.items.length)
      fail(400, 'Each order item must appear once per shipment');
    const previous = (await all(a, 'shipments')).filter(
      (s) =>
        s.order_id === order.id &&
        !['cancelled', 'returned'].includes(s.status),
    );
    for (const item of d.items) {
      const line = order.items[item.item_index];
      if (
        !line ||
        quantityMilli(item.quantity) +
          previous.reduce(
            (s, p) =>
              s +
              p.items
                .filter((i: any) => i.item_index === item.item_index)
                .reduce((n: number, i: any) => n + quantityMilli(i.quantity), 0),
            0,
          ) >
          quantityMilli(line.quantity)
      )
        fail(400, 'Shipment quantity exceeds the remaining order quantity');
    }
    const activeSale = (await all(a, 'protected_sales')).find(
      (s) =>
        s.order_id === order.id && !['cancelled', 'expired'].includes(s.state),
    );
    if (activeSale) {
      if (d.protected_sale_id && d.protected_sale_id !== activeSale.id)
        fail(409, 'Protected arrangement does not match order');
      d.protected_sale_id = activeSale.id;
    }
    if (d.protected_sale_id) {
      const sale = await get(a, d.protected_sale_id, 'protected_sales');
      if (
        sale.order_id !== order.id ||
        !['awaiting_shipment', 'shipped'].includes(sale.state)
      )
        fail(409, 'Protected arrangement must be confirmed before shipment');
    }
    const result = await create(a, 'shipments', {
      ...d,
      status: 'pending',
      delivery_assurance: 'seller_reported',
      history: [
        {
          state: 'pending',
          actor: a.actor,
          source: 'seller_reported',
          at: now(),
        },
      ],
    });
    await emit(a, 'shipment.created', { id: result.id, order_id: order.id });
    return result;
  });
}
export async function shipmentTransition(
  a: Access,
  id: string,
  input: unknown,
) {
  const d = z
    .object({
      status: z.enum([
        'processing',
        'ready_for_dispatch',
        'shipped',
        'out_for_delivery',
        'delivered',
        'delivery_exception',
        'returned',
        'cancelled',
      ]),
      note: z.string().max(1000).default(''),
    })
    .strict()
    .parse(input);
  return atomic(a, async () => {
    const s = await get(a, id, 'shipments');
    if (!shipmentNext[s.status]?.includes(d.status))
      fail(409, 'Invalid fulfillment transition');
    if(d.status==='shipped')await dispatchShipmentStock(a,s);
    const result = await change(a, s, {
      status: d.status,
      delivery_assurance: 'seller_reported',
      history: [
        ...s.history,
        {
          state: d.status,
          actor: a.actor,
          source: 'seller_reported',
          at: now(),
          note: d.note,
        },
      ],
    });
    const order = await record(a, s.order_id, 'orders');
    const siblings = (await all(a, 'shipments')).filter(
      (x) =>
        x.order_id === order.id &&
        !['cancelled', 'returned'].includes(x.status),
    );
    const complete = order.items.every(
      (line: any, index: number) =>
        siblings
          .filter((x) => x.status === 'delivered')
          .reduce(
            (sum, x) =>
              sum +
              x.items
                .filter((i: any) => i.item_index === index)
                .reduce((n: number, i: any) => n + quantityMilli(i.quantity), 0),
            0,
          ) >= quantityMilli(line.quantity),
    );
    await update(a, order.id, {
      ...order,
      fulfillment_status: complete
        ? 'delivered'
        : siblings.some((s) => s.status === 'delivered')
          ? 'partially_fulfilled'
          : d.status === 'cancelled'
            ? order.fulfillment_status
            : d.status,
    });
    if (s.protected_sale_id && d.status === 'shipped') {
      const sale = await get(a, s.protected_sale_id, 'protected_sales');
      if (sale.state === 'awaiting_shipment')
        await saleState(a, sale, 'shipped', 'seller_reported');
    }
    await emit(a, 'shipment.' + d.status, {
      id: s.id,
      order_id: s.order_id,
      assurance: 'seller_reported',
    });
    return result;
  });
}
function evidenceBytes(d: z.infer<typeof evidenceSchema>) {
  if (!d.content_base64) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(d.content_base64))
    fail(400, 'Invalid file encoding');
  const b = Buffer.from(d.content_base64, 'base64');
  if (!b.length || b.length > 250000)
    fail(400, 'Evidence file must be 1–250000 bytes');
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
  if (
    d.content_type === 'application/pdf' &&
    b.subarray(0, 5).toString() !== '%PDF-'
  )
    fail(400, 'Invalid PDF');
  return b;
}
export async function addEvidence(
  a: Access,
  resource: string,
  kind: 'shipments' | 'disputes',
  input: unknown,
  party: 'seller_reported' | 'buyer_reported' = 'seller_reported',
) {
  const d = evidenceSchema.parse(input);
  await get(a, resource, kind);
  const b = evidenceBytes(d),
    id = randomUUID();
  await dbRun(
    'INSERT INTO ac2_evidence(id,org_id,environment,resource_id,resource_kind,actor,source,assurance,statement,filename,content_type,content_base64,sha256,occurred_at,retention_until,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      id,
      a.org,
      a.environment,
      resource,
      kind,
      a.actor,
      party,
      party,
      d.statement,
      d.filename || null,
      d.content_type || null,
      b ? seal(b.toString('base64'),JSON.stringify(['evidence',a.org,a.environment,id])) : null,
      b ? createHash('sha256').update(b).digest('hex') : null,
      now(),
      new Date(Date.now() + 365 * 86400000).toISOString(),
      now(),
    ],
  );
  await audit(a.org, a.actor, 'evidence.appended', id);
  return {
    id,
    resource_id: resource,
    source: party,
    assurance: party,
    sha256: b ? createHash('sha256').update(b).digest('hex') : null,
    retention_days: 365,
  };
}

export interface ProtectedPartner {
  name: string;
  mode: 'sandbox' | 'production';
  confirmPayment(id: string): Promise<{
    reference: string;
    payment_confirmed: boolean;
    arrangement_confirmed: boolean;
  }>;
  settle(
    id: string,
    outcome: 'release' | 'refund',
  ): Promise<{
    reference: string;
    outcome: 'release' | 'refund';
    confirmed: boolean;
  }>;
}
export const sandboxPartner: ProtectedPartner = {
  name: 'AfriCore deterministic partner simulator',
  mode: 'sandbox',
  async confirmPayment(id) {
    return {
      reference: 'sandbox-protection-' + id,
      payment_confirmed: true,
      arrangement_confirmed: true,
    };
  },
  async settle(id, outcome) {
    return {
      reference: 'sandbox-' + outcome + '-' + id,
      outcome,
      confirmed: true,
    };
  },
};
export const livePartner: ProtectedPartner = {
  name: 'Not configured',
  mode: 'production',
  async confirmPayment() {
    return fail(503, 'No authorized protected-payment partner is configured');
  },
  async settle() {
    return fail(503, 'Live settlement is disabled');
  },
};
export async function saleState(
  a: Access,
  s: any,
  state: string,
  source: string,
  extra: any = {},
) {
  const result = await change(a, s, {
    ...extra,
    state,
    history: [...s.history, { state, source, actor: a.actor, at: now() }],
  });
  await audit(a.org, a.actor, 'protected_payment.' + state, s.id);
  return result;
}
async function command(
  a: Access,
  id: string,
  key: string,
  action: string,
  input: any,
  fn: () => Promise<any>,
) {
  z.string().min(8).max(150).parse(key);
  return atomic(a, async () => {
    const fingerprint = hash(
        JSON.stringify({ id, action, input, actor: a.actor }),
      ),
      dedupe = 'commerce-command:' + key;
    const previous = await dbGet(
      'SELECT payload FROM ac2_events WHERE org_id=? AND environment=? AND dedupe_key=?',
      [a.org, a.environment, dedupe],
    );
    if (previous) {
      const p = JSON.parse(previous.payload);
      if (p.fingerprint !== fingerprint)
        fail(409, 'Idempotency key already used with different input');
      return { ...p.result, duplicate: true };
    }
    const result = await fn();
    await emit(
      a,
      'commerce.command_completed',
      { id, fingerprint, result },
      { key: dedupe },
    );
    return result;
  });
}
export async function createSale(a: Access, input: unknown, key: string) {
  const d = saleSchema.parse(input);
  if (a.environment !== 'sandbox')
    fail(503, 'Protected payments are sandbox-only');
  z.string().min(8).max(150).parse(key);
  return atomic(a, async () => {
    const previous = await dbGet(
      'SELECT payload FROM ac2_events WHERE org_id=? AND environment=? AND dedupe_key=?',
      [a.org, a.environment, 'sale-create:' + key],
    );
    if (previous) {
      const p = JSON.parse(previous.payload);
      if (p.fingerprint !== hash(JSON.stringify(d)))
        fail(409, 'Idempotency conflict');
      return {
        ...(await get(a, p.id, 'protected_sales')),
        buyer_url: null,
        duplicate: true,
      };
    }
    if (d.order_id) {
      const order = await record(a, d.order_id, 'orders');
      const invoices = await dbAll(
        "SELECT data FROM ac_records WHERE org_id=? AND environment=? AND kind='invoices'",
        [a.org, a.environment],
      );
      if (
        invoices.some(
          (r) =>
            JSON.parse(r.data).order_id === order.id &&
            JSON.parse(r.data).status !== 'voided',
        )
      )
        fail(409, 'Use an uninvoiced order for protected sale orchestration');
      if (
        order.currency !== d.currency ||
        order.total_minor !== d.amount_minor ||
        order.payment_status !== 'unpaid'
      )
        fail(409, 'Use an unpaid order with the same amount and currency');
      if (
        (await all(a, 'protected_sales')).some(
          (s) =>
            s.order_id === order.id &&
            !['cancelled', 'expired'].includes(s.state),
        )
      )
        fail(409, 'Order already has a protected arrangement');
      await dbRun(
        "UPDATE ac_requests SET status='cancelled' WHERE document_id=? AND org_id=? AND environment=? AND status NOT IN ('paid','cancelled')",
        [order.id, a.org, a.environment],
      );
    }
    let linkedOrder = d.order_id;
    if (!linkedOrder) {
      const customerId = d.customer_id || randomUUID();
      if (!d.customer_id)
        await save(
          a,
          'customers',
          {
            name: 'Protected purchase recipient',
            type: 'individual',
            email: '',
            phone: '',
            notes: 'Created for a sandbox protected purchase.',
          },
          customerId,
        );
      linkedOrder = randomUUID();
      const date = day();
      await save(
        a,
        'orders',
        {
          customer_id: customerId,
          currency: d.currency,
          items: [
            {
              description: d.title,
              quantity: 1,
              unit_price_minor: d.amount_minor,
            },
          ],
          subtotal_minor: d.amount_minor,
          total_minor: d.amount_minor,
          tax_minor: 0,
          tax_bps: 0,
          discount_minor: 0,
          issue_date: date,
          due_date: date,
          paid_minor: 0,
          payment_status: 'unpaid',
          fulfillment_status: 'unfulfilled',
          status: 'awaiting_payment',
          reference: 'PRO-' + linkedOrder.slice(0, 8).toUpperCase(),
          notes: 'Sandbox protected purchase; no real funds.',
        },
        linkedOrder,
      );
    }
    if (d.customer_id) await record(a, d.customer_id, 'customers');
    const id = randomUUID(),
      token = secret(),
      result = await create(
        a,
        'protected_sales',
        {
          ...d,
          order_id: linkedOrder,
          state: 'awaiting_buyer_payment',
          provider: 'sandbox_partner',
          payment_state: 'not_initiated',
          arrangement_state: 'unconfirmed',
          custody: 'no_real_funds',
          settlement_state: 'not_requested',
          fees_minor: 0,
          history: [
            {
              state: 'awaiting_buyer_payment',
              actor: a.actor,
              source: 'seller_reported',
              at: now(),
            },
          ],
        },
        id,
      );
    await dbRun(
      'INSERT INTO ac2_buyer_access(token_hash,org_id,environment,agreement_id,expires_at) VALUES (?,?,?,?,?)',
      [
        hash(token),
        a.org,
        a.environment,
        id,
        new Date(Date.now() + d.buyer_access_days * 86400000).toISOString(),
      ],
    );
    await emit(
      a,
      'protected_payment.created',
      { id, fingerprint: hash(JSON.stringify(d)) },
      { key: 'sale-create:' + key },
    );
    return { ...result, buyer_url: '/buyer/' + token };
  });
}
export async function buyerAccess(token: string) {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  const r = await dbGet(
    'SELECT * FROM ac2_buyer_access WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?',
    [hash(token), now()],
  );
  if (!r) fail(404, 'Buyer link is invalid or expired');
  const a: Access = {
    org: r.org_id,
    environment: r.environment,
    actor: 'buyer:' + r.agreement_id,
    role: 'buyer',
    api: false,
  };
  if (a.environment !== 'sandbox')
    fail(503, 'Live buyer protection is disabled');
  return { a, sale: await get(a, r.agreement_id, 'protected_sales') };
}
export async function buyerView(token: string) {
  const { a, sale } = await buyerAccess(token),
    org = await dbGet(
      'SELECT name,verification_status FROM ac_organizations WHERE id=?',
      [a.org],
    );
  const disputes = (await all(a, 'disputes'))
    .filter((d) => d.protected_sale_id === sale.id)
    .map((d) => ({
      id: d.id,
      reason: d.reason,
      status: d.status,
      decision: d.decision || null,
      history: d.history,
    }));
  const shipments = (await all(a, 'shipments'))
    .filter((s) => s.protected_sale_id === sale.id)
    .map((s) => ({
      id: s.id,
      courier: s.courier,
      tracking_reference: s.tracking_reference,
      status: s.status,
      delivery_assurance: s.delivery_assurance,
      estimated_delivery: s.estimated_delivery,
    }));
  return {
    id: sale.id,
    title: sale.title,
    description: sale.description,
    merchant: org.name,
    merchant_verification: org.verification_status,
    amount_minor: sale.amount_minor,
    currency: sale.currency,
    state: sale.state,
    payment_state: sale.payment_state,
    arrangement_state: sale.arrangement_state,
    settlement_state: sale.settlement_state,
    fees_minor: 0,
    custody: 'Sandbox simulation. No real funds are held.',
    provider: sandboxPartner.name,
    delivery_terms: sale.delivery_terms,
    inspection_hours: sale.inspection_hours,
    inspection_deadline: sale.inspection_deadline || null,
    cancellation_terms: sale.cancellation_terms,
    support_contact: sale.support_contact,
    refund_terms:
      'Disputes require recorded review and approval. No unconditional buyer protection is offered.',
    history: sale.history,
    shipments,
    disputes,
    environment: 'sandbox',
  };
}
export async function buyerAction(token: string, input: unknown, key: string) {
  const d = z
    .object({ action: z.enum(['pay', 'confirm_receipt', 'accept', 'cancel']) })
    .strict()
    .parse(input);
  const { a, sale } = await buyerAccess(token);
  return command(a, sale.id, key, d.action, d, async () => {
    let s = await get(a, sale.id, 'protected_sales');
    if (d.action === 'pay') {
      if (s.state !== 'awaiting_buyer_payment')
        fail(409, 'Sale is not awaiting payment');
      s = await saleState(a, s, 'payment_pending', 'buyer_link_action', {
        payment_state: 'pending',
      });
      const proof = await sandboxPartner.confirmPayment(s.id);
      if (!proof.payment_confirmed || !proof.arrangement_confirmed)
        fail(503, 'Partner did not confirm protection');
      s = await saleState(
        a,
        s,
        'payment_confirmed_by_provider',
        'sandbox_partner',
        {
          payment_state: 'provider_confirmed',
          provider_reference: proof.reference,
        },
      );
      await emit(a, 'protected_payment.payment_confirmed', {
        id: s.id,
        provider: sandboxPartner.name,
        simulation: true,
      });
      s = await saleState(
        a,
        s,
        'protected_arrangement_confirmed',
        'sandbox_partner',
        { arrangement_state: 'sandbox_confirmed' },
      );
      s = await saleState(a, s, 'awaiting_shipment', 'africore_service');
      if (s.order_id) {
        const order = await record(a, s.order_id, 'orders');
        await update(a, order.id, {
          ...order,
          protected_payment_state: 'sandbox_partner_confirmed',
        });
      }
    } else if (d.action === 'confirm_receipt') {
      if (s.state !== 'shipped')
        fail(409, 'Shipment is required before receipt confirmation');
      const shipments = (await all(a, 'shipments')).filter(
        (x) =>
          x.protected_sale_id === s.id &&
          !['cancelled', 'returned'].includes(x.status),
      );
      const order = await record(a, s.order_id, 'orders');
      const eligible = shipments.filter((x) =>
        ['shipped', 'out_for_delivery', 'delivered'].includes(x.status),
      );
      if (
        !order.items.every(
          (line: any, index: number) =>
            eligible.reduce(
              (sum, x) =>
                sum +
                x.items
                  .filter((i: any) => i.item_index === index)
                  .reduce((n: number, i: any) => n + i.quantity, 0),
              0,
            ) >= line.quantity,
        )
      )
        fail(
          409,
          'All purchased quantities must ship before confirming full receipt',
        );
      s = await saleState(a, s, 'delivered', 'buyer_link_confirmation');
      s = await saleState(a, s, 'inspection_period', 'africore_service', {
        inspection_deadline: new Date(
          Date.now() + s.inspection_hours * 3600000,
        ).toISOString(),
      });
      for (const shipment of eligible) {
        await change(a, shipment, {
          status: 'delivered',
          delivery_assurance: 'customer_confirmed',
          history: [
            ...shipment.history,
            {
              state: 'delivered',
              actor: a.actor,
              source: 'customer_confirmed',
              at: now(),
            },
          ],
        });
      }
      await update(a, order.id, { ...order, fulfillment_status: 'delivered' });
      await emit(a, 'delivery.confirmed', {
        id: s.id,
        assurance: 'buyer_link_confirmed',
      });
    } else if (d.action === 'accept') {
      if (s.state !== 'inspection_period')
        fail(409, 'Confirm receipt before accepting');
      if (
        (await all(a, 'disputes')).some(
          (x) => x.protected_sale_id === s.id && x.status !== 'resolved',
        )
      )
        fail(409, 'Resolve the open dispute first');
      s = await saleState(a, s, 'accepted', 'buyer_link_confirmation');
    } else {
      if (s.state !== 'awaiting_buyer_payment')
        fail(409, 'Paid sales require a reviewed refund process');
      s = await saleState(a, s, 'cancelled', 'buyer_link_action');
    }
    return {
      id: s.id,
      state: s.state,
      payment_state: s.payment_state,
      arrangement_state: s.arrangement_state,
    };
  });
}

export async function openDispute(token: string, input: unknown, key: string) {
  const d = disputeSchema.parse(input),
    { a, sale } = await buyerAccess(token);
  return command(a, sale.id, key, 'dispute', d, async () => {
    const s = await get(a, sale.id, 'protected_sales');
    if (
      ![
        'awaiting_shipment',
        'shipped',
        'inspection_period',
        'accepted',
      ].includes(s.state)
    )
      fail(409, 'Sale cannot be disputed in its current state');
    if (s.inspection_deadline && s.inspection_deadline < now())
      fail(409, 'Inspection deadline expired; contact support for escalation');
    if (
      (await all(a, 'disputes')).some(
        (x) => x.protected_sale_id === s.id && x.status !== 'resolved',
      )
    )
      fail(409, 'A dispute is already open');
    const dispute = await create(a, 'disputes', {
      protected_sale_id: s.id,
      customer_id: s.customer_id || null,
      reason: d.reason,
      status: 'open',
      history: [
        {
          status: 'open',
          party: 'buyer_reported',
          statement: d.statement,
          at: now(),
        },
      ],
      deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
    });
    await addEvidence(
      a,
      dispute.id,
      'disputes',
      { statement: d.statement },
      'buyer_reported',
    );
    await saleState(a, s, 'disputed', 'buyer_reported');
    await emit(a, 'protected_payment.disputed', {
      id: s.id,
      dispute_id: dispute.id,
    });
    await notify(a, {
      category: 'protected_payments',
      title: 'Buyer dispute opened',
      body: 'Review the statements and evidence. No automatic refund was initiated.',
      resource_id: dispute.id,
      key: dispute.id,
    });
    return { id: dispute.id, status: 'open', protected_sale_id: s.id };
  });
}
export async function disputeRespond(a: Access, id: string, input: unknown) {
  const d = z
    .object({ statement: z.string().trim().min(5).max(3000) })
    .strict()
    .parse(input);
  return atomic(a, async () => {
    const dispute = await get(a, id, 'disputes');
    if (
      !['open', 'under_review'].includes(dispute.status) ||
      dispute.deadline < now()
    )
      fail(409, 'Dispute response window is closed');
    await addEvidence(a, id, 'disputes', d, 'seller_reported');
    return change(a, dispute, {
      status: 'under_review',
      history: [
        ...dispute.history,
        {
          status: 'under_review',
          party: 'seller_reported',
          statement: d.statement,
          at: now(),
        },
      ],
    });
  });
}
export async function disputeResolve(
  a: Access,
  id: string,
  input: unknown,
  key: string,
) {
  if (a.api) fail(403, 'Human reviewer required');
  const d = z
    .object({
      decision: z.enum(['release', 'refund']),
      reason: z.string().trim().min(10).max(2000),
      approval_id: z.string().uuid(),
    })
    .strict()
    .parse(input);
  return command(a, id, key, 'resolve', d, async () => {
    const dispute = await get(a, id, 'disputes');
    if (!['open', 'under_review'].includes(dispute.status))
      fail(409, 'Dispute already resolved');
    await requireApproval(a, d.approval_id, 'dispute_resolution', id,{decision:d.decision});
    const result = await change(a, dispute, {
      status: 'resolved',
      decision: d.decision,
      resolution_reason: d.reason,
      resolved_by: a.actor,
      history: [
        ...dispute.history,
        {
          status: 'resolved',
          decision: d.decision,
          actor: a.actor,
          at: now(),
          reason: d.reason,
        },
      ],
    });
    const sale = await get(a, dispute.protected_sale_id, 'protected_sales');
    await saleState(
      a,
      sale,
      d.decision === 'refund' ? 'refund_requested' : 'release_requested',
      'authorized_dispute_review',
      {
        settlement_state: d.decision + '_requested',
        resolution_dispute_id: id,
      },
    );
    await emit(a, 'dispute.resolved', {
      id,
      decision: d.decision,
      settlement_confirmed: false,
    });
    return { id: result.id, status: result.status, decision: d.decision };
  });
}
export async function sellerSaleAction(
  a: Access,
  id: string,
  input: unknown,
  key: string,
) {
  if (a.environment !== 'sandbox')
    fail(503, 'Live protected settlement disabled');
  const d = z
    .object({
      action: z.enum([
        'request_release',
        'confirm_partner_settlement',
        'expire',
        'cancel',
      ]),
      approval_id: z.string().uuid().optional(),
    })
    .strict()
    .parse(input);
  return command(a, id, key, d.action, d, async () => {
    let s = await get(a, id, 'protected_sales');
    if (d.action === 'request_release') {
      if (a.api) fail(403, 'Human requester required');
      if (s.state !== 'accepted') fail(409, 'Buyer acceptance required');
      await requireApproval(a, d.approval_id, 'protected_release', id);
      s = await saleState(
        a,
        s,
        'release_requested',
        'authorized_seller_request',
        { settlement_state: 'release_requested' },
      );
    } else if (d.action === 'confirm_partner_settlement') {
      if (!['release_requested', 'refund_requested'].includes(s.state))
        fail(409, 'Approved release or refund request required');
      if (
        (await all(a, 'disputes')).some(
          (x) => x.protected_sale_id === id && x.status !== 'resolved',
        )
      )
        fail(409, 'Open dispute blocks settlement');
      const outcome = s.state === 'release_requested' ? 'release' : 'refund',
        proof = await sandboxPartner.settle(id, outcome);
      if (!proof.confirmed) fail(503, 'Partner settlement unconfirmed');
      s = await saleState(
        a,
        s,
        outcome === 'release' ? 'released_by_partner' : 'refunded_by_partner',
        'sandbox_partner',
        {
          settlement_state: outcome === 'release' ? 'released' : 'refunded',
          settlement_reference: proof.reference,
        },
      );
      await emit(
        a,
        'protected_payment.' +
          (outcome === 'release' ? 'release_confirmed' : 'refund_confirmed'),
        { id, provider_reference: proof.reference, simulation: true },
      );
    } else {
      if (s.state !== 'awaiting_buyer_payment')
        fail(409, 'Only unpaid sales may be cancelled or expired');
      if (d.action === 'expire') {
        const link = await dbGet(
          'SELECT expires_at FROM ac2_buyer_access WHERE agreement_id=?',
          [id],
        );
        if (link.expires_at > now()) fail(409, 'Agreement has not expired');
      }
      s = await saleState(
        a,
        s,
        d.action === 'expire' ? 'expired' : 'cancelled',
        'seller_reported',
      );
      await dbRun(
        'UPDATE ac2_buyer_access SET revoked_at=? WHERE agreement_id=?',
        [now(), id],
      );
    }
    return { id: s.id, state: s.state, settlement_state: s.settlement_state };
  });
}
