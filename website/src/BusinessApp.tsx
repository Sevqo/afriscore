import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Logo } from './App';
export async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  environment = 'sandbox',
  headers: Record<string, string> = {},
) {
  const r = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Environment': environment,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      data.message ||
        data.issues?.map((i: { message: string }) => i.message).join(', ') ||
        data.error ||
        'Request failed',
    );
  return data;
}
function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="alert error" role="alert">
      {error}
    </div>
  ) : null;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const money = (n: number, currency = 'KES') =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(
    n / (['UGX', 'RWF'].includes(currency) ? 1 : 100),
  );
export function AuthPage({ mode }: { mode: string }) {
  const [error, setError] = useState(''),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api('/api/auth/' + mode, 'POST', d);
      setResult(r);
      if (mode === 'signin') window.location.href = '/app';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <Logo />
      <div className="auth-panel">
        <span className="eyebrow">AFRICORE BUSINESS</span>
        <h1>
          {
            (
              {
                signin: 'Welcome back.',
                signup: 'Build your next chapter.',
                recover: 'Recover your account.',
                verify: 'Verify your email.',
                reset: 'Set a new password.',
              } as Record<string, string>
            )[mode]
          }
        </h1>
        <p>
          {mode === 'signup'
            ? 'Start in sandbox. Your business remains unverified until explicit verification.'
            : 'Your connected business workspace.'}
        </p>
        <form onSubmit={submit}>
          {['signup', 'signin', 'recover'].includes(mode) && (
            <Field label="Email address">
              <input required type="email" name="email" autoComplete="email" />
            </Field>
          )}
          {['signup', 'signin', 'reset'].includes(mode) && (
            <Field label="Password (at least 12 characters)">
              <input
                required
                type="password"
                name="password"
                minLength={12}
                maxLength={200}
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
              />
            </Field>
          )}
          {['verify', 'reset'].includes(mode) && (
            <Field label="One-time token">
              <input
                required
                name="token"
                defaultValue={
                  new URLSearchParams(location.search).get('token') || ''
                }
                minLength={64}
              />
            </Field>
          )}
          <ErrorBox error={error} />
          <button className="button" disabled={busy}>
            {busy ? 'Working…' : 'Continue →'}
          </button>
        </form>
        {result && (
          <div className="alert" role="status">
            <p>
              {result.verified
                ? 'Email verified.'
                : result.reset
                  ? 'Password updated.'
                  : result.message ||
                    'Account created. Development email delivery is not configured.'}
            </p>
            {result.verification_token && (
              <>
                <p>Development verification token (shown locally):</p>
                <code className="one-time">{result.verification_token}</code>
                <a href={'/verify?token=' + result.verification_token}>
                  Verify email →
                </a>
              </>
            )}
            {result.recovery_token && (
              <>
                <p>Development recovery token:</p>
                <code className="one-time">{result.recovery_token}</code>
                <a href={'/reset?token=' + result.recovery_token}>
                  Reset password →
                </a>
              </>
            )}
            <a href="/app">Open workspace →</a>
          </div>
        )}
        <div className="auth-links">
          <a href="/signin">Sign in</a>
          <a href="/signup">Create account</a>
          <a href="/recover">Forgot password?</a>
          <a href="/">Back to AfriCore</a>
        </div>
      </div>
    </div>
  );
}
export function Checkout() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const token = location.pathname.split('/').pop();
  const load = () =>
    api('/api/v1/checkout/' + token)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function pay(scenario: string) {
    setBusy(true);
    setError('');
    try {
      setResult(
        await api('/api/v1/checkout/' + token + '/pay', 'POST', { scenario }),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="checkout-page">
      <Logo />
      <main className="checkout-card">
        <span className="badge">Sandbox checkout · No real funds move</span>
        <ErrorBox error={error} />
        {data ? (
          <>
            <p>Payment to</p>
            <h1>{data.merchant}</h1>
            <p>{data.reference}</p>
            <div className="checkout-total">
              {money(data.amount_minor, data.currency)}
            </div>
            <ul>
              {data.items.map((i: any, n: number) => (
                <li key={n}>
                  {i.description} <span>× {i.quantity}</span>
                </li>
              ))}
            </ul>
            <p>
              Status: <strong>{data.status.replaceAll('_', ' ')}</strong>
            </p>
            {!['expired', 'cancelled', 'paid'].includes(data.status) && (
              <>
                <label className="field">
                  <span>Sandbox outcome</span>
                  <select id="scenario">
                    <option value="success">Successful payment</option>
                    <option value="failed">Failed payment</option>
                    <option value="delayed">Delayed confirmation</option>
                    <option value="partial">Partial payment</option>
                    <option value="duplicate">Duplicate provider event</option>
                  </select>
                </label>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    pay(
                      (document.getElementById('scenario') as HTMLSelectElement)
                        .value,
                    )
                  }
                >
                  {busy ? 'Processing…' : 'Simulate payment →'}
                </button>
              </>
            )}
            {data.status === 'paid' && (
              <button
                className="secondary-button"
                onClick={() => pay('reversed')}
              >
                Test reversal review
              </button>
            )}
            {result && (
              <div className="alert" role="status">
                {result.duplicate
                  ? 'Duplicate ignored safely.'
                  : result.status === 'pending'
                    ? 'Awaiting confirmation. Choose success to complete the delayed test.'
                    : `Provider: ${result.status}. Reconciliation: ${result.reconciliation}.`}
              </div>
            )}
            <small>
              Need help? Contact the merchant through your existing trusted
              channel. This checkout is an evaluation and does not initiate
              M-Pesa.
            </small>
          </>
        ) : (
          <p role="status">Loading checkout…</p>
        )}
      </main>
    </div>
  );
}
const tabs = [
  'Overview',
  'Payments',
  'Orders',
  'Invoices',
  'Customers',
  'Cash Flow',
  'Transactions',
  'Reconciliation',
  'Reports',
  'Integrations',
  'Developers',
  'Team',
  'Settings',
];
export function BusinessApp() {
  const [me, setMe] = useState<any>(null),
    [orgs, setOrgs] = useState<any[]>([]),
    [org, setOrg] = useState(''),
    [tab, setTab] = useState('Overview'),
    [environment, setEnvironment] = useState('sandbox'),
    [data, setData] = useState<any>(null),
    [customers, setCustomers] = useState<any[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<any>(null),
    [documentCurrency, setDocumentCurrency] = useState('KES');
  const base = '/api/v1/organizations/' + org;
  useEffect(() => {
    api('/api/auth/me')
      .then(setMe)
      .catch(() => (location.href = '/signin'));
    api('/api/v1/organizations')
      .then((r) => {
        setOrgs(r.data);
        setOrg(r.data[0]?.id || '');
      })
      .catch(() => {});
  }, []);
  const call = (
    suffix: string,
    method = 'GET',
    body?: unknown,
    headers?: Record<string, string>,
  ) => api(base + suffix, method, body, environment, headers);
  async function load() {
    if (!org) return;
    setBusy(true);
    setError('');
    setData(null);
    try {
      const suffix =
        (
          {
            Overview: '/report',
            'Cash Flow': '/report',
            Reports: '/report',
            Payments: '/payments',
            Reconciliation: '/reconciliation',
            Team: '/team',
            Developers: '/records/applications',
            Settings: '/audit',
          } as Record<string, string>
        )[tab] || '/records/' + tab.toLowerCase();
      const r = await call(suffix);
      setData(r);
      if (['Orders', 'Invoices'].includes(tab))
        setCustomers((await call('/records/customers?limit=100')).data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setSelected(null);
    setNotice('');
    load();
  }, [org, tab, environment]);
  async function action(fn: () => Promise<any>) {
    setError('');
    setBusy(true);
    try {
      const result = await fn();
      await load();
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function onboarding(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    await action(async () => {
      const r = await api('/api/v1/organizations', 'POST', {
        ...raw,
        features: ['invoices', 'payments'],
      });
      const result = await api('/api/v1/organizations');
      setOrgs(result.data);
      setOrg(r.id);
      setCreating(false);
      return r;
    });
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw: any = Object.fromEntries(new FormData(e.currentTarget));
    await action(async () => {
      let body: any = raw;
      const kind = tab.toLowerCase();
      if (['Orders', 'Invoices'].includes(tab)) {
        body = {
          customer_id: raw.customer_id,
          currency: raw.currency,
          items: JSON.parse(raw.items),
          issue_date: raw.issue_date,
          due_date: raw.due_date,
          discount_minor: Number(raw.discount_minor || 0),
          tax_bps: Number(raw.tax_bps || 0),
          notes: raw.notes || '',
          terms: raw.terms || '',
          payment_instructions: raw.payment_instructions || '',
          ...(raw.order_id ? { order_id: raw.order_id } : {}),
        };
      }
      const result = await call(
        '/records/' + (tab === 'Developers' ? 'applications' : kind),
        'POST',
        body,
      );
      setCreating(false);
      setNotice('Created successfully.');
      return result;
    });
  }
  async function requestPayment(row: any) {
    const r = await action(() =>
      call(
        '/payment-requests',
        'POST',
        { document_id: row.id },
        { 'Idempotency-Key': crypto.randomUUID() },
      ),
    );
    if (r?.checkout_url) setNotice(location.origin + r.checkout_url);
  }
  async function credentials(row: any) {
    const r = await action(() =>
      call('/credentials', 'POST', {
        application_id: row.id,
        scopes: ['read', 'finance', 'operations'],
      }),
    );
    if (r) setNotice('API key — copy now, shown once: ' + r.key);
  }
  async function exportReport() {
    try {
      const res = await fetch(base + '/report?format=csv', {
        credentials: 'same-origin',
        headers: { 'X-Environment': environment },
      });
      if (!res.ok) throw new Error('Export denied');
      const url = URL.createObjectURL(await res.blob()),
        a = document.createElement('a');
      a.href = url;
      a.download = 'africore-receivables.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const organization = orgs.find((o) => o.id === org),
    writable =
      organization &&
      ['owner', 'admin', 'finance', 'operations'].includes(organization.role);
  function docForm() {
    return (
      <>
        <Field label="Customer">
          <select name="customer_id" required>
            <option value="">Select a customer</option>
            {customers.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Currency">
            <select
              name="currency"
              value={documentCurrency}
              onChange={(e) => setDocumentCurrency(e.target.value)}
            >
              {['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'RWF'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Linked order ID (optional)">
            <input name="order_id" />
          </Field>
          <Field label="Issue date">
            <input
              required
              type="date"
              name="issue_date"
              defaultValue={new Date().toLocaleDateString('en-CA', {
                timeZone: 'Africa/Nairobi',
              })}
            />
          </Field>
          <Field label="Due date">
            <input required type="date" name="due_date" />
          </Field>
          <Field label="Discount (minor units)">
            <input
              type="number"
              name="discount_minor"
              min="0"
              defaultValue="0"
            />
          </Field>
          <Field label="Tax (basis points; 1600 = 16%)">
            <input
              type="number"
              name="tax_bps"
              min="0"
              max="10000"
              defaultValue="0"
            />
          </Field>
        </div>
        <LineItemsInput currency={documentCurrency} />
        <Field label="Notes">
          <textarea name="notes" />
        </Field>
        <Field label="Terms">
          <input name="terms" />
        </Field>
        <Field label="Payment instructions">
          <input name="payment_instructions" />
        </Field>
        <small>
          Commercial invoice only. Not KRA-validated or eTIMS approved.
        </small>
      </>
    );
  }
  function onboardingForm() {
    return (
      <form className="panel create-form" onSubmit={onboarding}>
        <h2>Create a business workspace</h2>
        <p>
          Country and currency are explicit. Business verification starts as
          unverified.
        </p>
        <div className="form-grid">
          {[
            ['Business name', 'name'],
            ['Industry', 'industry'],
            ['Location', 'location'],
            ['Business email', 'email'],
            ['Phone', 'phone'],
            ['Registration number (optional)', 'registration_number'],
            ['Tax identifier (optional)', 'tax_id'],
          ].map(([label, name]) => (
            <Field label={label} key={name}>
              <input
                name={name}
                required={!name.includes('_')}
                type={name === 'email' ? 'email' : 'text'}
              />
            </Field>
          ))}
          <Field label="Business type">
            <select name="business_type">
              {[
                'Sole proprietor',
                'Online merchant',
                'Contractor',
                'Supplier',
                'Service business',
                'Other SME',
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Country code">
            <input
              required
              name="country"
              minLength={2}
              maxLength={2}
              defaultValue="KE"
            />
          </Field>
          <Field label="Currency">
            <select
              name="currency"
              value={documentCurrency}
              onChange={(e) => setDocumentCurrency(e.target.value)}
            >
              {['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'RWF'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <button className="button" disabled={busy}>
          Create workspace →
        </button>
      </form>
    );
  }
  function metricView() {
    if (!data) return null;
    const metrics = [
      ['Confirmed inflows', data.confirmed_inflows_minor],
      ['Outstanding invoices', data.outstanding_minor],
      ['Overdue receivables', data.overdue_minor],
      ['Recorded outflows', data.recorded_outflows_minor],
    ];
    return (
      <>
        <div className="metric-grid">
          {metrics.map(([label, value]) => (
            <article key={label} className="panel">
              <span>{label}</span>
              <strong>{money(Number(value), data.currency)}</strong>
              <small>
                {environment} · {data.currency}
              </small>
            </article>
          ))}
        </div>
        <div className="dashboard-columns">
          <section className="panel">
            <h2>Receivables aging</h2>
            {Object.entries(data.aging || {}).map(([label, value]) => (
              <div className="aging-row" key={label}>
                <span>{label.replaceAll('_', ' ')}</span>
                <div
                  style={{
                    width:
                      Math.max(
                        2,
                        Math.min(
                          65,
                          (Number(value) /
                            Math.max(1, data.outstanding_minor)) *
                            65,
                        ),
                      ) + '%',
                  }}
                />
                <b>{money(Number(value), data.currency)}</b>
              </div>
            ))}
            <p className="muted">
              Issued invoices, less allocated payments. Draft and void invoices
              excluded.
            </p>
          </section>
          <section className="panel">
            <h2>Quick actions</h2>
            <div className="quick-actions">
              {['Customers', 'Orders', 'Invoices', 'Reports'].map((t) => (
                <button key={t} onClick={() => setTab(t)}>
                  {t} ↗
                </button>
              ))}
            </div>
            <h3>Provider status</h3>
            <p>
              <span className="status-dot" />
              Sandbox provider available
            </p>
            <p className="muted">Live M-Pesa: disabled</p>
            <p className="muted">Financing & protected payments: planned</p>
          </section>
        </div>
        <section className="panel">
          <h2>Recent verified events</h2>
          {data.events?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Provider reference</th>
                    <th>Amount</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e: any) => (
                    <tr key={e.id}>
                      <td>{e.provider_ref}</td>
                      <td>{money(Number(e.amount_minor), e.currency)}</td>
                      <td>
                        {new Date(e.created_at).toLocaleString('en-KE', {
                          timeZone: 'Africa/Nairobi',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="No verified payment activity yet. Create an invoice and test a checkout." />
          )}
        </section>
        <p className="methodology">{data.methodology}</p>
      </>
    );
  }
  return (
    <div className="business-shell">
      <aside className="sidebar">
        <Logo />
        <span className="workspace-label">BUSINESS WORKSPACE</span>
        <nav aria-label="Business navigation">
          {tabs.map((t) => (
            <button
              className={tab === t ? 'active' : ''}
              key={t}
              onClick={() => {
                setTab(t);
                setCreating(false);
              }}
            >
              {t}
              <span>{t === tab ? '↗' : ''}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/docs">Developer docs ↗</a>
          <button
            onClick={() =>
              api('/api/auth/signout', 'POST', {}).then(
                () => (location.href = '/signin'),
              )
            }
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div>
            <select
              aria-label="Switch organization"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            >
              <option value="">Select workspace</option>
              {orgs.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              className="quiet-button"
              onClick={() => setCreating('workspace' as any)}
            >
              + Workspace
            </button>
          </div>
          <div>
            <select
              aria-label="Environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">
                Production (collection disabled)
              </option>
            </select>
            <span>{me?.email}</span>
          </div>
        </header>
        <main className="workspace-content">
          <div className="workspace-title">
            <div>
              <span className="eyebrow">
                {organization?.name || 'WELCOME TO AFRICORE'} ·{' '}
                {environment.toUpperCase()}
              </span>
              <h1>{tab === 'Overview' ? 'Your business, in view.' : tab}</h1>
              <p>
                {tab === 'Overview'
                  ? 'A clearer picture of what is moving — and what needs your attention.'
                  : 'Connected records. Clear actions. One workspace.'}
              </p>
            </div>
            {org &&
              writable &&
              [
                'Customers',
                'Orders',
                'Invoices',
                'Integrations',
                'Developers',
              ].includes(tab) && (
                <button
                  className="button"
                  onClick={() => setCreating(!creating)}
                >
                  + {tab === 'Developers' ? 'Application' : tab.slice(0, -1)}
                </button>
              )}
          </div>
          <div className="sandbox-banner">
            {environment === 'sandbox'
              ? 'Sandbox workspace · All payments are simulated. No real funds move.'
              : 'Production records · Live payment initiation is disabled. Email verification is required.'}{' '}
            <span>{organization?.role} · Business unverified</span>
          </div>
          <ErrorBox error={error} />
          {notice && (
            <div className="alert one-time" role="status">
              {notice}
              {notice.startsWith('http') && (
                <p>
                  <a href={notice} target="_blank" rel="noreferrer">
                    Open checkout ↗
                  </a>
                </p>
              )}
              <button
                className="quiet-button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(notice)
                    .catch(() => setError('Select and copy the text manually.'))
                }
              >
                Copy
              </button>
            </div>
          )}
          {!org || creating === ('workspace' as any) ? (
            onboardingForm()
          ) : (
            <>
              {creating && (
                <form className="panel create-form" onSubmit={create}>
                  <h2>
                    Create{' '}
                    {tab === 'Developers'
                      ? 'application'
                      : tab.toLowerCase().slice(0, -1)}
                  </h2>
                  {['Orders', 'Invoices'].includes(tab) ? (
                    docForm()
                  ) : tab === 'Customers' ? (
                    <>
                      <Field label="Customer name">
                        <input required name="name" />
                      </Field>
                      <Field label="Type">
                        <select name="type">
                          <option value="individual">Individual</option>
                          <option value="business">Business</option>
                        </select>
                      </Field>
                      <Field label="Email">
                        <input type="email" name="email" />
                      </Field>
                      <Field label="Phone">
                        <input name="phone" />
                      </Field>
                      <Field label="Notes">
                        <textarea name="notes" />
                      </Field>
                    </>
                  ) : tab === 'Integrations' ? (
                    <Field label="Source">
                      <select name="provider">
                        <option value="csv">CSV import</option>
                        <option value="sandbox">Sandbox provider</option>
                        <option value="africore_pay">AfriCore Pay</option>
                      </select>
                    </Field>
                  ) : (
                    <>
                      <Field label="Application name">
                        <input required name="name" />
                      </Field>
                      <Field label="Description">
                        <textarea name="description" />
                      </Field>
                    </>
                  )}
                  <div className="actions">
                    <button className="button" disabled={busy}>
                      Save →
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setCreating(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {busy && !data && (
                <div className="skeleton" role="status">
                  Loading your records…
                </div>
              )}
              {['Overview', 'Cash Flow', 'Reports'].includes(tab) && (
                <>
                  {tab !== 'Overview' && (
                    <form
                      className="panel filter-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const p = new URLSearchParams(
                          Object.fromEntries(
                            [...new FormData(e.currentTarget)].filter(
                              ([, value]) => value !== '',
                            ),
                          ) as Record<string, string>,
                        );
                        try {
                          setData(await call('/report?' + p));
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Field label="From">
                        <input type="date" name="from" />
                      </Field>
                      <Field label="To">
                        <input type="date" name="to" />
                      </Field>
                      <Field label="Currency">
                        <select
                          name="currency"
                          value={documentCurrency}
                          onChange={(e) => setDocumentCurrency(e.target.value)}
                        >
                          {[
                            'KES',
                            'USD',
                            'EUR',
                            'GBP',
                            'UGX',
                            'TZS',
                            'RWF',
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                      <button className="secondary-button">Apply</button>
                      <button
                        type="button"
                        className="button"
                        onClick={exportReport}
                      >
                        Export CSV ↓
                      </button>
                    </form>
                  )}
                  {metricView()}
                </>
              )}
              {[
                'Customers',
                'Orders',
                'Invoices',
                'Transactions',
                'Integrations',
                'Developers',
              ].includes(tab) && (
                <>
                  <div className="table-toolbar">
                    <input
                      aria-label="Search records"
                      placeholder="Search records…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="quiet-button" onClick={load}>
                      Refresh ↻
                    </button>
                  </div>
                  <section className="panel record-panel">
                    {data?.data?.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Reference / name</th>
                              <th>Status / type</th>
                              <th>Amount / description</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.data
                              .filter((r: any) =>
                                JSON.stringify(r)
                                  .toLowerCase()
                                  .includes(query.toLowerCase()),
                              )
                              .map((r: any) => (
                                <tr key={r.id}>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() => setSelected(r)}
                                    >
                                      {r.reference ||
                                        r.name ||
                                        r.provider ||
                                        r.external_id}
                                    </button>
                                    <small className="record-id">{r.id}</small>
                                  </td>
                                  <td>
                                    <span className="badge">
                                      {r.status || r.type || 'active'}
                                    </span>
                                  </td>
                                  <td>
                                    {r.total_minor
                                      ? money(r.total_minor, r.currency)
                                      : r.amount_minor
                                        ? money(r.amount_minor, r.currency)
                                        : r.description || '—'}
                                    {r.paid_minor > 0 && (
                                      <small className="record-id">
                                        Paid: {money(r.paid_minor, r.currency)}
                                      </small>
                                    )}
                                  </td>
                                  <td>
                                    <div className="row-actions">
                                      {r.status === 'draft' && writable && (
                                        <button
                                          onClick={() =>
                                            action(() =>
                                              call(
                                                '/records/' +
                                                  tab.toLowerCase() +
                                                  '/' +
                                                  r.id,
                                                'PATCH',
                                                {
                                                  status:
                                                    tab === 'Invoices'
                                                      ? 'issued'
                                                      : 'awaiting_payment',
                                                },
                                              ),
                                            )
                                          }
                                        >
                                          Issue
                                        </button>
                                      )}
                                      {[
                                        'issued',
                                        'awaiting_payment',
                                        'partially_paid',
                                      ].includes(r.status) &&
                                        writable && (
                                          <button
                                            onClick={() => requestPayment(r)}
                                          >
                                            Payment link
                                          </button>
                                        )}
                                      {tab === 'Invoices' && (
                                        <button
                                          onClick={() => {
                                            setSelected(r);
                                            setTimeout(
                                              () => window.print(),
                                              100,
                                            );
                                          }}
                                        >
                                          Print / PDF
                                        </button>
                                      )}
                                      {tab === 'Developers' && (
                                        <button onClick={() => credentials(r)}>
                                          Generate key
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      !busy && (
                        <Empty
                          text={
                            'No ' +
                            tab.toLowerCase() +
                            ' yet. Your saved records will appear here.'
                          }
                        />
                      )
                    )}
                  </section>
                  {tab === 'Transactions' && (
                    <form
                      className="panel"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const input = new FormData(e.currentTarget);
                        await action(async () => {
                          const rows = JSON.parse(String(input.get('rows')));
                          const result = await call('/import', 'POST', {
                            rows,
                          });
                          setNotice(
                            `${result.imported} imported; ${result.duplicates} duplicates ignored.`,
                          );
                          return result;
                        });
                      }}
                    >
                      <h2>Import transaction data</h2>
                      <p>
                        Merchant imports retain provenance and never confirm
                        provider payments. Upload a CSV or paste normalized
                        JSON.
                      </p>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        aria-label="Import CSV"
                        onChange={async (e) => {
                          try {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const text = await file.text();
                            const lines = parseCSV(text),
                              headers = lines.shift() || [];
                            const rows = lines
                              .filter((r) => r.some(Boolean))
                              .map((values) => {
                                const r: any = Object.fromEntries(
                                  headers.map((h, i) => [h.trim(), values[i]]),
                                );
                                r.amount_minor = Number(r.amount_minor);
                                return r;
                              });
                            (
                              document.getElementById(
                                'import-json',
                              ) as HTMLTextAreaElement
                            ).value = JSON.stringify(rows, null, 2);
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      />
                      <p className="muted">
                        Headers:
                        external_id,amount_minor,currency,type,occurred_at,source,counterparty
                      </p>
                      <textarea
                        id="import-json"
                        name="rows"
                        rows={6}
                        required
                        placeholder='[{"external_id":"receipt-001","amount_minor":10000,"currency":"KES","type":"inflow","occurred_at":"2026-10-25T09:00:00Z","source":"csv"}]'
                      />
                      <button className="button">Import records</button>
                    </form>
                  )}
                  {tab === 'Developers' && (
                    <DeveloperTools
                      key={org + environment}
                      call={call}
                      onNotice={setNotice}
                    />
                  )}
                </>
              )}
              {tab === 'Payments' && (
                <section className="panel">
                  <h2>Payment requests</h2>
                  {data?.data?.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Request</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.data.map((r: any) => (
                            <tr key={r.id}>
                              <td>{r.id}</td>
                              <td>
                                {money(Number(r.amount_minor), r.currency)}
                              </td>
                              <td>
                                <span className="badge">{r.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty text="Create a payment link from an issued order or invoice." />
                  )}
                  <p className="muted">
                    Checkout URLs contain secrets and are shown once at
                    creation.
                  </p>
                </section>
              )}
              {tab === 'Reconciliation' && (
                <>
                  <section className="panel">
                    <h2>Matched allocations</h2>
                    <p>
                      {data?.allocations?.length || 0} verified allocations in{' '}
                      {environment}.
                    </p>
                    {data?.allocations?.map((r: any) => (
                      <div className="list-row" key={r.id}>
                        <code>{r.document_id}</code>
                        <span>{r.amount_minor} minor units</span>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <h2>Exception queue</h2>
                    {data?.exceptions?.length ? (
                      data.exceptions.map((r: any) => (
                        <div className="list-row" key={r.id}>
                          <div>
                            <b>{r.reason.replaceAll('_', ' ')}</b>
                            <p>
                              {r.event_id} · {r.status}
                            </p>
                          </div>
                          {r.status === 'pending_review' && (
                            <button
                              onClick={() => {
                                const note = prompt(
                                  'Review note (minimum 5 characters). Original events remain unchanged.',
                                );
                                if (note)
                                  action(() =>
                                    call(
                                      '/reconciliation/' + r.id + '/review',
                                      'POST',
                                      { note },
                                    ),
                                  );
                              }}
                            >
                              Record review
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <Empty text="No exceptions to review." />
                    )}
                  </section>
                </>
              )}
              {tab === 'Team' && (
                <>
                  <section className="panel">
                    <h2>Workspace members</h2>
                    {data?.data?.map((r: any) => (
                      <div className="list-row" key={r.id}>
                        <span>{r.email}</span>
                        <span className="badge">{r.role}</span>
                      </div>
                    ))}
                  </section>
                  <form
                    className="panel"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const raw = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      const r = await action(() =>
                        call('/invitations', 'POST', raw),
                      );
                      if (r)
                        setNotice(
                          'Invitation token (share with intended email): ' +
                            r.token,
                        );
                    }}
                  >
                    <h2>Invite a team member</h2>
                    <Field label="Email">
                      <input type="email" name="email" required />
                    </Field>
                    <Field label="Role">
                      <select name="role">
                        {['admin', 'finance', 'operations', 'viewer'].map(
                          (r) => (
                            <option key={r}>{r}</option>
                          ),
                        )}
                      </select>
                    </Field>
                    <button className="button">Create invitation</button>
                  </form>
                  <form
                    className="panel"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const raw = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      await action(() =>
                        api('/api/v1/invitations/accept', 'POST', raw),
                      );
                      location.reload();
                    }}
                  >
                    <h2>Accept invitation</h2>
                    <Field label="Invitation token">
                      <input required name="token" />
                    </Field>
                    <button className="secondary-button">Join workspace</button>
                  </form>
                </>
              )}
              {tab === 'Settings' && (
                <>
                  <section className="panel">
                    <h2>Business profile</h2>
                    <p>
                      {organization?.name} · {organization?.verification_status}
                    </p>
                    <p>
                      Default currency:{' '}
                      {organization &&
                        JSON.parse(organization.profile).currency}{' '}
                      · Default display timezone: Africa/Nairobi
                    </p>
                    <p>
                      Identity and business verification are not completed
                      automatically.
                    </p>
                    <a href="/verify">Verify your email →</a>
                  </section>
                  <section className="panel">
                    <h2>Audit history</h2>
                    {data?.data?.map((r: any) => (
                      <div key={r.id} className="list-row">
                        <span>{r.action}</span>
                        <time>
                          {new Date(r.created_at).toLocaleString('en-KE', {
                            timeZone: 'Africa/Nairobi',
                          })}
                        </time>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {selected && (
                <div className="modal-backdrop">
                  <section
                    className={
                      'record-modal panel ' +
                      (selected.kind === 'invoices' ? 'print-invoice' : '')
                    }
                    role="dialog"
                    aria-modal="true"
                    aria-label="Record details"
                  >
                    <button
                      className="close-modal"
                      onClick={() => setSelected(null)}
                      autoFocus
                    >
                      Close ×
                    </button>
                    <h2>{selected.reference || selected.name}</h2>
                    {selected.kind === 'invoices' ? (
                      <>
                        <p>
                          {organization?.name} ·{' '}
                          {JSON.parse(organization.profile).email}
                        </p>
                        <p>
                          Invoice · {selected.issue_date} · Due{' '}
                          {selected.due_date}
                        </p>
                        <p>
                          Customer:{' '}
                          {customers.find((c) => c.id === selected.customer_id)
                            ?.name || selected.customer_id}
                        </p>
                        <table>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Quantity</th>
                              <th>Unit price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.items.map((i: any, n: number) => (
                              <tr key={n}>
                                <td>{i.description}</td>
                                <td>{i.quantity}</td>
                                <td>
                                  {money(i.unit_price_minor, selected.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p>
                          Subtotal:{' '}
                          {money(selected.subtotal_minor, selected.currency)} ·
                          Discount:{' '}
                          {money(selected.discount_minor, selected.currency)} ·
                          Tax: {money(selected.tax_minor, selected.currency)}
                        </p>
                        <h3>
                          Total:{' '}
                          {money(selected.total_minor, selected.currency)}
                        </h3>
                        <p>
                          Paid: {money(selected.paid_minor, selected.currency)}{' '}
                          · {selected.status}
                        </p>
                        <p>{selected.notes}</p>
                        <p>{selected.terms}</p>
                        <p>{selected.payment_instructions}</p>
                        <small>
                          Ordinary commercial invoice. Not KRA-validated eTIMS.
                        </small>
                        <button
                          className="button"
                          onClick={() => window.print()}
                        >
                          Print / Save PDF
                        </button>
                      </>
                    ) : (
                      <pre>{JSON.stringify(selected, null, 2)}</pre>
                    )}
                    {selected.kind === 'customers' && (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          const name = prompt('Customer name', selected.name);
                          if (name)
                            action(() =>
                              call(
                                '/records/customers/' + selected.id,
                                'PATCH',
                                { name },
                              ),
                            ).then(() => setSelected(null));
                        }}
                      >
                        Edit customer name
                      </button>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
function LineItemsInput({ currency }: { currency: string }) {
  const [items, setItems] = useState([
    { description: '', quantity: 1, price: 100 },
  ]);
  const multiplier = ['UGX', 'RWF'].includes(currency) ? 1 : 100;
  const change = (
    index: number,
    key: 'description' | 'quantity' | 'price',
    value: string,
  ) =>
    setItems(
      items.map((item, i) =>
        i === index
          ? { ...item, [key]: key === 'description' ? value : Number(value) }
          : item,
      ),
    );
  return (
    <fieldset className="line-items">
      <legend>Invoice / order items</legend>
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unit_price_minor: Math.round(i.price * multiplier),
          })),
        )}
      />
      {items.map((item, index) => (
        <div className="line-item-row" key={index}>
          <Field label="Description">
            <input
              required
              value={item.description}
              maxLength={500}
              onChange={(e) => change(index, 'description', e.target.value)}
            />
          </Field>
          <Field label="Quantity">
            <input
              required
              type="number"
              min={1}
              max={100000}
              step={1}
              value={item.quantity}
              onChange={(e) => change(index, 'quantity', e.target.value)}
            />
          </Field>
          <Field label={'Unit price (' + currency + ')'}>
            <input
              required
              type="number"
              min={0}
              max={100000000}
              step={1 / multiplier}
              value={item.price}
              onChange={(e) => change(index, 'price', e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="quiet-button"
            disabled={items.length === 1}
            aria-label={'Remove item ' + (index + 1)}
            onClick={() => setItems(items.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary-button"
        disabled={items.length >= 100}
        onClick={() =>
          setItems([...items, { description: '', quantity: 1, price: 0 }])
        }
      >
        + Add item
      </button>
      <p className="muted">
        Item subtotal:{' '}
        {money(
          items.reduce(
            (s, i) => s + Math.round(i.price * multiplier) * i.quantity,
            0,
          ),
          currency,
        )}
      </p>
    </fieldset>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">◇</span>
      <h3>A clear place to begin.</h3>
      <p>{text}</p>
    </div>
  );
}
function DeveloperTools({
  call,
  onNotice,
}: {
  call: (suffix: string, method?: string, body?: unknown) => Promise<any>;
  onNotice: (text: string) => void;
}) {
  const [keys, setKeys] = useState<any[]>([]),
    [hooks, setHooks] = useState<any>({ data: [], deliveries: [] }),
    [error, setError] = useState('');
  async function refresh() {
    try {
      setKeys((await call('/credentials')).data);
      setHooks(await call('/webhooks'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, [call.toString()]);
  async function run(fn: () => Promise<any>) {
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <ErrorBox error={error} />
      <section className="panel">
        <h2>API credentials</h2>
        <p>
          Generate a replacement key before revoking the old one. Secrets are
          shown once.
        </p>
        {keys.map((k) => (
          <div className="list-row" key={k.id}>
            <code>
              {k.id} · {k.scopes}
            </code>
            {k.revoked_at ? (
              <span>Revoked</span>
            ) : (
              <button
                onClick={() =>
                  run(() => call('/credentials/' + k.id, 'DELETE'))
                }
              >
                Revoke
              </button>
            )}
          </div>
        ))}
        <button className="quiet-button" onClick={refresh}>
          Refresh credentials
        </button>
      </section>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const d: any = Object.fromEntries(new FormData(e.currentTarget));
          await run(async () => {
            const r = await call('/webhooks', 'POST', {
              url: d.url,
              subscriptions: [
                'invoice.created',
                'invoice.issued',
                'invoice.paid',
                'payment.succeeded',
                'payment.failed',
                'reconciliation.exception_created',
              ],
            });
            onNotice('Webhook secret — shown once: ' + r.secret);
          });
        }}
      >
        <h2>Signed webhooks</h2>
        <Field label="Public HTTPS endpoint">
          <input
            name="url"
            required
            type="url"
            placeholder="https://hooks.example.com/africore"
          />
        </Field>
        <button className="button">Register endpoint</button>
      </form>
      <section className="panel">
        <h2>Delivery activity</h2>
        <button
          className="secondary-button"
          onClick={() => run(() => call('/webhooks/process', 'POST', {}))}
        >
          Process due deliveries
        </button>
        {hooks.data.map((h: any) => (
          <div className="list-row" key={h.id}>
            <span>{h.url}</span>
            <button
              onClick={() =>
                run(async () => {
                  const r = await call(
                    '/webhooks/' + h.id + '/rotate',
                    'POST',
                    {},
                  );
                  onNotice('New webhook secret: ' + r.secret);
                })
              }
            >
              Rotate secret
            </button>
          </div>
        ))}
        {hooks.deliveries.map((d: any) => (
          <div className="list-row" key={d.id}>
            <span>
              {d.event_type} · {d.status} · {d.attempts} attempts
            </span>
            <button
              onClick={() =>
                run(() => call('/deliveries/' + d.id + '/replay', 'POST', {}))
              }
            >
              Replay
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
