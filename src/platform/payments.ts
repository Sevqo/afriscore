import {documentBalance,refreshDocument} from '../finance/ledger';
import {sumMinor} from '../finance/money';
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
  if(['customers','orders'].includes(kind))await enqueue(a,kind.slice(0,-1)+'.created',{id,customer_id:data.customer_id});
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
  status: 'succeeded' | 'failed' | 'pending' | 'reversed' | 'refunded';
  provider?: string; account_id?: string; occurred_at?: string; related_reference?: string; time_basis?:'provider_occurrence'|'observed_confirmation';
  amount_minor: number;
  currency: string;
}
export interface PaymentProvider {
  initiate(request: any, scenario: string): Promise<ProviderResult>;
  lookup(reference: string, scope?: Access): Promise<ProviderResult | undefined>;
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
  async lookup(reference, scope) {
    if(!scope||scope.environment!=='sandbox')return undefined;
    return dbGet(
      "SELECT d.provider_reference AS reference,e.status,e.amount_minor,e.currency FROM ac_events e JOIN ac_payment_event_details d ON d.event_id=e.id WHERE d.provider_reference=? AND d.provider='sandbox' AND e.org_id=? AND e.environment=?",
      [reference, scope.org, scope.environment],
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
    if(!Number.isSafeInteger(result.amount_minor)||result.amount_minor<=0||result.amount_minor>100000000000)fail(400,'Invalid provider amount');
    const occurred=result.occurred_at||now();if(!Number.isFinite(Date.parse(occurred))||Date.parse(occurred)>Date.now()+300000)fail(400,'Invalid provider occurrence time');
    const provider=result.provider||'sandbox',accountId=[a.environment,result.account_id||a.org].join(':');
    const scopedReference='financial:'+hash(JSON.stringify([provider,accountId,result.reference]));
    let previous=await dbGet('SELECT * FROM ac_events WHERE environment=? AND provider_ref=?',[a.environment,scopedReference]);
    if(!previous){const legacy=await dbGet('SELECT * FROM ac_events WHERE environment=? AND provider_ref=?',[a.environment,result.reference]);if(legacy?.org_id===a.org&&legacy?.request_id===request.id)previous=legacy;}

    if (previous) {
      if(previous.org_id!==request.org_id||previous.request_id!==request.id||previous.currency!==result.currency||Number(previous.amount_minor)!==result.amount_minor||previous.status!==result.status)fail(409,'Provider reference conflicts with its original authoritative event');
      const detail=await dbGet('SELECT occurred_at FROM ac_payment_event_details WHERE event_id=?',[previous.id]);if(result.occurred_at&&detail&&detail.occurred_at!==result.occurred_at)fail(409,'Provider occurrence conflicts with original event');
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
        scopedReference,
        result.status,
        result.amount_minor,
        result.currency,
        now(),
      ],
    );
    let related:any;
    if(result.related_reference){related=await dbGet('SELECT e.* FROM ac_events e LEFT JOIN ac_payment_event_details d ON d.event_id=e.id WHERE e.org_id=? AND e.environment=? AND e.request_id=? AND e.status=? AND (d.provider_reference=? OR e.provider_ref=?) AND (d.event_id IS NULL OR (d.provider=? AND d.account_id=?))',[a.org,a.environment,request.id,'succeeded',result.related_reference,result.related_reference,provider,accountId]);if(!related||related.request_id!==request.id||related.currency!==result.currency)fail(409,'Reversal must identify the original confirmed payment');}
    await dbRun('INSERT INTO ac_payment_event_details(event_id,provider,account_id,provider_reference,occurred_at,time_basis,related_event_id) VALUES (?,?,?,?,?,?,?)',[eventId,provider,accountId,result.reference,occurred,result.time_basis||'provider_occurrence',related?.id||null]);
    if(['reversed','refunded'].includes(result.status)&&related){
      const earlier=await dbAll("SELECT e.amount_minor FROM ac_events e JOIN ac_payment_event_details d ON d.event_id=e.id WHERE d.related_event_id=? AND e.id<>? AND e.status IN ('reversed','refunded')",[related.id,eventId]);
      const returned=sumMinor(earlier.map(r=>r.amount_minor));if(returned+result.amount_minor>Number(related.amount_minor))fail(409,'Return exceeds original confirmed payment');
      if(result.status==='reversed'&&result.amount_minor!==Number(related.amount_minor))fail(409,'A full reversal must equal the original payment');
      const rows=await dbAll('SELECT document_id,SUM(amount_minor) AS amount_minor FROM ac_effective_allocations WHERE event_id=? AND org_id=? AND environment=? GROUP BY document_id ORDER BY document_id',[related.id,a.org,a.environment]);
      const allocated=sumMinor(rows.map(r=>r.amount_minor));let remaining=Math.max(0,result.amount_minor-(Number(related.amount_minor)-returned-allocated));
      for(const row of rows){const amount=Math.min(remaining,Number(row.amount_minor));if(amount<=0)continue;await dbRun('INSERT INTO ac_allocation_changes(id,org_id,environment,event_id,document_id,amount_minor,reason,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[randomUUID(),a.org,a.environment,related.id,row.document_id,-amount,result.status+':'+eventId,occurred,now()]);remaining-=amount;await refreshDocument(a,row.document_id);}
      for(const [account,debit,credit] of [['provider_collections',0,result.amount_minor],['receivables',Math.max(0,result.amount_minor-(Number(related.amount_minor)-returned-allocated)),0],['unallocated_collections',Math.min(result.amount_minor,Number(related.amount_minor)-returned-allocated),0]] as const){if(!debit&&!credit)continue;await dbRun('INSERT INTO ac_journal(id,org_id,environment,event_id,account,debit_minor,credit_minor,currency,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[randomUUID(),a.org,a.environment,eventId,account,debit,credit,result.currency,now()]);}
      await dbRun('UPDATE ac_requests SET status=? WHERE id=?',[result.status,request.id]);await audit(a.org,a.actor,'payment.'+result.status,eventId);await enqueue(a,'payment.'+result.status,{event_id:eventId,request_id:request.id,related_event_id:related.id,amount_minor:result.amount_minor,currency:result.currency});return {event_id:eventId,status:result.status,reconciliation:result.status};
    }
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
      'SELECT COALESCE(SUM(amount_minor),0) AS total FROM ac_effective_allocations WHERE document_id=? AND org_id=? AND environment=?',
      [doc.id, a.org, a.environment],
    );
    const paid = Number(allocations.total);
    const balance=await documentBalance(a,doc.id);
    let exception: string | undefined;
    if (['reversed','refunded'].includes(result.status)) exception = 'reversal_requires_review';
    else if (
      ['cancelled', 'expired'].includes(request.status) ||
      request.expires_at < now()
    )
      exception = 'closed_request';
    else if (doc.kind === 'orders' && doc.fulfillment_status === 'cancelled')
      exception = 'cancelled_order';
    else if (result.currency !== request.currency)
      exception = 'currency_mismatch';
    else if (result.amount_minor > balance.outstanding_minor || result.amount_minor > Number(request.amount_minor))
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
        paid + result.amount_minor + balance.credited_minor === doc.total_minor
          ? 'paid'
          : 'partially_paid';
      await update(a, doc.id, {
        ...doc,
        status,
        paid_minor: paid + result.amount_minor,credited_minor:balance.credited_minor,
        ...(doc.kind === 'orders' ? { payment_status: status } : {}),
      });
      if (doc.order_id) {
        const order = await record(a, doc.order_id, 'orders');
        await update(a, order.id, { ...order, payment_status: status,paid_minor:paid+result.amount_minor,credited_minor:balance.credited_minor });
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
    } else if (!['paid','partially_paid','reversed','refunded'].includes(request.status) && result.status === 'failed') {
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
