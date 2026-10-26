/* Disposable connected demo. Public credentials. Never points at the normal/production DB. */
const fs = require('node:fs'),
  path = require('node:path');
process.env.OPENAI_API_KEY = '';
process.env.NODE_ENV = 'development';
process.env.AFRICORE_DEMO_SESSION = 'true';
process.env.DATABASE_URL = '';
process.env.DB_PATH = path.resolve(__dirname, '../.tmp/connected-demo.db');
process.env.PORT = '4001';
process.env.AFRICORE_PUBLIC_ORIGIN = 'http://127.0.0.1:4001';
process.env.AFRICORE_TRUST_OPERATOR_EMAILS = 'issuer@africore.localdemo';
process.env.AFRICORE_ENGINEERING_EMAILS = 'issuer@africore.localdemo';
process.env.AFRICORE_ANCHOR_RPC = '';
process.env.AFRICORE_ANCHOR_ADDRESS = '';
if (process.env.AFRICORE_DEMO_CHAIN === 'true') {
  const deployment = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../.tmp/chain-deployment.json'),
      'utf8',
    ),
  );
  process.env.AFRICORE_ANCHOR_RPC = 'http://127.0.0.1:8545';
  process.env.AFRICORE_ANCHOR_ADDRESS = deployment.contract_address;
  process.env.AFRICORE_ANCHOR_CHAIN_ID = '31337';
}
fs.mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true });
const { migrate, closeDb } = require('../dist/db'),
  { createApp } = require('../dist/app');
const base = 'http://127.0.0.1:4001',
  password = 'AfriCoreDemo2026!';
