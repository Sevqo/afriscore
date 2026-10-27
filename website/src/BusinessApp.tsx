import { DateRange } from './components/DateRange';
import { TeamDirectory } from './accounts/TeamDirectory';
import { peekQuery, cancelOtherWorkspaceReads } from './lib/query-cache';
import {managedSignOut} from './accounts/auth';
import { createRequestGate } from './components/requestGate';
import {
  FinancialActivity,
  RecordAnalytics,
  ReconciliationOverview,
} from './charts/WorkspaceCharts';
import { DataTable } from './components/DataTable';
import { Overlay } from './components/Overlay';
import { Icon, type IconName } from './components/Icon';
import { useRef } from 'react';
import { useFocusScope } from './components/useFocusScope';
import { PassportWorkspace } from './trust/PassportWorkspace';
import {
  startDemo,
  isDemo,
} from './demo/transport';
import { OperationsWorkspace, operationsTabs } from './operations/OperationsWorkspace';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Logo } from './components/Logo';
import { api, apiFetch } from './lib/api-client';
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
                  {busy ? (
                    'Processing…'
                  ) : (
                    <>
                      Simulate payment <Icon name="right" />
                    </>
                  )}
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
const navigation: { label: string; icon: IconName; items: string[] }[] = [
  {
    label: 'Workspace',
    icon: 'grid',
    items: ['Overview', 'Customers', 'Orders', 'Invoices', 'Payments'],
  },
  {
    label: 'Finance & intelligence',
    icon: 'chart',
    items: [
      'Intelligence',
      'Cash Flow',
      'Forecasts',
      'Transactions',
      'Reconciliation',
      'Reports',
      'Assistant',
    ],
  },
  {
    label: 'Operations',
    icon: 'document',
    items: [
      'Automations',
      'Notifications',
      'Approvals',
      'Fulfillment',
      'Protected Payments',
      'Disputes',
    ],
  },
  {
    label: 'Business trust',
    icon: 'shield',
    items: ['Business Passport', 'Risk Review'],
  },
  {
    label: 'Build & connect',
    icon: 'code',
    items: ['Connect', 'Integrations', 'Developers', 'Engineering'],
  },
  { label: 'Administration', icon: 'settings', items: ['Team', 'Settings'] },
];
const tabs = navigation.flatMap((group) => group.items);
export function BusinessApp({initialOrg,account}:{initialOrg?:string;account?:any}={}) {
  const [resolvingOrgs,setResolvingOrgs]=useState(true),[orgLoadError,setOrgLoadError]=useState('');
  const workspaceSwitch = useRef(0);
  const [reportFilters,setReportFilters]=useState({from:'',to:'',currency:'KES'});

  const [me, setMe] = useState<any>(null),
    [orgs, setOrgs] = useState<any[]>([]),
    [org, setOrg] = useState(''),
    [tab, setTab] = useState(() => {
      const saved = decodeURIComponent(location.hash.slice(1));
      return tabs.includes(saved) ? saved : 'Overview';
    }),
    [environment, setEnvironment] = useState('sandbox'),
    [loaded, setLoaded] = useState<{scope:string;value:any}|null>(null),
    [customers, setCustomers] = useState<any[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<any>(null),
    [documentCurrency, setDocumentCurrency] = useState('KES');
  const [navOpen, setNavOpen] = useState(false);
  const [offset, setOffset] = useState(0),
    [search, setSearch] = useState('');
  const requestGate = useRef(createRequestGate());
  const viewScope =
    org + '\0' + environment + '\0' + tab + '\0' + offset + '\0' + search + '\0' + JSON.stringify(reportFilters);
  const currentScope = useRef(viewScope);
  currentScope.current = viewScope;
  const recordTabs = [
    'Customers',
    'Orders',
    'Invoices',
    'Transactions',
    'Integrations',
    'Developers',
  ];
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      setSearch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const navRef = useRef<HTMLElement>(null);
  useFocusScope(navOpen, () => setNavOpen(false), navRef);
  useEffect(() => {
    const change = () => {
      const value = decodeURIComponent(location.hash.slice(1));
      setTab(tabs.includes(value) ? value : 'Overview');
      setNavOpen(false);
    };
    window.addEventListener('popstate', change);
    return () => window.removeEventListener('popstate', change);
  }, []);
  useEffect(() => {
    if (decodeURIComponent(location.hash.slice(1)) !== tab)
      history.pushState(null, '', '#' + encodeURIComponent(tab));
  }, [tab]);
  useEffect(() => {
    const resize = () => {
      if (innerWidth > 1024) setNavOpen(false);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const base = '/api/v1/organizations/' + org;
  const suffix=({Overview:'/report','Cash Flow':'/report',Reports:'/report',Payments:'/payments',Reconciliation:'/reconciliation',Team:'/team',Developers:'/records/applications',Settings:'/audit'} as Record<string,string>)[tab]||'/records/'+tab.toLowerCase();
  const filterQuery=new URLSearchParams(Object.fromEntries(Object.entries(reportFilters).filter(([,v])=>v))).toString();
  const resource=suffix+(recordTabs.includes(tab)?'?limit=25&offset='+offset+'&q='+encodeURIComponent(search):['Overview','Cash Flow','Reports'].includes(tab)?'?'+filterQuery:'');
  const data=loaded?.scope===viewScope?loaded.value:peekQuery<any>(base+resource,environment,isDemo())||null;
  const setData=(value:any)=>setLoaded({scope:viewScope,value});
  useEffect(()=>{if(org)cancelOtherWorkspaceReads(base,environment);},[org,environment]);
  useEffect(() => {
    if(account){setMe(account.user);const memberships=account.workspaces.filter((w:any)=>w.kind==='business');setOrgs(memberships);setOrg(initialOrg||memberships[0]?.id||'');setResolvingOrgs(false);return;}
    api('/api/auth/me')
      .then(setMe)
      .catch(() => (location.href = '/signin'));
    api('/api/v1/organizations')
      .then(async (r) => {
        setOrgs(r.data);
        if (isDemo()) { setOrg(r.data[0]?.id || ''); return; }
        const account = await api('/api/auth/account');
        const requested=initialOrg||account.workspace?.id;
        if(initialOrg&&!r.data.some((o:any)=>o.id===initialOrg)) throw new Error('Business membership is no longer available.');
        setOrg(r.data.some((o: any) => o.id === requested)
          ? requested : r.data[0]?.id || '');
      })
      .catch(e=>setOrgLoadError((e as Error).message))
      .finally(()=>setResolvingOrgs(false));
  }, []);
  const call = (
    suffix: string,
    method = 'GET',
    body?: unknown,
    headers?: Record<string, string>,
  ) => api(base + suffix, method, body, environment, headers);
  async function load() {
    if (currentScope.current !== viewScope) return;
    const latest = requestGate.current.begin();
    const current = () => latest() && currentScope.current === viewScope;
    if (!org || tab === 'Business Passport' || operationsTabs.includes(tab)) {
      setError('');
      setBusy(false);
      return;
    }
    setBusy(true);
    setError('');
    setData(peekQuery<any>(base+resource,environment,isDemo())||null);
    try {
      const [r,related] = await Promise.all([call(resource),['Orders','Invoices'].includes(tab)?call('/records/customers?limit=100'):Promise.resolve(null)]);
      if (!current()) return;
      setData(r);
      if (['Orders', 'Invoices'].includes(tab)) {
        if (current() && related) setCustomers(related.data);
      }
    } catch (e) {
      if (current()) setError((e as Error).message);
    } finally {
      if (current()) setBusy(false);
    }
  }
  useEffect(() => {
    setSelected(null);
    setNotice('');
    load();
    return () => requestGate.current.invalidate();
  }, [org, tab, environment, offset, search, filterQuery]);
  useEffect(() => {
    setOffset(0);
    setQuery('');
    setSearch('');
    setCreating(false);
    setCustomers([]);
  }, [org, tab, environment]);
  async function action(fn: () => Promise<any>) {
    if (currentScope.current !== viewScope) return;
    setError('');
    setBusy(true);
    try {
      const result = await fn();
      if (currentScope.current !== viewScope) return;
      await load();
      return result;
    } catch (e) {
      if (currentScope.current === viewScope) setError((e as Error).message);
    } finally {
      if (currentScope.current === viewScope) setBusy(false);
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
      if(initialOrg&&!isDemo()) location.href='/app/business/'+r.id;
      else setOrg(r.id);
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
      const res = await apiFetch(base + '/report?format=csv&'+filterQuery, {
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
  // The browser demo stores profile fields directly; the API stores serialized profile JSON.
  const profile = organization?.profile
    ? typeof organization.profile === 'string'
      ? JSON.parse(organization.profile)
      : organization.profile
    : organization;
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
          {tab === 'Invoices' && (
            <Field label="Linked order ID (optional)">
              <input name="order_id" />
            </Field>
          )}
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
          {tab === 'Invoices'
            ? 'Commercial invoice only. Not KRA-validated or eTIMS approved.'
            : 'Save a draft order, then issue it before requesting payment or creating its invoice.'}
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
          Create workspace <Icon name="right" />
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
              {environment==='sandbox'&&label==='Confirmed inflows'&&<small>Test payment events</small>}
            </article>
          ))}
        </div>
        <FinancialActivity
          load={call}
          scope={org + environment}
          currency={data.currency}
          filters={filterQuery}
          testOnly={environment==='sandbox'}
        />
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
                  {t} <Icon name="right" />
                </button>
              ))}
            </div>
            <details><summary>Payment availability</summary><p>Live payment collection is not configured. Test payment events do not move real funds.</p></details>
          </section>
        </div>
        <section className="panel">
          <h2>Recent provider events</h2>
          {data.events?.length ? (
            <div className="table-scroll">
              <DataTable>
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
              </DataTable>
            </div>
          ) : (
            <Empty text="No verified payment activity yet. Create an invoice and test a checkout." />
          )}
        </section>
        <p className="methodology">{data.methodology}</p>
      </>
    );
  }
  if(resolvingOrgs) return <main className="account-entry" role="status">Loading your Business workspace…</main>;
  if(orgLoadError) return <main className="account-entry"><h1>Business workspace unavailable</h1><ErrorBox error={orgLoadError}/><a href="/app/workspaces">Resolve current access</a><button className="button" onClick={()=>location.reload()}>Try again</button></main>;
  return (
    <div className="business-shell">
      {navOpen && (
        <button
          className="nav-scrim"
          aria-label="Close business navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        className={'sidebar ' + (navOpen ? 'is-open' : '')}
        ref={navRef}
        role={navOpen ? 'dialog' : undefined}
        aria-modal={navOpen ? true : undefined}
        aria-label="Workspace menu"
        id="workspace-menu"
      >
        <div className="sidebar-brand">
          <Logo />
          <button
            data-autofocus
            className="icon-button app-nav-close"
            aria-label="Close business navigation"
            onClick={() => setNavOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <span className="workspace-label">Business workspace</span>
        <nav aria-label="Business navigation">
          {navigation.map((group) => (
            <details
              key={group.label}
              className="workspace-nav-group"
              open={group.items.includes(tab) || undefined}
            >
              <summary>
                <Icon name={group.icon} />
                {group.label}
                <Icon name="down" />
              </summary>
              {group.items.map((t) => (
                <button
                  className={tab === t ? 'active' : ''}
                  key={t}
                  aria-current={tab === t ? 'page' : undefined}
                  onPointerEnter={()=>{const path=({Overview:'/report',Payments:'/payments',Invoices:'/records/invoices?limit=25&offset=0&q='} as Record<string,string>)[t];if(org&&path)void call(path).catch(()=>{});}}
                  onFocus={()=>{if(org&&t==='Payments')void call('/payments').catch(()=>{});}}
                  onClick={() => {
                    setTab(t);
                    setCreating(false);
                    setNavOpen(false);
                  }}
                >
                  {t}
                </button>
              ))}
            </details>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!isDemo()&&<a href="/app/workspaces">All workspaces</a>}
          <a href="/docs">
            Developer docs <Icon name="right" />
          </a>
          <button
            onClick={() =>
              managedSignOut().then(
                () => (location.href = '/signin'),
              ).catch(e=>setError((e as Error).message))
            }
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <button
            className="icon-button app-nav-toggle"
            aria-label="Open business navigation"
            aria-expanded={navOpen}
            aria-controls="workspace-menu"
            onClick={() => setNavOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div>
            <select
              aria-label="Switch organization"
              value={org}
              onChange={async (e) => {
                const version = ++workspaceSwitch.current;
                const id = e.target.value;
                if (!id) { setOrg(''); return; }
                try {
                  if (!isDemo()) await api('/api/auth/account/workspace', 'POST', {workspace_id: id});
                  if (version === workspaceSwitch.current) {
                    if(initialOrg&&!isDemo()) location.href='/app/business/'+id;
                    else setOrg(id);
                  }
                } catch (error) { if (version === workspaceSwitch.current) setError((error as Error).message); }
              }}
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
            {(isDemo()||['Developers','Settings'].includes(tab))&&<select
              aria-label="Data environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">
                Production (collection disabled)
              </option>
            </select>}
            <span>{me?.email}</span>
          </div>
        </header>
        <main className="workspace-content">
          <div className="workspace-title">
            <div>
              <span className="eyebrow">
                {organization?.name || 'WELCOME TO AFRICORE'} ·{' '}
                {isDemo()?'DEMO':'BUSINESS'}
              </span>
              <h1>{tab === 'Overview' ? 'Business Overview' : tab}</h1>
              <p>
                {tab === 'Overview'
                  ? 'Track payments, outstanding invoices and activity that needs attention.'
                  : (
                      {
                        Customers:
                          'Add customers, then link their orders and invoices. Open a row to inspect the saved details.',
                        Orders:
                          'Create itemized orders, track payment and fulfillment, then issue an eligible invoice.',
                        Invoices:
                          'Create a draft, issue it, then follow confirmed allocations and the remaining balance.',
                        Payments:
                          'Inspect payment requests and provider results. Confirmation, allocation and settlement are separate.',
                        Reconciliation:
                          'Review allocations and unmatched events. A review note never turns an unverified import into a receipt.',
                        Team: 'Invite a member, choose a role and review access. Backend permissions apply to every request.',
                        Developers:
                          'Create an application, scope its server key and review signed webhook delivery.',
                        Transactions:
                          'Import source records with stable IDs. Imported credits do not confirm payment.',
                        Settings:
                          'Review workspace identity and recorded changes.',
                      } as Record<string, string>
                    )[tab] ||
                    ({'Cash Flow':'Review recorded movement and upcoming obligations.',Reports:'Filter financial records and export matching totals.',Intelligence:'Explore trends, forecasts and risks from available records.',Forecasts:'Review projections and the assumptions behind them.',Automations:'Manage rules, approvals and workflow runs.',Notifications:'Review workspace notifications.',Approvals:'Review actions that need your approval.',Assistant:'Ask questions grounded in your authorized records.',Fulfillment:'Track orders through delivery.',Connect:'Manage supported data connections.','Business Passport':'Manage business identity and share selected credentials.'} as Record<string,string>)[tab] || 'Manage your authorized workspace records.'}
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
          {(isDemo()||['Payments','Reconciliation'].includes(tab))&&<p className="environment-note">{isDemo()?'Demo workspace · ':''}{environment==='sandbox'?'Test payment events only. No real funds move.':'Live payment collection is not configured.'}</p>}
          <ErrorBox error={error} />
          {error&&<button className="secondary-button" onClick={load}>Retry this view</button>}
          {busy&&data&&<p className="background-update" role="status">Refreshing records…</p>}
          {notice && (
            <div className="alert one-time" role="status">
              {notice}
              {notice.startsWith('http') && (
                <p>
                  <a href={notice} target="_blank" rel="noreferrer">
                    Open checkout <Icon name="right" />
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
                      Save <Icon name="right" />
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
              {isDemo() && (
                <div className="alert demo-banner" role="status">
                  <b>Interactive demo · synthetic data</b>
                  <p>
                    No database or real funds. Changes stay in this browser. AI,
                    external providers and protected settlement require backend
                    configuration.
                  </p>
                  <button
                    onClick={() => {
                      startDemo(true);
                      location.reload();
                    }}
                  >
                    Reset demo data
                  </button>
                </div>
              )}
              {tab === 'Business Passport' && (
                <PassportWorkspace
                  key={org + environment}
                  org={org}
                  environment={environment}
                  role={organization?.role || 'viewer'}
                />
              )}
              {operationsTabs.includes(tab) && (
                <OperationsWorkspace
                  key={org + environment + tab}
                  section={tab}
                  org={org}
                  environment={environment}
                  role={organization?.role || 'viewer'}
                  onNavigate={setTab}
                />
              )}
              {busy && !data && (
                <div className="skeleton" role="status">
                  Loading your records…
                </div>
              )}
              {['Overview', 'Cash Flow', 'Reports'].includes(tab) && (
                <>
                  {tab !== 'Overview' && (
                    <DateRange from={reportFilters.from} to={reportFilters.to} onApply={(from,to)=>{setLoaded(null);setReportFilters({from,to,currency:documentCurrency});}}><Field label="Currency"><select value={documentCurrency} onChange={e=>setDocumentCurrency(e.target.value)}>{['KES','USD','EUR','GBP','UGX','TZS','RWF'].map(c=><option key={c}>{c}</option>)}</select></Field><button type="button" className="button" onClick={exportReport}>Export CSV <Icon name="down"/></button></DateRange>

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
                      maxLength={200}
                      placeholder="Search records…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="quiet-button" onClick={load}>
                      Refresh
                    </button>
                  </div>
                  <section className="panel record-panel">
                    {data?.data?.length ? (
                      <div className="table-scroll">
                        <DataTable>
                          <thead>
                            <tr>
                              <th>Reference / name</th>
                              <th>Status / type</th>
                              <th>Amount / description</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.data.map((r: any) => (
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
                                          setTimeout(() => window.print(), 100);
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
                        </DataTable>
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
              {recordTabs.includes(tab) && (
                <nav className="record-pagination" aria-label="Record pages">
                  <button
                    className="secondary-button"
                    disabled={busy || offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - 25))}
                  >
                    Previous page
                  </button>
                  <span role="status">
                    {data?.data?.length
                      ? 'Records ' +
                        (offset + 1) +
                        '–' +
                        (offset + data.data.length)
                      : 'No matching records'}
                    {search ? ' matching “' + search + '”' : ''}
                  </span>
                  <button
                    className="secondary-button"
                    disabled={busy || !data?.data || data.data.length < 25}
                    onClick={() => setOffset(offset + 25)}
                  >
                    Next page
                  </button>
                </nav>
              )}
              {tab === 'Invoices' && data?.data?.length > 0 && (
                <RecordAnalytics records={data.data} kind="invoices" />
              )}
              {tab === 'Payments' && data?.data?.length > 0 && (
                <RecordAnalytics records={data.data} kind="payments" />
              )}
              {tab === 'Payments' && (
                <section className="panel">
                  <h2>Payment requests</h2>
                  {data?.data?.length ? (
                    <div className="table-scroll">
                      <DataTable>
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
                      </DataTable>
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
                <ReconciliationOverview data={data} />
              )}
              {tab === 'Reconciliation' && (
                <details className="panel learning-helper">
                  <summary>How payment matching works</summary>
                  <ol>
                    <li>Use a provider-confirmed payment event.</li>
                    <li>
                      Match its reference, amount and currency to a request.
                    </li>
                    <li>
                      Review duplicates, mismatches or unallocated records.
                    </li>
                    <li>Record a review note; retain the original evidence.</li>
                  </ol>
                  <p>
                    Imported credits and a customer’s screenshot cannot confirm
                    a payment.
                  </p>
                </details>
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
              {tab==='Team'&&<TeamDirectory key={org+environment} data={data} call={call} action={action} role={organization?.role} actor={me?.id}/> }
              {tab === 'Settings' && (
                <>
                  <section className="panel">
                    <h2>Business profile</h2>
                    <p>
                      {organization?.name} · {organization?.verification_status}
                    </p>
                    <p>
                      Default currency: {organization && profile?.currency} ·
                      Default display timezone: Africa/Nairobi
                    </p>
                    <p>
                      Identity and business verification are not completed
                      automatically.
                    </p>
                    <a href="/verify">
                      Verify your email <Icon name="right" />
                    </a>
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
                <Overlay onClose={() => setSelected(null)}>
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
                    >
                      Close <Icon name="close" />
                    </button>
                    <h2>{selected.reference || selected.name}</h2>
                    {selected.kind === 'invoices' ? (
                      <>
                        <p>
                          {organization?.name} · {profile?.email}
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
                        <DataTable>
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
                        </DataTable>
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
                    ) : selected.kind === 'customers' ? (
                      <p>
                        {selected.email || 'No email recorded'} ·{' '}
                        {selected.phone || 'No phone recorded'}
                      </p>
                    ) : (
                      <pre>{JSON.stringify(selected, null, 2)}</pre>
                    )}
                    {selected.kind === 'customers' && writable && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const values = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          const result = await action(() =>
                            call(
                              '/records/customers/' + selected.id,
                              'PATCH',
                              values,
                            ),
                          );
                          if (result) {
                            setSelected(null);
                            setNotice('Customer updated.');
                          }
                        }}
                      >
                        <Field label="Customer name">
                          <input
                            name="name"
                            required
                            maxLength={200}
                            defaultValue={selected.name}
                          />
                        </Field>
                        <Field label="Email">
                          <input
                            name="email"
                            type="email"
                            defaultValue={selected.email}
                          />
                        </Field>
                        <Field label="Phone">
                          <input
                            name="phone"
                            maxLength={50}
                            defaultValue={selected.phone}
                          />
                        </Field>
                        <Field label="Notes">
                          <textarea
                            name="notes"
                            maxLength={3000}
                            defaultValue={selected.notes}
                          />
                        </Field>
                        <button className="button" disabled={busy}>
                          Save customer changes
                        </button>
                        <ErrorBox error={error} />
                      </form>
                    )}
                  </section>
                </Overlay>
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
