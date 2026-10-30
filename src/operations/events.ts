import { randomUUID } from 'node:crypto';
import { dbGet, dbRun } from '../db';
import type { Access } from '../platform/auth';
import { now } from '../platform/crypto';
export const stage2Events = [
  'invoice.overdue',
  'cashflow.forecast_updated',
  'automation.run_failed',
  'shipment.created',
  'shipment.shipped',
  'shipment.delivered',
  'delivery.confirmed',
  'protected_payment.created',
  'protected_payment.payment_confirmed',
  'protected_payment.disputed',
  'protected_payment.release_confirmed',
  'protected_payment.refund_confirmed',
  'dispute.created',
  'dispute.resolved',
  'approval.requested',
  'approval.decided',
  'approval.expired',
  'product.created',
  'product.updated',
  'crm.entry_created',
  'quotation.created',
  'quotation.mark_shared',
  'quotation.accept',
  'quotation.cancel',
  'quotation.convert',
  'draft_invoice.prepared',
  'stock.receipt',
  'stock.return',
  'stock.transfer',
  'stock.adjustment',
  'stock.dispatch',
  'stock.reserved',
  'stock.released',
  'integration.sync_failed',
  'integration.synced',
] as const;
/** Append-only provenance record. Caller and outbox participate in the same transaction. */
export async function capture(
  a: Access,
  type: string,
  payload: any,
  options: {
    key?: string;
    source?: string;
    assurance?: string;
    correlation?: string;
  } = {},
) {
  const id = randomUUID(),
    key = options.key || id,
    resource = payload.id || payload.request_id || payload.event_id || null;
  const result = await dbRun(
    'INSERT INTO ac2_events(id,org_id,environment,event_type,resource_id,actor,source,assurance,correlation_id,dedupe_key,payload,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,dedupe_key) DO NOTHING',
    [
      id,
      a.org,
      a.environment,
      type,
      resource,
      a.actor,
      options.source || 'africore_service',
      options.assurance ||
        (a.environment === 'sandbox' ? 'sandbox_simulated' : 'system_recorded'),
      options.correlation || resource || id,
      key,
      JSON.stringify(payload),
      now(),
    ],
  );
  return { id, inserted: result.changes > 0 };
}
export async function emit(
  a: Access,
  type: string,
  payload: any,
  options: Parameters<typeof capture>[3] = {},
) {
  const event = await capture(a, type, payload, options);
  if (event.inserted) {
    const { enqueue } = await import('../platform/payments');
    await enqueue(a, type, { ...payload, domain_event_id: event.id }, false);
  }
  return event;
}
