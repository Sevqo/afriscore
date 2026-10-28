import { capture } from '../operations/events';
import {pinnedWebhookFetch} from '../services/webhook-http';
import { createHmac, randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun, dbTransaction } from '../db';
import { hash, now, seal, unseal } from './crypto';
import { fail, audit, Access } from './auth';
import { isDeliverableWebhookTarget } from '../services/webhookService';
import {entitlement,recordUsage,reserve,finishReservation} from '../marketplace/engine';

export async function record(a: Access, id: string, kind?: string) {
  const row = await dbGet(
    'SELECT * FROM ac_records WHERE id=? AND org_id=? AND environment=?' +
      (kind ? ' AND kind=?' : ''),
    [id, a.org, a.environment, ...(kind ? [kind] : [])],
  );
  if (!row) fail(404, 'Record not found');
  return {
    ...JSON.parse(row.data),
    id: row.id,
    kind: row.kind,
    created_at: row.created_at,
  };
}
export async function save(
  a: Access,
  kind: string,
  data: any,
  id: string = randomUUID(),
) {
  await dbRun(
    'INSERT INTO ac_records(id,org_id,environment,kind,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    [id, a.org, a.environment, kind, JSON.stringify(data), now(), now()],
  );
  await audit(a.org, a.actor, kind + '.created', id);
  return { ...data, id, kind };
}
export async function update(a: Access, id: string, data: any) {
  await dbRun(
    'UPDATE ac_records SET data=?,updated_at=? WHERE id=? AND org_id=? AND environment=?',
    [JSON.stringify(data), now(), id, a.org, a.environment],
  );
}
export async function enqueue(a: Access, type: string, data: any, captureEvent = true) {
  if(captureEvent) await capture(a,type,data);
  const endpoints = await dbAll(
    'SELECT * FROM ac_endpoints WHERE org_id=? AND environment=?',
    [a.org, a.environment],
  );
  for (const ep of endpoints) {
    if (!JSON.parse(ep.subscriptions).includes(type)) continue;
    const id: string = randomUUID(),
      payload = JSON.stringify({
        id,
        type,
        environment: a.environment,
        data,
        created_at: now(),
      });
    await dbRun(
      'INSERT INTO ac_deliveries(id,org_id,endpoint_id,event_type,payload,next_at,created_at) VALUES (?,?,?,?,?,?,?)',
      [id, a.org, ep.id, type, payload, now(), now()],
    );
  }
}
export interface ProviderResult {
  reference: string;
  status: 'succeeded' | 'failed' | 'pending' | 'reversed';
  amount_minor: number;
  currency: string;
}
export interface PaymentProvider {
  initiate(request: any, scenario: string): Promise<ProviderResult>;
  lookup(reference: string): Promise<ProviderResult | undefined>;
  health(): { available: boolean; mode: string };
}
export const sandboxProvider: PaymentProvider = {
  async initiate(request, scenario) {
    return {
      reference:
        'sandbox_' +
        request.id +
        '_' +
        (scenario === 'reversed'
          ? 'reversed'
          : scenario === 'delayed'
            ? 'pending'
            : scenario === 'failed'
              ? 'failed'
              : 'receipt'),
      status:
        scenario === 'delayed'
          ? 'pending'
          : scenario === 'failed'
            ? 'failed'
            : scenario === 'reversed'
              ? 'reversed'
              : 'succeeded',
      amount_minor:
        scenario === 'partial'
          ? Math.max(1, Math.floor(Number(request.amount_minor) / 2))
          : Number(request.amount_minor),
      currency: request.currency,
    };
  },
  async lookup(reference) {
    return dbGet(
      'SELECT provider_ref AS reference,status,amount_minor,currency FROM ac_events WHERE provider_ref=? AND environment=?',
      [reference, 'sandbox'],
    );
  },
  health() {
    return { available: true, mode: 'sandbox' };
  },
};
export const mpesaProvider: PaymentProvider = {
  async initiate() {
    return fail(
      503,
      'Live M-Pesa unavailable: merchant credentials, callback verification and authorized testing required',
    );
  },
  async lookup() {
    return undefined;
  },
  health() {
    return { available: false, mode: 'production-disabled' };
  },
};
/** Trusted adapter output only. Callers must never pass a browser success assertion here. */
export async function processProviderResult(
  requestId: string,
  result: ProviderResult,
) {
  return dbTransaction(async () => {
    // Write locks serialize settlement per request on both database engines.
    const seed = await dbGet('SELECT org_id FROM ac_requests WHERE id=?', [
      requestId,
    ]);
    if (!seed) fail(404, 'Payment request not found');
    await dbRun('UPDATE ac_organizations SET name=name WHERE id=?', [
      seed.org_id,
    ]);
    await dbRun('UPDATE ac_requests SET status=status WHERE id=?', [requestId]);
    const request = await dbGet('SELECT * FROM ac_requests WHERE id=?', [
      requestId,
    ]);
    if (!request) fail(404, 'Payment request not found');
    const a: Access = {
      org: request.org_id,
      environment: request.environment,
      actor: 'provider:sandbox',
      role: 'system',
      api: false,
    };
    const previous = await dbGet(
      'SELECT * FROM ac_events WHERE environment=? AND provider_ref=?',
      [a.environment, result.reference],
    );
    if (previous) {
      if(previous.org_id!==request.org_id||previous.request_id!==request.id||previous.currency!==result.currency||Number(previous.amount_minor)!==result.amount_minor||previous.status!==result.status)fail(409,'Provider reference conflicts with its original authoritative event');
      return { duplicate: true, event_id: previous.id };
    }
    const eventId = randomUUID();
    await dbRun(
      'INSERT INTO ac_events(id,org_id,environment,request_id,provider_ref,status,amount_minor,currency,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        eventId,
        a.org,
        a.environment,
        request.id,
        result.reference,
        result.status,
        result.amount_minor,
        result.currency,
        now(),
      ],
    );
    await dbRun('UPDATE ac_organizations SET name=name WHERE id=?', [a.org]);
    await dbRun(
      'UPDATE ac_records SET updated_at=updated_at WHERE id=? AND org_id=?',
      [request.document_id, a.org],
    );
    const doc = await record(a, request.document_id);
    // Document lock prevents parallel requests allocating more than the open receivable.
    await dbRun(
      'UPDATE ac_records SET updated_at=updated_at WHERE id=? AND org_id=?',
      [doc.id, a.org],
    );
    const allocations = await dbGet(
      'SELECT COALESCE(SUM(amount_minor),0) AS total FROM ac_allocations WHERE document_id=? AND org_id=? AND environment=?',
      [doc.id, a.org, a.environment],
    );
    const paid = Number(allocations.total);
    let exception: string | undefined;
    if (result.status === 'reversed') exception = 'reversal_requires_review';
    else if (
      ['cancelled', 'expired'].includes(request.status) ||
      request.expires_at < now()
    )
      exception = 'closed_request';
    else if (doc.kind === 'orders' && doc.fulfillment_status === 'cancelled')
      exception = 'cancelled_order';
    else if (result.currency !== request.currency)
      exception = 'currency_mismatch';
    else if (result.amount_minor > doc.total_minor - paid)
      exception = 'amount_mismatch';
    else if (
      result.status === 'succeeded' &&
      !['issued', 'partially_paid', 'awaiting_payment'].includes(doc.status)
    )
      exception = 'document_state';
    if (exception) {
      await dbRun(
        'INSERT INTO ac_exceptions(id,org_id,environment,event_id,reason,status,created_at) VALUES (?,?,?,?,?,?,?)',
        [
          randomUUID(),
          a.org,
          a.environment,
          eventId,
          exception,
          'pending_review',
          now(),
        ],
      );
      await enqueue(a, 'reconciliation.exception_created', {
        event_id: eventId,
        reason: exception,
      });
    } else if (result.status === 'succeeded') {
      await dbRun(
        'INSERT INTO ac_allocations(id,org_id,environment,event_id,document_id,amount_minor,created_at) VALUES (?,?,?,?,?,?,?)',
        [
          randomUUID(),
          a.org,
          a.environment,
          eventId,
          doc.id,
          result.amount_minor,
          now(),
        ],
      );
      // Observational receivables journal, never a custody or bank balance.
      for (const [account, debit, credit] of [
        ['provider_collections', result.amount_minor, 0],
        ['receivables', 0, result.amount_minor],
      ] as const) {
        await dbRun(
          'INSERT INTO ac_journal(id,org_id,environment,event_id,account,debit_minor,credit_minor,currency,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
          [
            randomUUID(),
            a.org,
            a.environment,
            eventId,
            account,
            debit,
            credit,
            result.currency,
            now(),
          ],
        );
      }
      const status =
        paid + result.amount_minor === doc.total_minor
          ? 'paid'
          : 'partially_paid';
      await update(a, doc.id, {
        ...doc,
        status,
        paid_minor: paid + result.amount_minor,
        ...(doc.kind === 'orders' ? { payment_status: status } : {}),
      });
      if (doc.order_id) {
        const order = await record(a, doc.order_id, 'orders');
        await update(a, order.id, { ...order, payment_status: status });
      }
      await dbRun('UPDATE ac_requests SET status=? WHERE id=?', [
        status,
        request.id,
      ]);
      await enqueue(a, 'payment.succeeded', {
        event_id: eventId,
        request_id: request.id,
        amount_minor: result.amount_minor,
        currency: result.currency,
      });
      if (status === 'paid' && doc.kind === 'invoices')
        await enqueue(a, 'invoice.paid', { id: doc.id });
    } else if (request.status !== 'paid' && result.status === 'failed') {
      await dbRun("UPDATE ac_requests SET status='failed' WHERE id=?", [
        request.id,
      ]);
      await enqueue(a, 'payment.failed', { request_id: request.id });
    }
    await audit(a.org, a.actor, 'payment.' + result.status, eventId);
    // An authoritative callback must settle even if service access was turned
    // off after checkout. Account for the confirmed event without a new charge.
    if(result.status==='succeeded'&&!exception&&await entitlement(a,'payments'))await recordUsage(a,'payments','provider-event:'+eventId,1,'provider_confirmed_event');
    return {
      event_id: eventId,
      status: result.status,
      reconciliation:
        exception || (result.status === 'succeeded' ? 'matched' : 'pending'),
    };
  });
}
let running = false;
export async function deliverWebhooks(
  org?: string,
  transport: typeof fetch = pinnedWebhookFetch,
  validate = isDeliverableWebhookTarget,
  environment?: string,
) {
  if (running) return { processed: 0 };
  running = true;
  try {
    const rows = await dbAll(
      `SELECT d.*,e.url,e.secret,e.environment AS endpoint_environment FROM ac_deliveries d JOIN ac_endpoints e ON e.id=d.endpoint_id WHERE d.status='pending' AND d.next_at<=?${org ? ' AND d.org_id=?' : ''}${environment ? ' AND e.environment=?' : ''} ORDER BY d.created_at LIMIT 25`,
      [now(), ...(org ? [org] : []), ...(environment ? [environment] : [])],
    );
    let processed=0;
    for (const row of rows) {
      const usageAccess:Access={org:row.org_id,environment:row.endpoint_environment,actor:'webhook_worker',role:'system',api:false};
      let reservation:string;
      try{reservation=await reserve(usageAccess,'webhooks');}catch(error){if([402,429].includes((error as any).status))continue;throw error;}
      let error: string | null = null;
      try {
        const target = await validate(row.url);
        if (!target.allowed) throw new Error('target_denied');
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = createHmac('sha256', unseal(row.secret,JSON.stringify(['endpoint',row.org_id,row.endpoint_environment,row.endpoint_id])))
          .update(timestamp + '.' + row.payload)
          .digest('hex');
        const response = await transport(row.url, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
          headers: {
            'Content-Type': 'application/json',
            'AfriCore-Signature': `t=${timestamp},v1=${signature}`,
            'AfriCore-Delivery': row.id,
          },
          body: row.payload,
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error('http_' + response.status);
      } catch (e) {
        error = e instanceof Error ? e.message : 'delivery_failed';
      }
      const attempts = row.attempts + 1;
      await dbTransaction(async()=>{await dbRun(
        'UPDATE ac_deliveries SET attempts=?,status=?,next_at=?,last_error=? WHERE id=?',
        [
          attempts,
          error ? (attempts >= 5 ? 'dead_letter' : 'pending') : 'delivered',
          new Date(
            Date.now() + Math.min(3600000, 1000 * 2 ** attempts),
          ).toISOString(),
          error,
          row.id,
        ],
      );await finishReservation(usageAccess,reservation,!error,'delivery:'+row.id,'signed_webhook_delivered');});
      processed++;
    }
    return { processed };
  } finally {
    running = false;
  }
}
