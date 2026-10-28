import { z } from 'zod';
import { dbAll, dbGet, dbRun } from '../db';
import { Access, audit, fail } from '../platform/auth';
import { now } from '../platform/crypto';
import { all, atomic, change, create, get } from './store';
import { emit } from './events';
import { notify } from './automation';
import {requireServices,checkLimits,recordUsage} from '../marketplace/engine';
export const connectorCatalog = [
  {
    provider: 'sandbox_accounting',
    category: 'accounting',
    capabilities: ['expense_normalization'],
    authentication: 'sandbox_only',
    sync_frequency: 'manual',
    provider_rate_limit: '12 syncs/hour/workspace',
    retry: '3 attempts, exponential backoff',
    events: ['integration.synced', 'integration.sync_failed'],
    production_available: false,
  },
  {
    provider: 'sandbox_courier',
    category: 'delivery',
    capabilities: ['tracking_events'],
    authentication: 'sandbox_only',
    sync_frequency: 'manual',
    provider_rate_limit: '12 syncs/hour/workspace',
    retry: '3 attempts, exponential backoff',
    events: ['shipment.delivered'],
    production_available: false,
  },
  {
    provider: 'sandbox_store',
    category: 'commerce',
    capabilities: ['order_feed'],
    authentication: 'sandbox_only',
    sync_frequency: 'manual',
    provider_rate_limit: '12 syncs/hour/workspace',
    retry: '3 attempts, exponential backoff',
    events: ['integration.synced'],
    production_available: false,
  },
  {
    provider: 'csv',
    category: 'data',
    capabilities: ['transaction_import'],
    authentication: 'member_authorization',
    sync_frequency: 'manual',
    provider_rate_limit: '1000 rows/import',
    retry: 'explicit user retry with stable source identifiers',
    events: [],
    production_available: true,
  },
  {
    provider: 'mpesa',
    category: 'payments',
    capabilities: [],
    authentication: 'merchant_provider_credentials_required',
    production_available: false,
  },
  {
    provider: 'bank',
    category: 'banking',
    capabilities: [],
    authentication: 'authorized_partner_required',
    production_available: false,
  },
  {
    provider: 'etims',
    category: 'tax',
    capabilities: [],
    authentication: 'authorized_tax_provider_required',
    production_available: false,
  },
] as const;
export async function connect(a: Access, input: unknown) {
  const d = z
    .object({
      provider: z.enum([
        'sandbox_accounting',
        'sandbox_courier',
        'sandbox_store',
      ]),
      scenario: z
        .enum(['success', 'failure', 'transient_failure'])
        .default('success'),
    })
    .strict()
    .parse(input);
  if (a.environment !== 'sandbox')
    fail(503, 'No live connector adapter is enabled');
  return atomic(a, async () => {
    if (
      (await all(a, 'connectors')).some(
        (c) => c.provider === d.provider && c.status !== 'disconnected',
      )
    )
      fail(409, 'Connector already exists');
    return create(a, 'connectors', {
      ...d,
      status: 'configured',
      authorization_state: 'sandbox_simulated',
      attempts: 0,
      last_synced_at: null,
      next_retry_at: null,
      last_error: null,
      normalization_version: '1.0',
      last_batch_id: null,
      created_by: a.actor,
    });
  });
}
export async function sync(a: Access, id: string, at = new Date()) {
  return atomic(a, async () => {
    await requireServices(a,['connect']);
    let c = await get(a, id, 'connectors');
    if (a.role === 'system') {
      const member = await dbGet(
        'SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',
        [a.org, c.created_by],
      );
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return change(a, c, {
          status: 'failed',
          last_error: 'owner_permission_revoked',
          next_retry_at: null,
        });
      }
    }
    if (c.status === 'disconnected') fail(409, 'Reconnect before syncing');
    if (a.environment !== 'sandbox') fail(503, 'Live synchronization disabled');
    if (c.next_retry_at && c.next_retry_at > at.toISOString())
      return { id, status: c.status, retry_after: c.next_retry_at };
    if (c.attempts >= 3 && c.status === 'failed')
      fail(409, 'Retry limit reached; reconnect after repair');
    const recent = await dbGet(
      "SELECT COUNT(*) AS total FROM ac2_events WHERE org_id=? AND environment=? AND event_type IN ('integration.synced','integration.sync_failed') AND occurred_at>?",
      [a.org, a.environment, new Date(at.getTime() - 3600000).toISOString()],
    );
    if (Number(recent.total) >= 12) fail(429, 'Connector sync limit reached');
    const attempt = c.attempts + 1,
      shouldFail =
        c.scenario === 'failure' ||
        (c.scenario === 'transient_failure' && attempt === 1);
    if (shouldFail) {
      c = await change(a, c, {
        status: attempt >= 3 ? 'failed' : 'retrying',
        attempts: attempt,
        last_error: 'sandbox_provider_unavailable',
        next_retry_at:
          attempt >= 3
            ? null
            : new Date(at.getTime() + 1000 * 2 ** attempt).toISOString(),
      });
      await emit(a, 'integration.sync_failed', {
        id,
        provider: c.provider,
        attempt,
        terminal: attempt >= 3,
      });
      await notify(a, {
        category: 'integrations',
        title: 'Integration sync failed',
        body: 'The sandbox adapter reported an unavailable source. Retry status is visible in Integrations.',
        resource_id: id,
        key: 'sync:' + id + ':' + attempt,
      });
      return c;
    }
    // Deterministic reference data is isolated, never represented as a live balance or revenue.
    const batch = 'sandbox-batch-' + id;
    const alreadyCounted=await dbGet('SELECT id FROM ac_usage_events WHERE org_id=? AND environment=? AND service_id=? AND idempotency_key=?',[a.org,a.environment,'connect','connector:'+batch]);
    if(!alreadyCounted)await checkLimits(a,'connect',1);
    const sample = {
      schema_version: '1.0',
      external_id: batch,
      source: c.provider,
      provenance: 'sandbox_simulated',
      normalized_at: at.toISOString(),
      records:
        c.provider === 'sandbox_accounting'
          ? [
              {
                kind: 'expense',
                amount_minor: 125000,
                currency: 'KES',
                description:
                  'Synthetic accounting expense; import explicitly to use in reporting',
              },
            ]
          : c.provider === 'sandbox_courier'
            ? [
                {
                  kind: 'tracking',
                  status: 'out_for_delivery',
                  assurance: 'sandbox_courier_reported',
                },
              ]
            : [
                {
                  kind: 'order',
                  title: 'Synthetic store order',
                  requires_explicit_import: true,
                },
              ],
    };
    c = await change(a, c, {
      status: 'synced',
      attempts: 0,
      last_error: null,
      next_retry_at: null,
      last_synced_at: at.toISOString(),
      last_batch_id: batch,
      last_batch: sample,
    });
    await emit(
      a,
      'integration.synced',
      { id, provider: c.provider, batch_id: batch },
      { key: 'connector-batch:' + id + ':' + batch },
    );
    await recordUsage(a,'connect','connector:'+batch,1,'connector_batch_completed');
    return c;
  });
}
export async function connectorAction(a: Access, id: string, input: unknown) {
  const d = z
    .object({
      action: z.enum(['disconnect', 'reconnect']),
      scenario: z.enum(['success', 'failure', 'transient_failure']).optional(),
    })
    .strict()
    .parse(input);
  return atomic(a, async () => {
    const c = await get(a, id, 'connectors');
    const result = await change(a, c, {
      status: d.action === 'disconnect' ? 'disconnected' : 'configured',
      authorization_state:
        d.action === 'disconnect' ? 'revoked' : 'sandbox_simulated',
      attempts: 0,
      next_retry_at: null,
      last_error: null,
      ...(d.scenario ? { scenario: d.scenario } : {}),
    });
    await audit(a.org, a.actor, 'connector.' + d.action, id);
    return result;
  });
}
export async function riskSignals(a: Access) {
  const [events, shipments, disputes, reviews] = await Promise.all([
    dbAll('SELECT * FROM ac_events WHERE org_id=? AND environment=?', [
      a.org,
      a.environment,
    ]),
    all(a, 'shipments'),
    all(a, 'disputes'),
    all(a, 'risk_reviews'),
  ]);
  const signals: any[] = [];
  const failed = events.filter((e) => e.status === 'failed');
  if (failed.length >= 3)
    signals.push({
      id: 'failed-payments',
      rule: 'repeated_failed_payments',
      severity: 'review',
      evidence_ids: failed.map((e) => e.id),
      explanation:
        'Three or more failed provider results are present. Failures are not proof of fraud.',
    });
  const conflicting = shipments.filter(
    (s) =>
      s.status === 'delivered' &&
      disputes.some(
        (d) =>
          d.reason === 'not_delivered' &&
          d.protected_sale_id === s.protected_sale_id &&
          d.status !== 'resolved',
      ),
  );
  if (conflicting.length)
    signals.push({
      id: 'conflicting-delivery',
      rule: 'conflicting_delivery_claims',
      severity: 'review',
      evidence_ids: conflicting.map((s) => s.id),
      explanation:
        'Seller-reported delivery and an unresolved non-delivery complaint coexist.',
    });
  const exceptions = await dbAll(
    'SELECT id FROM ac_exceptions WHERE org_id=? AND environment=? AND status=?',
    [a.org, a.environment, 'pending_review'],
  );
  if (exceptions.length >= 3)
    signals.push({
      id: 'reconciliation-pattern',
      rule: 'multiple_reconciliation_exceptions',
      severity: 'review',
      evidence_ids: exceptions.map((e) => e.id),
      explanation:
        'Several unmatched or mismatched payment records require investigation.',
    });
  return {
    signals: signals.map((s) => ({
      ...s,
      review: reviews.find((r) => r.signal_id === s.id) || null,
    })),
    classification: 'explainable_review_signals',
    disclaimer:
      'No fraud determination, business penalty, credit score or financing approval is made.',
  };
}