let cookie = '';
async function api(p, method = 'GET', body) {
  const r = await fetch(base + p, {
    method,
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    data = {};
  }
  if (!r.ok)
    throw Error(p + ': ' + r.status + ' ' + (data.message || data.error));
  const session = r.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0];
  return data;
}
async function account(email, name) {
  try {
    const user = await api('/api/auth/signup', 'POST', { email, password });
    await api('/api/auth/verify', 'POST', { token: user.verification_token });
  } catch (error) {
    if (!error.message.includes('409')) throw error;
    await api('/api/auth/signin', 'POST', { email, password });
  }
  let org = (await api('/api/v1/organizations')).data[0];
  if (!org)
    org = await api('/api/v1/organizations', 'POST', {
      name,
      business_type: 'Supplier',
      industry: 'Trade',
      location: 'Nairobi',
      email,
      phone: '+254700000000',
    });
  return { org: org.id, cookie };
}
(async () => {
  await migrate();
  const server = createApp().listen(4001, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const owner = await account(
      'owner@africore.localdemo',
      'Amani Supplies · Connected Demo',
    ),
    issuer = await account(
      'issuer@africore.localdemo',
      'AfriCore Sandbox Issuer · Demo',
    ),
    partner = await account(
      'partner@africore.localdemo',
      'Demo Commercial Partner',
    );
  cookie = owner.cookie;
  const p = '/api/v1/organizations/' + owner.org;
  if (!(await api(p + '/trust/passport')).passport) {
    const customer = await api(p + '/records/customers', 'POST', {
      name: 'Synthetic demo customer',
    });
    const today = new Date().toISOString().slice(0, 10),
      due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    for (const [index, amount] of [120000, 85000, 65000].entries()) {
      const invoice = await api(p + '/records/invoices', 'POST', {
        customer_id: customer.id,
        currency: 'KES',
        items: [
          {
            description: 'Synthetic demo supplies',
            quantity: 1,
            unit_price_minor: amount,
          },
        ],
        issue_date: today,
        due_date: due,
      });
      await api(p + '/records/invoices/' + invoice.id, 'PATCH', {
        status: 'issued',
      });
      if (index === 0) {
        const pay = await api(p + '/payment-requests', 'POST', {
          document_id: invoice.id,
        });
        await api('/api/v1' + pay.checkout_url + '/pay', 'POST', {
          scenario: 'success',
        });
      }
    }
    await api(p + '/expenses', 'POST', {
      description: 'Synthetic delivery expense',
      amount_minor: 12000,
      currency: 'KES',
      occurred_on: today,
      category: 'delivery',
    });
    await api(p + '/obligations', 'POST', {
      description: 'Synthetic monthly rent',
      amount_minor: 35000,
      currency: 'KES',
      next_due_date: due,
      recurrence: 'monthly',
    });
    await api(p + '/automations', 'POST', {
      name: 'Daily demo review',
      template: 'daily_summary',
      enabled: true,
      schedule: { frequency: 'daily', hour: 0 },
    });
    await api(p + '/automations/process', 'POST', {});
    await api(p + '/trust/passport', 'POST', {
      display_name: 'Amani Supplies · Demo',
      category: 'Supplier',
      industry: 'Trade',
      country: 'KE',
    });
    const evidence = await api(p + '/trust/evidence', 'POST', {
      source_kind: 'profile',
      source_id: owner.org,
      lawful_basis: 'consent',
      purpose: 'Create a private synthetic demo business identity.',
    });
    await api(p + '/protected-sales', 'POST', {
      title: 'Synthetic protected delivery',
      amount_minor: 150000,
      currency: 'KES',
      delivery_terms:
        'Deliver synthetic sample goods to an agreed collection point.',
      cancellation_terms:
        'Unpaid agreements can be cancelled. Paid outcomes require review.',
      support_contact: 'demo@example.test',
      inspection_hours: 48,
    });
    const invite = await api(p + '/invitations', 'POST', {
      email: 'issuer@africore.localdemo',
      role: 'admin',
    });
    cookie = issuer.cookie;
    await api('/api/v1/invitations/accept', 'POST', { token: invite.token });
    const i = '/api/v1/organizations/' + issuer.org;
    const types = [
      'BusinessIdentityCredential',
      'PaymentActivityCredential',
      'TradingHistoryCredential',
      'InvoiceSettlementCredential',
      'DeliveryCompletionCredential',
      'SupplierRelationshipCredential',
      'CustomerRelationshipCredential',
      'BusinessDataCoverageCredential',
      'BusinessRegistrationReviewCredential',
    ];
    const issuerResult = await api(i + '/trust/issuers', 'POST', {
      name: 'AfriCore Disposable Sandbox Issuer',
      types,
      statement:
        'Disposable local demo issuer; no institutional authority claimed.',
    });
    await api(
      '/api/v1/internal/trust/issuers/' + issuerResult.id + '/review',
      'POST',
      {
        decision: 'approve_sandbox',
        reason: 'Approved for synthetic sandbox demonstration only.',
      },
    );
    cookie = owner.cookie;
    const request = await api(p + '/trust/issuance-requests', 'POST', {
      issuer_id: issuerResult.id,
      holder_org: owner.org,
      type: 'BusinessIdentityCredential',
      evidence_ids: [evidence.id],
      valid_days: 90,
      consent: true,
    });
    cookie = issuer.cookie;
    await api(i + '/trust/credentials', 'POST', { request_id: request.id });
    cookie = owner.cookie;
    await api(p + '/trust/relationships', 'POST', {
      counterparty_org: partner.org,
      relationship: 'supplier',
      statement:
        'Synthetic supply relationship awaiting separate partner confirmation.',
      consent: true,
    });
  }
  for (const [account, name] of [
    [issuer, 'AfriCore Sandbox Issuer · Demo'],
    [partner, 'Demo Commercial Partner'],
  ]) {
    cookie = account.cookie;
    const prefix = '/api/v1/organizations/' + account.org;
    if (!(await api(prefix + '/trust/passport')).passport) {
      await api(prefix + '/trust/passport', 'POST', {
        display_name: name,
        category: 'Demo participant',
        industry: 'Trade',
        country: 'KE',
      });
      await api(prefix + '/trust/evidence', 'POST', {
        source_kind: 'profile',
        source_id: account.org,
        lawful_basis: 'consent',
        purpose:
          'Create a private synthetic participant passport for demo workflows.',
      });
    }
  }
  console.log(
    JSON.stringify(
      {
        demo_url: base + '/signin',
        password,
        accounts: {
          owner: 'owner@africore.localdemo',
          issuer_and_reviewer: 'issuer@africore.localdemo',
          counterparty: 'partner@africore.localdemo',
        },
        organizations: {
          owner: owner.org,
          issuer: issuer.org,
          partner: partner.org,
        },
        database:
          'Disposable .tmp/connected-demo.db; no normal application database touched.',
      },
      null,
      2,
    ),
  );
  const { processTrust } = require('../dist/stage3/worker'),
    { processStage2 } = require('../dist/stage2/worker');
  const timer = setInterval(() => {
    processStage2()
      .then(() => processTrust())
      .catch(() => console.error('Demo background task needs review'));
  }, 15000);
  async function stop() {
    clearInterval(timer);
    server.close(async () => {
      await closeDb();
      process.exit();
    });
  }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
