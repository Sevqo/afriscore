import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { configureTestEnv } from './helpers';
configureTestEnv('platform');
import { migrate, dbGet, dbAll, dbRun, closeDb } from '../db';
import { createApp } from '../app';
import { totals, documentSchema, permitted } from '../platform/domain';
import { processProviderResult } from '../platform/payments';
import { createHmac } from 'node:crypto';
import { seal, unseal } from '../platform/crypto';
let server: Server, base: string;
const unique = Date.now() + '-' + Math.random().toString(36).slice(2);
const email = (tag: string) => `${tag}-${unique}@example.test`;
async function request(
  path: string,
  method = 'GET',
  body?: any,
  cookie = '',
  headers: Record<string, string> = {},
) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  return {
    status: res.status,
    data,
    cookie: res.headers.get('set-cookie')?.split(';')[0] || '',
  };
}
let owner = '',
  other = '',
  org = '',
  customer = '',
  order = '',
  invoice = '',
  checkout = '',
  requestId = '';
before(async () => {
  await migrate();
  server = createApp().listen(0);
  await new Promise<void>((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + (server.address() as any).port;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await closeDb();
});
test('integer money, discounts, taxes and permissions', () => {
  const d = documentSchema.parse({
    customer_id: '12345678-1234-4234-8234-123456789abc',
    items: [{ description: 'A', quantity: 3, unit_price_minor: 1001 }],
    discount_minor: 3,
    tax_bps: 1600,
    issue_date: '2026-10-01',
    due_date: '2026-10-30',
  });
  assert.deepEqual(totals(d), {
    subtotal_minor: 3003,
    tax_minor: 480,
    total_minor: 3480,
  });
  assert.throws(() => totals({ ...d, discount_minor: 4000 }));
  assert.throws(() =>
    documentSchema.parse({
      ...d,
      items: [{ description: 'A', quantity: 1.5, unit_price_minor: 10 }],
    }),
  );
  assert.equal(permitted('viewer', 'finance'), false);
  assert.equal(permitted('operations', 'admin'), false);
  assert.equal(permitted('finance', 'finance'), true);
});
test('sign up, verify, create workspace and isolate another user', async () => {
  const u = await request('/api/auth/signup', 'POST', {
    email: email('owner'),
    password: 'a-strong-test-password',
  });
  assert.equal(u.status, 201);
  owner = u.cookie;
  assert.equal(
    (
      await request('/api/auth/verify', 'POST', {
        token: u.data.verification_token,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/api/auth/verify', 'POST', {
        token: u.data.verification_token,
      })
    ).status,
    400,
  );
  other = (
    await request('/api/auth/signup', 'POST', {
      email: email('other'),
      password: 'a-strong-test-password',
    })
  ).cookie;
  const r = await request(
    '/api/v1/organizations',
    'POST',
    {
      name: 'Test SME',
      business_type: 'Supplier',
      industry: 'Trade',
      location: 'Nairobi',
      email: email('business'),
      phone: '+254700000000',
    },
    owner,
  );
  assert.equal(r.status, 201);
  org = r.data.id;
  assert.equal(
    (
      await request(
        `/api/v1/organizations/${org}/records/customers`,
        'GET',
        undefined,
        other,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request(`/api/v1/organizations/${org}/records/customers`)).status,
    401,
  );
  const cross = await request('/api/v1/organizations', 'POST', {}, owner, {
    Origin: 'https://evil.example',
  });
  assert.equal(cross.status, 403);
});
test('customer, order and invoice persist with validated transitions', async () => {
  const prefix = `/api/v1/organizations/${org}`;
  let r = await request(
    prefix + '/records/customers',
    'POST',
    { name: 'Amina Shop' },
    owner,
  );
  assert.equal(r.status, 201);
  customer = r.data.id;
  const d = {
    customer_id: customer,
    items: [{ description: 'Delivery', quantity: 1, unit_price_minor: 10000 }],
    issue_date: '2026-10-01',
    due_date: '2026-10-30',
  };
  r = await request(prefix + '/records/orders', 'POST', d, owner);
  assert.equal(r.status, 201);
  order = r.data.id;
  await request(
    prefix + '/records/orders/' + order,
    'PATCH',
    { status: 'awaiting_payment' },
    owner,
  );
  r = await request(
    prefix + '/records/invoices',
    'POST',
    { ...d, order_id: order },
    owner,
  );
  assert.equal(r.status, 201);
  invoice = r.data.id;
  assert.equal(
    (
      await request(
        prefix + '/payment-requests',
        'POST',
        { document_id: invoice },
        owner,
        { 'Idempotency-Key': 'draft-denied' },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        prefix + '/records/invoices/' + invoice,
        'PATCH',
        { status: 'issued' },
        owner,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        prefix + '/records/invoices/' + invoice,
        'PATCH',
        { status: 'paid' },
        owner,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        prefix + '/records/invoices/' + invoice,
        'GET',
        undefined,
        other,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        prefix + '/records/invoices/' + invoice,
        'GET',
        undefined,
        owner,
        { 'X-Environment': 'production' },
      )
    ).status,
    404,
  );
});
test('checkout delayed then success, duplicates, reconciliation, balanced journal, reports and export', async () => {
  const prefix = `/api/v1/organizations/${org}`;
  const r = await request(
    prefix + '/payment-requests',
    'POST',
    { document_id: invoice },
    owner,
    { 'Idempotency-Key': 'invoice-payment-001' },
  );
  assert.equal(r.status, 201);
  requestId = r.data.id;
  checkout = r.data.checkout_url.split('/').pop();
  const retry = await request(
    prefix + '/payment-requests',
    'POST',
    { document_id: invoice },
    owner,
    { 'Idempotency-Key': 'invoice-payment-001' },
  );
  assert.equal(retry.status, 200);
  assert.equal(retry.data.id, r.data.id);
  assert.equal(
    (await request('/api/v1/checkout/' + checkout)).data.merchant,
    'Test SME',
  );
  assert.equal(
    (
      await request('/api/v1/checkout/' + checkout + '/pay', 'POST', {
        scenario: 'delayed',
      })
    ).data.status,
    'pending',
  );
  assert.equal(
    (
      await request('/api/v1/checkout/' + checkout + '/pay', 'POST', {
        scenario: 'success',
      })
    ).data.reconciliation,
    'matched',
  );
  assert.equal(
    (
      await request('/api/v1/checkout/' + checkout + '/pay', 'POST', {
        scenario: 'duplicate',
      })
    ).data.duplicate,
    true,
  );
  const doc = (
    await request(
      prefix + '/records/invoices/' + invoice,
      'GET',
      undefined,
      owner,
    )
  ).data;
  assert.equal(doc.status, 'paid');
  assert.equal(doc.paid_minor, 10000);
  assert.equal(
    (
      await request(
        prefix + '/records/orders/' + order,
        'GET',
        undefined,
        owner,
      )
    ).data.payment_status,
    'paid',
  );
  const reconciliation = await request(
    prefix + '/reconciliation',
    'GET',
    undefined,
    owner,
  );
  assert.equal(reconciliation.data.allocations.length, 1);
  const journal = await dbGet(
    'SELECT SUM(debit_minor) AS debit,SUM(credit_minor) AS credit FROM ac_journal WHERE org_id=?',
    [org],
  );
  assert.equal(Number(journal.debit), Number(journal.credit));
  assert.equal(Number(journal.debit), 10000);
  const report = (await request(prefix + '/report', 'GET', undefined, owner))
    .data;
  assert.equal(report.confirmed_inflows_minor, 10000);
  assert.equal(report.outstanding_minor, 0);
  const csv = await fetch(base + prefix + '/report?format=csv', {
    headers: { Cookie: owner },
  });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /total_minor/);
});
test('out-of-order and mismatched results preserve financial state and enter exception queue', async () => {
  await processProviderResult(requestId, {
    reference: 'late-failure-' + unique,
    status: 'failed',
    amount_minor: 10000,
    currency: 'KES',
  });
  const r = await processProviderResult(requestId, {
    reference: 'mismatch-' + unique,
    status: 'succeeded',
    amount_minor: 10000,
    currency: 'USD',
  });
  assert.equal(r.reconciliation, 'currency_mismatch');
  const reversal = await request(
    '/api/v1/checkout/' + checkout + '/pay',
    'POST',
    { scenario: 'reversed' },
  );
  assert.equal(reversal.data.reconciliation, 'reversal_requires_review');
  const row = await dbGet('SELECT data FROM ac_records WHERE id=?', [invoice]);
  assert.equal(JSON.parse(row.data).status, 'paid');
});
test('scoped API credential isolation, storage and revocation; webhook signature secret encryption', async () => {
  const prefix = `/api/v1/organizations/${org}`;
  const app = await request(
    prefix + '/records/applications',
    'POST',
    { name: 'Test integration' },
    owner,
  );
  const key = await request(
    prefix + '/credentials',
    'POST',
    { application_id: app.data.id, scopes: ['read'] },
    owner,
  );
  assert.equal(key.status, 201);
  const headers = { Authorization: 'Bearer ' + key.data.key };
  assert.equal(
    (
      await request(
        prefix + '/records/customers',
        'GET',
        undefined,
        '',
        headers,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        prefix + '/records/customers',
        'POST',
        { name: 'No' },
        '',
        headers,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(prefix + '/records/customers', 'GET', undefined, '', {
        ...headers,
        'X-Environment': 'production',
      })
    ).status,
    403,
  );
  const stored = await dbGet('SELECT key_hash FROM ac_credentials WHERE id=?', [
    key.data.id,
  ]);
  assert.notEqual(stored.key_hash, key.data.key);
  await request(prefix + '/credentials/' + key.data.id, 'DELETE', {}, owner);
  assert.equal(
    (
      await request(
        prefix + '/records/customers',
        'GET',
        undefined,
        '',
        headers,
      )
    ).status,
    403,
  );
  const hook = await request(
    prefix + '/webhooks',
    'POST',
    { url: 'https://example.com/hooks', subscriptions: ['invoice.created'] },
    owner,
  );
  assert.equal(hook.status, 201);
  const ep = await dbGet('SELECT secret FROM ac_endpoints WHERE id=?', [
    hook.data.id,
  ]);
  assert.notEqual(ep.secret, hook.data.secret);
  assert.equal(unseal(ep.secret), hook.data.secret);
  const signed = createHmac('sha256', unseal(ep.secret))
    .update('123.raw')
    .digest('hex');
  assert.equal(
    signed,
    createHmac('sha256', hook.data.secret).update('123.raw').digest('hex'),
  );
  assert.equal(unseal(seal('test-secret')), 'test-secret');
  const d = {
    customer_id: customer,
    items: [{ description: 'Next', quantity: 1, unit_price_minor: 100 }],
    issue_date: '2026-10-01',
    due_date: '2026-10-30',
  };
  await request(prefix + '/records/invoices', 'POST', d, owner);
  const delivery = await dbGet(
    'SELECT * FROM ac_deliveries WHERE endpoint_id=?',
    [hook.data.id],
  );
  assert.equal(delivery.status, 'pending');
  assert.equal(JSON.parse(delivery.payload).type, 'invoice.created');
  assert.equal(
    (await request('/api/v1/internal', 'GET', undefined, owner)).status,
    403,
  );
});
test('transaction import deduplicates and does not confirm provider payment', async () => {
  const path = `/api/v1/organizations/${org}/import`,
    body = {
      rows: [
        {
          external_id: 'csv-' + unique,
          amount_minor: 3000,
          currency: 'KES',
          type: 'inflow',
          occurred_at: '2026-10-01T10:00:00Z',
          source: 'csv',
        },
      ],
    };
  assert.equal((await request(path, 'POST', body, owner)).data.imported, 1);
  assert.equal((await request(path, 'POST', body, owner)).data.duplicates, 1);
  const rows = await dbAll(
    "SELECT data FROM ac_records WHERE org_id=? AND kind='transactions'",
    [org],
  );
  assert.equal(JSON.parse(rows[0].data).provider_verified, false);
});
test('viewer invitation enforces backend roles and session revocation', async () => {
  const invite = await request(
    `/api/v1/organizations/${org}/invitations`,
    'POST',
    { email: email('other'), role: 'viewer' },
    owner,
  );
  assert.equal(invite.status, 201);
  assert.equal(
    (
      await request(
        '/api/v1/invitations/accept',
        'POST',
        { token: invite.data.token },
        other,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/v1/organizations/${org}/records/customers`,
        'GET',
        undefined,
        other,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/v1/organizations/${org}/records/customers`,
        'POST',
        { name: 'Denied' },
        other,
      )
    ).status,
    403,
  );
  const recovered = await request('/api/auth/recover', 'POST', {
    email: email('other'),
  });
  assert.equal(recovered.status, 200);
  assert.equal(
    (
      await request('/api/auth/reset', 'POST', {
        token: recovered.data.recovery_token,
        password: 'new-strong-password-value',
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/api/auth/me', 'GET', undefined, other)).status,
    401,
  );
});

// Cross-process persistence and cryptographic delivery tests use a controlled transport.
test('webhook worker signs raw payload, retries errors and reaches dead letter with authorized replay', async () => {
  const { deliverWebhooks } = await import('../platform/payments');
  const ep = await dbGet('SELECT * FROM ac_endpoints WHERE org_id=?', [org]);
  const delivery = await dbGet(
    'SELECT * FROM ac_deliveries WHERE endpoint_id=?',
    [ep.id],
  );
  let received: any;
  const transport: typeof fetch = async (_url, init) => {
    received = init;
    return new Response('ok', { status: 200 });
  };
  await deliverWebhooks(org, transport, async () => ({ allowed: true }));
  const headers = received.headers as Record<string, string>,
    signature = headers['AfriCore-Signature'];
  const timestamp = signature.match(/t=(\d+)/)![1],
    digest = signature.match(/v1=([a-f0-9]+)/)![1];
  assert.equal(
    digest,
    createHmac('sha256', unseal(ep.secret))
      .update(timestamp + '.' + received.body)
      .digest('hex'),
  );
  assert.equal(headers['AfriCore-Delivery'], delivery.id);
  assert.equal(
    (await dbGet('SELECT status FROM ac_deliveries WHERE id=?', [delivery.id]))
      .status,
    'delivered',
  );
  const replay = await request(
    `/api/v1/organizations/${org}/deliveries/${delivery.id}/replay`,
    'POST',
    {},
    owner,
  );
  assert.equal(replay.status, 200);
  const failing: typeof fetch = async () =>
    new Response('fail', { status: 500 });
  for (let i = 0; i < 5; i++) {
    await (
      await import('../db')
    ).dbRun('UPDATE ac_deliveries SET next_at=? WHERE id=?', [
      '2000-01-01T00:00:00Z',
      delivery.id,
    ]);
    await deliverWebhooks(org, failing, async () => ({ allowed: true }));
  }
  const failed = await dbGet('SELECT * FROM ac_deliveries WHERE id=?', [
    delivery.id,
  ]);
  assert.equal(failed.status, 'dead_letter');
  assert.equal(failed.attempts, 5);
});
test('partial collection and concurrent duplicates never overallocate', async () => {
  const prefix = `/api/v1/organizations/${org}`;
  const d = {
    customer_id: customer,
    items: [{ description: 'Partial', quantity: 1, unit_price_minor: 10001 }],
    issue_date: '2026-10-01',
    due_date: '2026-10-30',
  };
  const doc = await request(prefix + '/records/invoices', 'POST', d, owner);
  await request(
    prefix + '/records/invoices/' + doc.data.id,
    'PATCH',
    { status: 'issued' },
    owner,
  );
  const payment = await request(
    prefix + '/payment-requests',
    'POST',
    { document_id: doc.data.id },
    owner,
    { 'Idempotency-Key': 'partial-' + unique },
  );
  const token = payment.data.checkout_url.split('/').pop();
  const partial = await request('/api/v1/checkout/' + token + '/pay', 'POST', {
    scenario: 'partial',
  });
  assert.equal(partial.data.reconciliation, 'matched');
  const row = (
    await request(
      prefix + '/records/invoices/' + doc.data.id,
      'GET',
      undefined,
      owner,
    )
  ).data;
  assert.equal(row.paid_minor, 5000);
  assert.equal(row.status, 'partially_paid');
  const next = await request(
    prefix + '/payment-requests',
    'POST',
    { document_id: doc.data.id },
    owner,
    { 'Idempotency-Key': 'rest-' + unique },
  );
  const nextToken = next.data.checkout_url.split('/').pop();
  const results = await Promise.all([
    request('/api/v1/checkout/' + nextToken + '/pay', 'POST', {
      scenario: 'success',
    }),
    request('/api/v1/checkout/' + nextToken + '/pay', 'POST', {
      scenario: 'success',
    }),
  ]);
  assert.equal(results.filter((r) => r.data.duplicate).length, 1);
  const final = (
    await request(
      prefix + '/records/invoices/' + doc.data.id,
      'GET',
      undefined,
      owner,
    )
  ).data;
  assert.equal(final.paid_minor, 10001);
  assert.equal(final.status, 'paid');
});

test('signed callbacks reject forged and expired events', async () => {
  process.env.AFRICORE_SANDBOX_CALLBACK_SECRET =
    'test-only-sandbox-callback-key-at-least-32-characters';
  const body = {
    request_id: requestId,
    reference: 'callback-pending-' + unique,
    status: 'pending',
    amount_minor: 10000,
    currency: 'KES',
  };
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac(
    'sha256',
    process.env.AFRICORE_SANDBOX_CALLBACK_SECRET,
  )
    .update(timestamp + '.' + JSON.stringify(body))
    .digest('hex');
  const headers = {
    'AfriCore-Timestamp': timestamp,
    'AfriCore-Signature': signature,
  };
  assert.equal(
    (await request('/api/v1/callbacks/sandbox', 'POST', body, '', headers))
      .status,
    200,
  );
  assert.equal(
    (
      await request('/api/v1/callbacks/sandbox', 'POST', body, '', {
        ...headers,
        'AfriCore-Signature': 'a'.repeat(64),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request('/api/v1/callbacks/sandbox', 'POST', body, '', {
        ...headers,
        'AfriCore-Timestamp': '1000000000',
      })
    ).status,
    401,
  );
  assert.equal(
    (await request('/api/v1/callbacks/mpesa', 'POST', body, '', headers))
      .status,
    503,
  );
});

test('direct order collections update independent payment status and prevent reinvoicing', async () => {
  const prefix = `/api/v1/organizations/${org}`;
  const d = {
    customer_id: customer,
    items: [
      { description: 'Direct order', quantity: 1, unit_price_minor: 5000 },
    ],
    issue_date: '2026-10-01',
    due_date: '2026-10-30',
  };
  const order = await request(prefix + '/records/orders', 'POST', d, owner);
  await request(
    prefix + '/records/orders/' + order.data.id,
    'PATCH',
    { status: 'awaiting_payment' },
    owner,
  );
  const payment = await request(
    prefix + '/payment-requests',
    'POST',
    { document_id: order.data.id },
    owner,
    { 'Idempotency-Key': 'direct-order-' + unique },
  );
  assert.equal(payment.status, 201);
  const settled = await request(
    '/api/v1/checkout/' + payment.data.checkout_url.split('/').pop() + '/pay',
    'POST',
    { scenario: 'success' },
  );
  assert.equal(settled.status, 200);
  const saved = (
    await request(
      prefix + '/records/orders/' + order.data.id,
      'GET',
      undefined,
      owner,
    )
  ).data;
  assert.equal(saved.payment_status, 'paid');
  assert.equal(saved.fulfillment_status, 'unfulfilled');
  assert.equal(
    (
      await request(
        prefix + '/records/invoices',
        'POST',
        { ...d, order_id: order.data.id },
        owner,
      )
    ).status,
    409,
  );
});

test('webhook listing and replay respect environment isolation', async () => {
  const prefix = `/api/v1/organizations/${org}`;
  const production = await request(
    prefix + '/webhooks',
    'GET',
    undefined,
    owner,
    { 'X-Environment': 'production' },
  );
  assert.equal(production.status, 200);
  assert.deepEqual(production.data.deliveries, []);
  const delivery = await dbGet('SELECT id FROM ac_deliveries WHERE org_id=?', [
    org,
  ]);
  assert.equal(
    (
      await request(
        prefix + '/deliveries/' + delivery.id + '/replay',
        'POST',
        {},
        owner,
        { 'X-Environment': 'production' },
      )
    ).status,
    404,
  );
});

test('record search and status filters run before stable pagination and keep wildcard text literal', async () => {
  const outsider = (
    await request('/api/auth/signup', 'POST', {
      email: email('isolated-' + Math.random()),
      password: 'audit-only-strong-password',
    })
  ).cookie;
  const prefix = `/api/v1/organizations/${org}`;
  const target = await request(
    prefix + '/records/customers',
    'POST',
    { name: 'Older target 100%_ literal' },
    owner,
  );
  assert.equal(target.status, 201);
  await dbRun('UPDATE ac_records SET created_at=? WHERE id=?', [
    '2020-01-01T00:00:00Z',
    target.data.id,
  ]);
  await request(
    prefix + '/records/customers',
    'POST',
    { name: 'Newer unrelated customer' },
    owner,
  );
  const search = await request(
    prefix + '/records/customers?limit=1&q=' + encodeURIComponent('100%_'),
    'GET',
    undefined,
    owner,
  );
  assert.equal(search.data.data.length, 1);
  assert.equal(search.data.data[0].id, target.data.id);
  const absent = await request(
    prefix +
      '/records/customers?limit=1&q=' +
      encodeURIComponent('100%_does-not-exist'),
    'GET',
    undefined,
    owner,
  );
  assert.deepEqual(absent.data.data, []);
  const doc = {
    customer_id: customer,
    items: [
      { description: 'Filter fixture', quantity: 1, unit_price_minor: 100 },
    ],
    issue_date: '2026-10-01',
    due_date: '2026-10-30',
    notes: 'status-pagination-fixture',
  };
  const issued = await request(
    prefix + '/records/invoices',
    'POST',
    doc,
    owner,
  );
  await request(
    prefix + '/records/invoices/' + issued.data.id,
    'PATCH',
    { status: 'issued' },
    owner,
  );
  await dbRun('UPDATE ac_records SET created_at=? WHERE id=?', [
    '2020-01-01T00:00:00Z',
    issued.data.id,
  ]);
  await request(prefix + '/records/invoices', 'POST', doc, owner);
  const filtered = await request(
    prefix +
      '/records/invoices?limit=1&status=issued&q=status-pagination-fixture',
    'GET',
    undefined,
    owner,
  );
  assert.equal(filtered.data.data[0].id, issued.data.id);
  const pageA = await request(
    prefix + '/records/customers?limit=1',
    'GET',
    undefined,
    owner,
  );
  const pageB = await request(
    prefix + '/records/customers?limit=1&offset=1',
    'GET',
    undefined,
    owner,
  );
  assert.notEqual(pageA.data.data[0].id, pageB.data.data[0].id);
  assert.equal(
    (
      await request(
        prefix + '/records/customers?limit=1&q=target',
        'GET',
        undefined,
        outsider,
      )
    ).status,
    403,
  );
  assert.deepEqual(
    (
      await request(
        prefix + '/records/customers?q=target',
        'GET',
        undefined,
        owner,
        { 'X-Environment': 'production' },
      )
    ).data.data,
    [],
  );
});

test('retailer journey allocates KSh 1500 then KSh 1000, updates order and report, survives rereads and rejects replay', async () => {
  const outsider = (
    await request('/api/auth/signup', 'POST', {
      email: email('isolated-' + Math.random()),
      password: 'audit-only-strong-password',
    })
  ).cookie;
  const prefix = `/api/v1/organizations/${org}`;
  const doc = {
    customer_id: customer,
    items: [
      {
        description: 'Journey supplies',
        quantity: 1,
        unit_price_minor: 250000,
      },
    ],
    issue_date: '2026-10-01',
    due_date: '2026-10-30',
  };
  const saleOrder = await request(
    prefix + '/records/orders',
    'POST',
    doc,
    owner,
  );
  assert.equal(saleOrder.status, 201);
  await request(
    prefix + '/records/orders/' + saleOrder.data.id,
    'PATCH',
    { status: 'awaiting_payment' },
    owner,
  );
  const inv = await request(
    prefix + '/records/invoices',
    'POST',
    { ...doc, order_id: saleOrder.data.id },
    owner,
  );
  assert.equal(inv.status, 201);
  await request(
    prefix + '/records/invoices/' + inv.data.id,
    'PATCH',
    { status: 'issued' },
    owner,
  );
  const baseline = (await request(prefix + '/report', 'GET', undefined, owner))
    .data;
  const payment = await request(
    prefix + '/payment-requests',
    'POST',
    { document_id: inv.data.id },
    owner,
    { 'Idempotency-Key': 'journey-payment-' + unique },
  );
  assert.equal(payment.status, 201);
  process.env.AFRICORE_SANDBOX_CALLBACK_SECRET =
    'test-only-sandbox-callback-key-at-least-32-characters';
  async function callback(
    request_id: string,
    reference: string,
    amount_minor: number,
  ) {
    const body = {
      request_id,
      reference,
      status: 'succeeded',
      amount_minor,
      currency: 'KES',
    };
    const stamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac(
      'sha256',
      process.env.AFRICORE_SANDBOX_CALLBACK_SECRET!,
    )
      .update(stamp + '.' + JSON.stringify(body))
      .digest('hex');
    return request('/api/v1/callbacks/sandbox', 'POST', body, '', {
      'AfriCore-Timestamp': stamp,
      'AfriCore-Signature': signature,
    });
  }
  const first = await callback(
    payment.data.id,
    'journey-first-' + unique,
    150000,
  );
  assert.equal(first.status, 200);
  assert.equal(first.data.reconciliation, 'matched');
  const partial = (
    await request(
      prefix + '/records/invoices/' + inv.data.id,
      'GET',
      undefined,
      owner,
    )
  ).data;
  assert.equal(partial.status, 'partially_paid');
  assert.equal(partial.total_minor - partial.paid_minor, 100000);
  const remainder = await request(
    prefix + '/payment-requests',
    'POST',
    { document_id: inv.data.id },
    owner,
    { 'Idempotency-Key': 'journey-remainder-' + unique },
  );
  assert.equal(remainder.data.amount_minor, 100000);
  const final = await callback(
    remainder.data.id,
    'journey-final-' + unique,
    100000,
  );
  assert.equal(final.status, 200);
  const replay = await callback(
    remainder.data.id,
    'journey-final-' + unique,
    100000,
  );
  assert.equal(replay.data.duplicate, true);
  for (let read = 0; read < 2; read++) {
    const saved = (
      await request(
        prefix + '/records/invoices/' + inv.data.id,
        'GET',
        undefined,
        owner,
      )
    ).data;
    assert.equal(saved.status, 'paid');
    assert.equal(saved.paid_minor, 250000);
  }
  assert.equal(
    (
      await request(
        prefix + '/records/orders/' + saleOrder.data.id,
        'GET',
        undefined,
        owner,
      )
    ).data.payment_status,
    'paid',
  );
  const report = (await request(prefix + '/report', 'GET', undefined, owner))
    .data;
  assert.equal(
    report.confirmed_inflows_minor - baseline.confirmed_inflows_minor,
    250000,
  );
  assert.equal(baseline.outstanding_minor - report.outstanding_minor, 250000);
  const allocations = await dbAll(
    'SELECT * FROM ac_allocations WHERE document_id=?',
    [inv.data.id],
  );
  assert.equal(allocations.length, 2);
  assert.equal(
    allocations.reduce((sum, a) => sum + Number(a.amount_minor), 0),
    250000,
  );
  const csv = await fetch(base + prefix + '/report?format=csv', {
    headers: { Cookie: owner },
  });
  assert.equal(csv.status, 200);
  assert.ok((await csv.text()).includes(inv.data.reference));
  assert.equal(
    (
      await request(
        prefix + '/records/invoices/' + inv.data.id,
        'GET',
        undefined,
        outsider,
      )
    ).status,
    403,
  );
});

test('recovery revokes existing sessions, consumes the token once and permits only the new password', async () => {
  const address = email('recovery-audit'),
    oldPassword = 'test-old-password-strong',
    newPassword = 'new-pass';
  const signup = await request('/api/auth/signup', 'POST', {
    email: address,
    password: oldPassword,
  });
  assert.equal(signup.status, 201);
  await request('/api/auth/verify', 'POST', {
    token: signup.data.verification_token,
  });
  const signin = await request('/api/auth/signin', 'POST', {
    email: address,
    password: oldPassword,
  });
  assert.equal(signin.status, 200);
  assert.equal(
    (await request('/api/auth/me', 'GET', undefined, signin.cookie)).status,
    200,
  );
  const recovery = await request('/api/auth/recover', 'POST', {
    email: address,
  });
  assert.equal(recovery.status, 200);
  assert.equal(
    (
      await request('/api/auth/reset', 'POST', {
        token: recovery.data.recovery_token,
        password: newPassword,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/api/auth/me', 'GET', undefined, signin.cookie)).status,
    401,
  );
  assert.equal(
    (
      await request('/api/auth/reset', 'POST', {
        token: recovery.data.recovery_token,
        password: newPassword,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/auth/signin', 'POST', {
        email: address,
        password: oldPassword,
      })
    ).status,
    401,
  );
  const fresh = await request('/api/auth/signin', 'POST', {
    email: address,
    password: newPassword,
  });
  assert.equal(fresh.status, 200);
  assert.equal(
    (await request('/api/auth/signout', 'POST', {}, fresh.cookie)).status,
    200,
  );
  assert.equal(
    (await request('/api/auth/me', 'GET', undefined, fresh.cookie)).status,
    401,
  );
});

test('customer corrections permit clearing optional contact data and reject blank names without losing history', async () => {
  const prefix = `/api/v1/organizations/${org}`;
  const created = await request(
    prefix + '/records/customers',
    'POST',
    { name: 'Correction customer', email: 'old@example.test' },
    owner,
  );
  assert.equal(created.status, 201);
  const updated = await request(
    prefix + '/records/customers/' + created.data.id,
    'PATCH',
    {
      name: '  Updated customer  ',
      email: '',
      phone: '',
      notes: 'Corrected contact',
    },
    owner,
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.data.name, 'Updated customer');
  assert.equal(updated.data.email, '');
  assert.equal(
    (
      await request(
        prefix + '/records/customers/' + created.data.id,
        'PATCH',
        { name: '   ' },
        owner,
      )
    ).status,
    400,
  );
  const saved = (
    await request(
      prefix + '/records/customers/' + created.data.id,
      'GET',
      undefined,
      owner,
    )
  ).data;
  assert.equal(saved.name, 'Updated customer');
  assert.equal(saved.notes, 'Corrected contact');
  const history = await dbAll('SELECT * FROM ac_audit WHERE resource_id=?', [
    created.data.id,
  ]);
  assert.ok(history.length >= 2);
});

test('existing eight-character passwords authenticate and new signup rejects seven characters',async()=>{
  const {passwordHash}=await import('../platform/crypto');
  const address=email('existing-short');
  const account=await request('/api/auth/signup','POST',{email:address,password:'a long unique test phrase'});
  assert.equal(account.status,201);
  await dbRun('UPDATE ac_users SET password_hash=? WHERE id=?',[await passwordHash('old-pass'),account.data.id]);
  const login=await request('/api/auth/signin','POST',{email:address,password:'old-pass'});
  assert.equal(login.status,200);assert.equal(login.data.id,account.data.id);assert.ok(login.cookie);
  assert.equal((await request('/api/auth/signup','POST',{email:email('eight-new'),password:'quietbay'})).status,201);
  assert.equal((await request('/api/auth/signup','POST',{email:email('short-new'),password:'7-chars'})).status,400);
});