/** Explicit, deduplicated import after a user reviews a normalized sandbox batch. */
export async function importConnectorBatch(a: Access, id: string) {
  return atomic(a, async () => {
    const c = await get(a, id, 'connectors');
    if (a.environment !== 'sandbox' || c.status !== 'synced' || !c.last_batch)
      fail(409, 'Synchronize a sandbox batch first');
    const { save } = await import('../platform/payments');
    const { hash } = await import('../platform/crypto');
    const stable = (label: string) => {
      const h = hash(a.org + ':' + a.environment + ':' + id + ':' + label);
      return (
        h.slice(0, 8) +
        '-' +
        h.slice(8, 12) +
        '-4' +
        h.slice(13, 16) +
        '-8' +
        h.slice(17, 20) +
        '-' +
        h.slice(20, 32)
      );
    };
    let imported = 0;
    if (c.provider === 'sandbox_accounting') {
      const recordId = stable('expense');
      if (!(await dbGet('SELECT id FROM ac_records WHERE id=?', [recordId]))) {
        await save(
          a,
          'transactions',
          {
            external_id: c.last_batch_id,
            amount_minor: 125000,
            currency: 'KES',
            type: 'outflow',
            occurred_at: now(),
            source: c.provider,
            provenance: 'sandbox_simulated',
            provider_verified: false,
            processing_status: 'recorded',
            imported_at: now(),
            normalization_version: '1.0',
          },
          recordId,
        );
        imported++;
      }
    } else if (c.provider === 'sandbox_store') {
      const customerId = stable('customer'),
        orderId = stable('order');
      if (!(await dbGet('SELECT id FROM ac_records WHERE id=?', [customerId])))
        await save(
          a,
          'customers',
          {
            name: 'Sandbox store customer',
            type: 'individual',
            email: '',
            phone: '',
            notes: 'Synthetic connector sample',
            source: c.provider,
            provenance: 'sandbox_simulated',
          },
          customerId,
        );
      if (!(await dbGet('SELECT id FROM ac_records WHERE id=?', [orderId]))) {
        const d = now().slice(0, 10);
        await save(
          a,
          'orders',
          {
            customer_id: customerId,
            items: [
              {
                description: 'Synthetic catalog item',
                quantity: 1,
                unit_price_minor: 50000,
              },
            ],
            currency: 'KES',
            subtotal_minor: 50000,
            total_minor: 50000,
            tax_minor: 0,
            tax_bps: 0,
            discount_minor: 0,
            issue_date: d,
            due_date: d,
            paid_minor: 0,
            payment_status: 'unpaid',
            fulfillment_status: 'unfulfilled',
            status: 'draft',
            reference: 'SBX-' + id.slice(0, 8).toUpperCase(),
            notes: 'Synthetic imported order; not live commerce.',
            source: c.provider,
            external_id: c.last_batch_id,
            provenance: 'sandbox_simulated',
          },
          orderId,
        );
        imported++;
      }
    } else {
      return {
        imported: 0,
        message:
          'Courier samples are informational; delivery assurance requires a shipment-bound evidence event.',
      };
    }
    await emit(
      a,
      'integration.records_imported',
      { id, batch_id: c.last_batch_id, imported },
      { key: 'connector-import:' + id + ':' + c.last_batch_id },
    );
    return { imported, duplicates: imported ? 0 : 1, environment: 'sandbox' };
  });
}
