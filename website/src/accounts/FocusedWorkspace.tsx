import {CustomerTools} from '../finance/CustomerTools';
import {FinancialOverview} from '../finance/FinancialOverview';
import {PaymentCentre} from '../finance/PaymentCentre';
import {RecordFinanceDetails} from '../finance/RecordFinanceDetails';
import {MoneyTools} from '../marketplace/MoneyTools';
import { DateRange } from '../components/DateRange';
import { InteractiveChart } from '../charts/InteractiveChart';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api-client";
import { Logo } from "../components/Logo";
import { DataTable } from "../components/DataTable";
import { managedSignOut } from "./auth";
import { money, amount, today, Field, Alert, Currency } from "./AccountUI";
import { DeveloperPanels } from "./DeveloperPanels";
import {Overlay} from '../components/Overlay';
import {Icon} from '../components/Icon';
import {useMarketplace,Services,ServiceGate,marketTabs,visibleServiceTab,canReadServiceTab,favoriteTabs} from '../marketplace/Services';
export function FocusedWorkspace({
  workspace: w,
  account,
}: {
  workspace: any;
  account: any;
}) {
  const personal = w.kind === "personal";
  const [selectedInvoice,setSelectedInvoice]=useState<any>(null);
  const [navigationOpen,setNavigationOpen]=useState(false);
  const items = personal
    ? [
        "Overview",
        ...marketTabs,
        "Income",
        "Expenses",
        "Invoices",
        "Clients",
        "Payment Records",
        "Cash Flow",
        "Reports",
        "Learn",
        "Settings",
      ]
    : [
        "Overview",
        ...marketTabs,
        "My Applications",
        "API Keys",
        "API Explorer",
        "Sandbox",
        "Webhooks",
        "Request Logs",
        "Usage & Limits",
        "API Documentation",
        "SDKs & Examples",
        "Verification APIs",
        "Settings",
        "Support",
      ];
  const [tab, setTab] = useState(
    items.includes(decodeURIComponent(location.hash.slice(1)))
      ? decodeURIComponent(location.hash.slice(1))
      : "Overview",
  );
  const [environment, setEnvironment] = useState("sandbox"),
    [currency, setCurrency] = useState(w.currency||account.profile?.currency || "KES"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  useEffect(()=>{history.replaceState(null,'',location.pathname+location.search+'#'+encodeURIComponent(tab));},[tab]);
  const market=useMarketplace(w.id,environment,w.kind,account?.service_catalog);
  const pins=favoriteTabs(market),visibleItems=[...new Set([...items.filter(t=>['Overview',...marketTabs].includes(t)),...pins,...items])].filter(t=>visibleServiceTab(market,t));
  const [data, setData] = useState<any>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [key, setKey] = useState(""),
    [result, setResult] = useState("");
  const creationKeys=useRef(new Map<string,string>());
  const generation = useRef(0),
    base = "/api/v1/organizations/" + w.id;
  const call = (suffix:string,method='GET',body?:unknown,headers?:Record<string,string>)=>{
    const intent=base+'\0'+environment+'\0'+suffix+'\0'+JSON.stringify(body),idempotent=method==='POST'&&(/^\/records\//.test(suffix)||suffix==='/expenses');
    if(idempotent&&!creationKeys.current.has(intent))creationKeys.current.set(intent,crypto.randomUUID());
    return api(base+suffix,method,body,environment,idempotent?{'Idempotency-Key':creationKeys.current.get(intent)!,...headers}:headers).then(result=>{if(idempotent)creationKeys.current.delete(intent);return result;});
  };
  useEffect(() => {
    const change = () => {
      const t = decodeURIComponent(location.hash.slice(1));
      if (items.includes(t)) setTab(t);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [personal]);
  useEffect(() => {
    setSelectedInvoice(null);
    setKey("");
    setResult("");
  }, [w.id, environment,tab]);
  useEffect(() => {
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setData({});
    if(marketTabs.includes(tab)||!canReadServiceTab(market,tab)){setBusy(false);return;}
    const read=(needed:boolean,path:string)=>needed?call(path):Promise.resolve({data:[]});
    const has=(id:string)=>market.catalog?.services.some((s:any)=>s.id===id&&s.status==='active');
    const requests = personal
      ? [
          read(['Overview','Cash Flow','Reports'].includes(tab),
            "/personal-summary?" +
              new URLSearchParams({
                currency,
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
              }),
          ),
          read(tab==='Income'||tab==='Overview'&&has('income'),"/personal-income"),
          read(tab==='Expenses',"/expenses?limit=100"),
          read(['Clients','Invoices'].includes(tab),"/records/customers?limit=100"),
          read(tab==='Invoices',"/records/invoices?limit=100"),
          read(tab==='Payment Records',"/records/transactions?limit=100"),
        ]
      : [
          read(has('developer_api')&&['Overview','Usage & Limits','My Applications','API Keys','API Explorer'].includes(tab),"/records/applications?limit=100"),
          read(has('developer_api')&&['Overview','Usage & Limits','API Keys','API Explorer'].includes(tab),"/credentials"),
          read(has('webhooks')&&['Overview','Usage & Limits','Webhooks'].includes(tab),"/webhooks"),
          read(['Request Logs'].includes(tab),"/audit"),
          read(['Overview','Usage & Limits','Request Logs'].includes(tab),"/request-logs"),
        ];
    Promise.all(requests)
      .then((values) => {
        if (version === generation.current)
          setData(
            personal
              ? {
                  summary: values[0],
                  income: values[1].data,
                  expenses: values[2].data,
                  clients: values[3].data,
                  invoices: values[4].data,
                  payments: values[5].data,
                }
              : {
                  applications: values[0].data,
                  credentials: values[1].data,
                  webhooks: values[2],
                  logs: values[3].data,
                  requests: values[4].data,
                },
          );
      })
      .catch((e) => {
        if (version === generation.current) setError(e.message);
      })
      .finally(() => {
        if (version === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
    };
  }, [w.id, environment, currency, from, to, revision,tab,market.catalog]);
  async function mutate(fn: () => Promise<any>) {
    const version = generation.current;
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      if (version === generation.current) {
        setRevision((n) => n + 1);
        return r;
      }
    } catch (e) {
      if (version === generation.current) setError((e as Error).message);
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  function form(handler: (d: FormData) => Promise<any>) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = e.currentTarget;
      mutate(() => handler(new FormData(f))).then((r) => {
        if (r) f.reset();
      });
    };
  }
  const summary = data.summary || {},
    list = (rows: any[], columns: string[]) =>
      busy && !rows ? (
        <p role="status">Loading records…</p>
      ) : rows?.length ? (
        <DataTable>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>
                  {(
                    {
                      amount_minor: "Amount",
                      total_minor: "Total",
                      occurred_on: "Date",
                      processing_status: "Status",
                      type: "Type",
                      description: "Description",
                      name: "Name",
                      email: "Email",
                      phone: "Phone",
                      currency: "Currency",
                    } as Record<string, string>
                  )[c] || c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c}>
                    {c.endsWith("_minor")
                      ? money(r[c], r.currency)
                      : String(r[c] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <p className="empty">
          No {tab.toLowerCase()} records yet. Add a record using the form above.
        </p>
      );
  const navigation=<>
        <Logo />
        <p>{personal ? "PERSONAL WORKSPACE" : "DEVELOPER CONSOLE"}</p>
        <nav aria-label={personal?'Personal navigation':'Developer navigation'}>{visibleItems.map(t=><a key={t} href={t==='Settings'?'/app/account':t==='Learn'?'/learn':'#'+encodeURIComponent(t)} aria-current={tab===t?'page':undefined} onClick={()=>{setTab(t);setNavigationOpen(false);}}>{t}</a>)}</nav>
        <a href="/app/workspaces">Switch or add workspace</a>
        <button onClick={async()=>{try{await managedSignOut();location.href='/login';}catch(e){setError((e as Error).message);}}}>Sign out</button>
      </>;
  return (
    <div className="focused-account">
      <aside className="account-nav">
        <Logo />
        <p>{personal ? "PERSONAL WORKSPACE" : "DEVELOPER CONSOLE"}</p>
        <nav
          aria-label={personal ? "Personal navigation" : "Developer navigation"}
        >
          {visibleItems.map((t) => (
            <a
              key={t}
              href={
                t === "Settings"
                  ? "/app/account"
                  : t === "Learn"
                    ? "/learn"
                    : "#" + encodeURIComponent(t)
              }
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              {t}
            </a>
          ))}
        </nav>
        <a href="/app/workspaces">Switch or add workspace</a>
        <button
          onClick={async () => {
            try {
              await managedSignOut();
              location.href = "/login";
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="account-content">
        <div className="focused-mobile-header"><button className="quiet-button" aria-label={'Open '+(personal?'Personal':'Developer')+' navigation'} aria-expanded={navigationOpen} onClick={()=>setNavigationOpen(true)}><Icon name="menu"/></button><span>{w.name}</span><a href="/app/workspaces">Workspaces</a></div>
        {navigationOpen&&<Overlay onClose={()=>setNavigationOpen(false)}><aside role="dialog" aria-modal="true" aria-label="Workspace navigation" className="account-nav focused-drawer"><button onClick={()=>setNavigationOpen(false)}>Close menu <Icon name="close"/></button>{navigation}</aside></Overlay>}
        <header className="account-top">
          <div>
            <span className="eyebrow">
              {w.role} · {w.kind}
            </span>
            <h1>{w.name}</h1>
          </div>
          <div>
            {!personal&&<label>
              Environment{" "}
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              >
                <option value="sandbox">Sandbox</option>
                {selectedInvoice&&<Overlay onClose={()=>setSelectedInvoice(null)}><section className="service-detail print-invoice" role="dialog" aria-modal="true" aria-label="Invoice financial details"><h2>{selectedInvoice.reference}</h2><RecordFinanceDetails row={{...selectedInvoice,kind:'invoices'}} printDocument api={call} writable={['owner','admin','finance'].includes(w.role)} onChanged={()=>setRevision(v=>v+1)}/><button onClick={()=>setSelectedInvoice(null)}>Close</button></section></Overlay>}
        {personal && (
                  <option value="production">Personal records</option>
                )}
              </select>
            </label>}
            <a href="/app/workspaces">All workspaces</a>
          </div>
        </header>
        <p className="environment-note">
          {personal ? "Personal records · payment simulations stay separate from manual entries." : environment === "sandbox"
            ? "Sandbox · test records only. No live funds move."
            : "Recorded personal activity. Manual entries are not provider confirmation."}
        </p>
        <h2>{tab}</h2>
        <Alert error={error} />
        {busy && <p role="status">Updating workspace…</p>}
        {marketTabs.includes(tab)?<Services market={market} view={tab} navigate={setTab} manager={['owner','admin'].includes(w.role)}/>:<ServiceGate market={market} tab={tab} navigate={setTab}>
        {personal && (
          <>
            {['Overview','Cash Flow','Reports'].includes(tab)&&<DateRange from={from} to={to} onApply={(start,end)=>{setFrom(start);setTo(end);}}><Field label="Currency"><Currency value={currency} onChange={(e:any)=>setCurrency(e.target.value)}/></Field></DateRange>}

            {["Overview", "Cash Flow", "Reports"].includes(tab) && (
              <>
                <div className="account-metrics">
                  {[
                    ["Recorded income", summary.manual_income_minor],
                    ["Recorded expenses", summary.recorded_expenses_minor],
                    ["Recorded net", summary.recorded_net_minor],
                    [
                      "Outstanding invoices",
                      summary.outstanding_invoices_minor,
                    ],
                  ].map(([label, n]) => (
                    <section key={String(label)}>
                      <span>{label}</span>
                      <strong>
                        {n === undefined ? "—" : money(Number(n), currency)}
                      </strong>
                      <small>
                        {environment} · {currency}
                      </small>
                    </section>
                  ))}
                </div>
                <section className="panel"><InteractiveChart compact title="Recorded personal activity" points={summary.series||[]} currency={currency} series={[{key:'income',label:'Recorded income',color:'#426900'},{key:'expenses',label:'Recorded expenses',color:'#595959'},{key:'net',label:'Recorded net',color:'#985b20',dashed:true}]} description="Manual income and expenses; not provider confirmation, profit or a bank balance."/>{tab==='Reports'&&<button className="secondary-button" onClick={()=>{const csv=['Date,Currency,Recorded income minor,Recorded expenses minor,Recorded net minor',...(summary.series||[]).map((p:any)=>[p.date,currency,p.income,p.expenses,p.net].join(','))].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='africore-personal-activity.csv';a.click();URL.revokeObjectURL(url);}}>Export activity CSV</button>}</section>
                <p>{summary.coverage}</p>
                <div className="account-type-tabs">
                  {["Income", "Expenses", "Invoices", "Clients"].map((t) => (
                    <a className="secondary-button" href={"#" + t} key={t}>
                      Add {t === "Clients" ? "client" : t.toLowerCase()}
                    </a>
                  ))}
                </div>
                {list(data.income, [
                  "description",
                  "amount_minor",
                  "currency",
                  "occurred_on",
                ])}
              </>
            )}
            {tab==='Clients'&&<CustomerTools api={call} org={w.id} environment={environment} writable={['owner','admin','operations','finance'].includes(w.role)} onChanged={()=>setRevision(v=>v+1)}/>}
            {tab === "Clients" && (
              <>
                <form
                  className="account-inline-form"
                  onSubmit={form((d) =>
                    call("/records/customers", "POST", {
                      name: d.get("name"),
                      email: d.get("email"),
                      phone: d.get("phone"),
                      type: "individual",
                    }),
                  )}
                >
                  <h3>Add client</h3>
                  <Field label="Name">
                    <input name="name" required maxLength={200} />
                  </Field>
                  <Field label="Email (optional)">
                    <input name="email" type="email" />
                  </Field>
                  <Field label="Phone (optional)">
                    <input name="phone" maxLength={50} />
                  </Field>
                  <button className="button" disabled={busy}>
                    Add client
                  </button>
                </form>
                {list(data.clients, ["name", "email", "phone"])}
              </>
            )}
            {(tab === "Income" || tab === "Expenses") && (
              <>
                <form
                  className="account-inline-form"
                  onSubmit={form((d) =>
                    call(
                      tab === "Income" ? "/personal-income" : "/expenses",
                      "POST",
                      {
                        description: d.get("description"),
                        amount_minor: amount(
                          d.get("amount"),
                          String(d.get("currency")),
                        ),
                        currency: d.get("currency"),
                        occurred_on: d.get("occurred_on"),
                        ...(tab === "Expenses"
                          ? { category: d.get("category") }
                          : {}),
                      },
                    ),
                  )}
                >
                  <h3>Add {tab.toLowerCase()}</h3>
                  <p>
                    Manually recorded. This does not confirm a provider payment.
                  </p>
                  <Field label="Description">
                    <input name="description" required maxLength={300} />
                  </Field>
                  <Field label="Amount">
                    <input
                      name="amount"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                    />
                  </Field>
                  <Field label="Currency">
                    <Currency name="currency" defaultValue={currency} />
                  </Field>
                  <Field label="Date">
                    <input
                      name="occurred_on"
                      type="date"
                      defaultValue={today(
                        account.profile?.timezone || "Africa/Nairobi",
                      )}
                      required
                    />
                  </Field>
                  {tab === "Expenses" && (
                    <Field label="Category">
                      <select name="category">
                        {[
                          "other",
                          "rent",
                          "utilities",
                          "delivery",
                          "stock",
                          "payroll",
                        ].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <button className="button" disabled={busy}>
                    Record {tab.toLowerCase()}
                  </button>
                </form>
                {list(tab === "Income" ? data.income : data.expenses, [
                  "description",
                  "amount_minor",
                  "currency",
                  "occurred_on",
                ])}
                <p>
                  Showing up to 100 most recent records. Summary totals use all
                  matching records.
                </p>
              </>
            )}
            {tab === "Invoices" && (
              <>
                <form
                  className="account-inline-form"
                  onSubmit={form((d) =>
                    call("/records/invoices", "POST", {
                      customer_id: d.get("customer_id"),
                      currency: d.get("currency"),
                      issue_date: d.get("issue_date"),
                      due_date: d.get("due_date"),
                      items: [
                        {
                          description: d.get("description"),
                          quantity: 1,
                          unit_price_minor: amount(
                            d.get("amount"),
                            String(d.get("currency")),
                          ),
                        },
                      ],
                    }),
                  )}
                >
                  <h3>Create invoice</h3>
                  <Field label="Client">
                    <select name="customer_id" required>
                      <option value="">Select client</option>
                      {data.clients?.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Work description">
                    <input name="description" required maxLength={500} />
                  </Field>
                  <Field label="Amount">
                    <input
                      name="amount"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                    />
                  </Field>
                  <Field label="Currency">
                    <Currency name="currency" defaultValue={currency} />
                  </Field>
                  <Field label="Issue date">
                    <input
                      name="issue_date"
                      type="date"
                      defaultValue={today(
                        account.profile?.timezone || "Africa/Nairobi",
                      )}
                      required
                    />
                  </Field>
                  <Field label="Due date">
                    <input name="due_date" type="date" required />
                  </Field>
                  <button
                    className="button"
                    disabled={busy || !data.clients?.length}
                  >
                    Create draft invoice
                  </button>
                  {!data.clients?.length && !busy && <p>Add a client first.</p>}
                </form>
                {data.invoices?.map((i: any) => (
                  <article className="account-record" key={i.id}>
                    <button className="quiet-button" onClick={()=>setSelectedInvoice(i)}>{i.reference} · View balances & actions</button>
                    <span>
                      {money(i.total_minor, i.currency)} · {i.status} · Due{" "}
                      {i.due_date}
                    </span>
                    {i.status === "draft" && (
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() =>
                          mutate(() =>
                            call("/records/invoices/" + i.id, "PATCH", {
                              status: "issued",
                            }),
                          )
                        }
                      >
                        Issue invoice
                      </button>
                    )}
                  </article>
                ))}
              </>
            )}
            {tab==='Cash Flow'&&<FinancialOverview api={call} scope={w.id+environment}/>}
            {tab==='Payment Records'&&<PaymentCentre api={call} scope={w.id+environment} writable={['owner','admin','finance'].includes(w.role)}/>}
            {tab==='Cash Flow'&&<MoneyTools api={call} scope={w.id+environment} cashFlow writable={['owner','admin','finance'].includes(w.role)}/>}
            {tab === "Payment Records" && (
              <>
                <p>
                  Provider records are kept separately from manually entered
                  income. Sandbox records are simulations.
                </p>
                {list(data.payments, [
                  "type",
                  "amount_minor",
                  "currency",
                  "processing_status",
                ])}
              </>
            )}
          </>
        )}
        {!personal && (
          <DeveloperPanels
            tab={tab}
            data={data}
            call={call}
            mutate={mutate}
            form={form}
            busy={busy}
            keyValue={key}
            setKey={setKey}
            result={result}
            setResult={setResult}
            workspace={w}
          />
        )}
        </ServiceGate>}
      </main>
    </div>
  );
}
