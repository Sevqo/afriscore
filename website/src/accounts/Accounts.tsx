import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api, BusinessApp } from "../BusinessApp";
import { Logo } from "../App";
import { Icon, type IconName } from "../components/Icon";
import { DataTable } from "../components/DataTable";
import { isDemo } from "../demo/transport";
import { managedClient, managedSignOut } from "./auth";
import "./accounts.css";
const types = [
  {
    kind: "personal",
    title: "Personal",
    icon: "user",
    description:
      "Manage your own work, invoices, income and expenses without setting up a company.",
  },
  {
    kind: "business",
    title: "Business",
    icon: "grid",
    description:
      "Run your business with connected customers, invoices, payments, team tools and financial insights.",
  },
  {
    kind: "developer",
    title: "Developer",
    icon: "code",
    description:
      "Build applications with AfriCore APIs, sandbox testing, webhooks and developer tools.",
  },
];
const url = (w: any) =>
  w.kind === "business" ? "/app/business/" + w.id : "/app/" + w.kind;
const money = (n: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(
    Number(n || 0) / (["UGX", "RWF"].includes(currency) ? 1 : 100),
  );
const amount = (v: FormDataEntryValue | null, currency: string) => {
  const scaled = Number(v) * (["UGX", "RWF"].includes(currency) ? 1 : 100);
  if (
    !Number.isSafeInteger(Math.round(scaled)) ||
    scaled <= 0 ||
    Math.abs(scaled - Math.round(scaled)) > 0.000001
  )
    throw new Error(
      "Enter a positive amount using the currency’s supported decimal places.",
    );
  return Math.round(scaled);
};
const today = (timezone = "Africa/Nairobi") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Alert({ error }: { error: string }) {
  return error ? (
    <p className="alert error" role="alert">
      {error}
    </p>
  ) : null;
}
export function AccountChooser() {
  return (
    <main className="account-entry">
      <Logo />
      <span className="eyebrow">ONE ACCOUNT. ROOM TO GROW.</span>
      <h1>How will you use AfriCore?</h1>
      <p>
        Choose the experience that fits you. You can add other workspaces later.
      </p>
      <div className="account-options">
        {types.map((t) => (
          <a
            className="account-option"
            key={t.kind}
            href={"/sign-up/" + t.kind}
          >
            <Icon name={t.icon as IconName} />
            <h2>{t.title}</h2>
            <p>{t.description}</p>
            <strong>
              Continue as {t.title} <Icon name="right" />
            </strong>
          </a>
        ))}
      </div>
      <p>
        Already have an account? <a href="/login">Sign In</a>
      </p>
      <a href="/demo">Explore the isolated guest demo</a>
    </main>
  );
}

export function AccountApp() {
  const [account, setAccount] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (isDemo()) return;
    let live = true;
    api("/api/auth/account")
      .then((a) => {
        if (live) setAccount(a);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  if (isDemo()) return <BusinessApp />;
  if (error)
    return (
      <main className="account-entry">
        <Logo />
        <h1>Workspace unavailable</h1>
        <Alert error={error} />
        <a className="button" href="/login">
          Sign in
        </a>
      </main>
    );
  if (!account)
    return (
      <main className="account-entry" role="status">
        Loading your account…
      </main>
    );
  const path = location.pathname;
  if (path === "/app" || path === "/auth/callback") {
    const create = new URLSearchParams(location.search).get("create");
    location.replace(
      types.some((t) => t.kind === create)
        ? "/app/workspaces?create=" + create
        : account.destination,
    );
    return <p role="status">Opening your workspace…</p>;
  }
  if (path === "/app/account") return <AccountSettings account={account} />;
  if (path === "/app/workspaces") return <Workspaces account={account} />;
  const target = path.startsWith("/app/business/")
    ? account.workspaces.find(
        (w: any) => w.kind === "business" && w.id === path.split("/")[3],
      )
    : account.workspaces.find((w: any) => "/app/" + w.kind === path);
  if (!target)
    return (
      <main className="account-entry">
        <h1>Workspace access required</h1>
        <p>This address is not one of your current memberships.</p>
        <a href="/app/workspaces">View authorized workspaces</a>
      </main>
    );
  return (
    <ActiveWorkspace
      key={target.id}
      id={target.id}
      selected={account.workspace?.id === target.id}
    >
      {target.kind === "business" ? (
        <BusinessApp initialOrg={target.id} />
      ) : (
        <FocusedWorkspace
          key={target.id}
          workspace={target}
          account={account}
        />
      )}
    </ActiveWorkspace>
  );
}
function ActiveWorkspace({
  id,
  selected,
  children,
}: {
  id: string;
  selected: boolean;
  children: ReactNode;
}) {
  const [error, setError] = useState(""),
    [ready, setReady] = useState(selected);
  const visit = useRef<Promise<any> | null>(null);
  useEffect(() => {
    let live = true;
    if (selected) {
      setReady(true);
      return;
    }
    visit.current ||= api("/api/auth/account/workspace", "POST", {
      workspace_id: id,
    });
    visit.current
      .then(() => {
        if (live) setReady(true);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, selected]);
  return error ? (
    <main className="account-entry">
      <h1>Workspace access changed</h1>
      <Alert error={error} />
      <a href="/app/workspaces">Resolve current access</a>
    </main>
  ) : !ready ? (
    <main className="account-entry" role="status">
      Opening your authorized workspace…
    </main>
  ) : (
    children
  );
}
function Workspaces({ account }: { account: any }) {
  const chosen = new URLSearchParams(location.search).get("create");
  const [kind, setKind] = useState(
    types.some((t) => t.kind === chosen) ? chosen! : "",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      const w = await api("/api/auth/workspaces", "POST", { ...d, kind });
      location.href = url(w);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function select(w: any) {
    setBusy(true);
    try {
      await api("/api/auth/account/workspace", "POST", { workspace_id: w.id });
      location.href = url(w);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="account-entry">
      <Logo />
      <h1>Your workspaces</h1>
      <p>One identity. Separate records and permissions for every workspace.</p>
      <div className="account-options">
        {account.workspaces.map((w: any) => (
          <button
            className="account-option"
            key={w.id}
            disabled={busy}
            onClick={() => select(w)}
          >
            <span className="eyebrow">
              {w.kind} · {w.role}
            </span>
            <h2>{w.name}</h2>
            <span>
              Open workspace <Icon name="right" />
            </span>
          </button>
        ))}
      </div>
      <h2>
        {account.workspaces.length
          ? "Add a workspace"
          : "Set up your first workspace"}
      </h2>
      <div
        className="account-type-tabs"
        role="group"
        aria-label="New workspace type"
      >
        {types.map((t) => (
          <button
            className={kind === t.kind ? "button" : "secondary-button"}
            key={t.kind}
            onClick={() => setKind(t.kind)}
            aria-pressed={kind === t.kind}
          >
            {t.title}
          </button>
        ))}
      </div>
      {kind && (
        <form className="account-form" key={kind} onSubmit={create}>
          <h2>{types.find((t) => t.kind === kind)?.title} setup</h2>
          <p>{types.find((t) => t.kind === kind)?.description}</p>
          <Field label="Your display name">
            <input
              name="display_name"
              defaultValue={account.profile?.display_name || ""}
              required
              maxLength={100}
            />
          </Field>
          <Field
            label={
              kind === "business"
                ? "Business name"
                : kind === "developer"
                  ? "Developer workspace name"
                  : "Personal workspace name"
            }
          >
            <input name="name" required minLength={2} maxLength={100} />
          </Field>
          <Field label="Country code">
            <input
              name="country"
              defaultValue="KE"
              required
              pattern="[A-Z]{2}"
              maxLength={2}
            />
          </Field>
          <Field label="Default currency">
            <Currency name="currency" defaultValue={account.profile?.currency||'KES'}/>
          </Field>
          <Field label="Timezone">
            <input name="timezone" defaultValue={account.profile?.timezone||'Africa/Nairobi'} required />
          </Field>
          {kind === "business" && (
            <>
              <Field label="Business type">
                <select name="business_type">
                  <option value="sole_proprietor">Sole proprietor</option>
                  <option value="company">Company</option>
                  <option value="partnership">Partnership</option>
                </select>
              </Field>
              <Field label="Industry">
                <input name="industry" required maxLength={100} />
              </Field>
              <Field label="Location">
                <input name="location" required maxLength={200} />
              </Field>
              <Field label="Business phone">
                <input name="phone" maxLength={50} />
              </Field>
              <p>
                Setup does not verify your business or enable live payment
                services.
              </p>
            </>
          )}
          {kind === "developer" && (
            <>
              <Field label="Primary use case">
                <input
                  name="use_case"
                  placeholder="Invoicing, payments, webhooks or verification"
                  maxLength={500}
                />
              </Field>
              <Field label="Preferred language (optional)">
                <input
                  name="language"
                  placeholder="TypeScript"
                  maxLength={80}
                />
              </Field>
              <p>
                Start with isolated sandbox APIs. Production access requires
                separate review.
              </p>
            </>
          )}
          <Alert error={error} />
          <button className="button" disabled={busy}>
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </form>
      )}
      {!kind && <Alert error={error} />}
      <p>
        <a href="/app/account">Account settings</a>
      </p>
    </main>
  );
}
function Currency(props: any) {
  return (
    <select
      {...props}
      {...(props.value === undefined
        ? { defaultValue: props.defaultValue || "KES" }
        : {})}
    >
      {["KES", "USD", "EUR", "GBP", "UGX", "TZS", "RWF"].map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}
function AccountSettings({ account }: { account: any }) {
  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => {
    let live = true;
    api("/api/auth/sessions")
      .then((r) => {
        if (live) setSessions(r.data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function action(fn: () => Promise<any>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-entry">
      <Logo />
      <a href="/app/workspaces">All workspaces</a>
      <h1>Account & security</h1>
        <p>Account defaults apply to new workspaces. Existing workspaces retain their own currency and timezone.</p>
      <p>
        {account.user.email} ·{" "}
        {account.user.verified
          ? "Email verified"
          : "Email verification pending"}
      </p>
      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          action(
            () => api("/api/auth/account", "PATCH", d),
            "Preferences saved. Permissions remain based on your memberships.",
          );
        }}
      >
        <Field label="Display name">
          <input
            name="display_name"
            defaultValue={account.profile?.display_name || ""}
            required
          />
        </Field>
        <Field label="Default currency">
          <Currency
            name="currency"
            defaultValue={account.profile?.currency || "KES"}
          />
        </Field>
        <Field label="Timezone">
          <input
            name="timezone"
            defaultValue={account.profile?.timezone || "Africa/Nairobi"}
            required
          />
        </Field>
        <Field label="Preferred experience">
          <select
            name="primary_experience"
            defaultValue={account.profile?.primary_experience || "business"}
          >
            {types.map((t) => (
              <option value={t.kind} key={t.kind}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <button className="button" disabled={busy}>
          Save preferences
        </button>
      </form>
      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault();
          const email = String(new FormData(e.currentTarget).get("email"));
          action(async () => {
            const client = await managedClient();
            if (!client)
              throw new Error(
                "Email changes require the managed authentication provider.",
              );
            const result = await client.changeEmail({
              newEmail: email,
              callbackURL: location.origin + "/auth/callback",
            });
            if (result.error)
              throw new Error(
                result.error.message || "Email change unavailable",
              );
          }, "Check your email to confirm the address change.");
        }}
      >
        <h2>Change email</h2>
        <Field label="New email address">
          <input type="email" name="email" required autoComplete="email" />
        </Field>
        <button className="secondary-button" disabled={busy}>
          Request email change
        </button>
        <p>
          Confirmation follows the configured provider policy. An address change
          never adds workspace permissions.
        </p>
      </form>
      <section className="account-form">
        <h2>Secure your account</h2>
        <p>
          Active sessions: {sessions.length}. Use sign out all sessions to
          revoke access across devices.
        </p>
        {sessions.map((s) => (
          <article className="account-record" key={s.id}>
            <span>
              {s.current
                ? "Current session"
                : s.user_agent || "Authenticated session"}
            </span>
            <span>Expires {new Date(s.expires_at).toLocaleString()}</span>
          </article>
        ))}
        <a href="/forgot-password">Reset password using your verified email</a>
        <a href="/verify">Verify your email</a>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await api("/api/auth/signout-all", "POST", {});
              await managedSignOut(true);
              location.href = "/login";
            }, "Signed out")
          }
        >
          Sign out all sessions
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() =>
            action(
              () => api("/api/auth/account/deletion-request", "POST", {}),
              "Deletion review requested. Financial and signed history is retained pending review.",
            )
          }
        >
          Request account deletion review
        </button>
        <p>
          Deletion requires review of workspace ownership and retention
          obligations. This request does not erase financial records.
        </p>
      </section>
      <Alert error={error} />
      {notice && (
        <p className="alert" role="status">
          {notice}
        </p>
      )}
    </main>
  );
}
function FocusedWorkspace({
  workspace: w,
  account,
}: {
  workspace: any;
  account: any;
}) {
  const personal = w.kind === "personal";
  const items = personal
    ? [
        "Overview",
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
  const [data, setData] = useState<any>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [key, setKey] = useState(""),
    [result, setResult] = useState("");
  const generation = useRef(0),
    base = "/api/v1/organizations/" + w.id;
  const call = (suffix: string, method = "GET", body?: unknown) =>
    api(base + suffix, method, body, environment);
  useEffect(() => {
    const change = () => {
      const t = decodeURIComponent(location.hash.slice(1));
      if (items.includes(t)) setTab(t);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [personal]);
  useEffect(() => {
    setKey("");
    setResult("");
  }, [w.id, environment,tab]);
  useEffect(() => {
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setData({});
    const requests = personal
      ? [
          call(
            "/personal-summary?" +
              new URLSearchParams({
                currency,
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
              }),
          ),
          call("/personal-income"),
          call("/expenses?limit=100"),
          call("/records/customers?limit=100"),
          call("/records/invoices?limit=100"),
          call("/records/transactions?limit=100"),
        ]
      : [
          call("/records/applications?limit=100"),
          call("/credentials"),
          call("/webhooks"),
          call("/audit"),
          call("/request-logs"),
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
  }, [w.id, environment, currency, from, to, revision]);
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
          No records yet. Add your first record to get started.
        </p>
      );
  return (
    <div className="focused-account">
      <aside className="account-nav">
        <Logo />
        <p>{personal ? "PERSONAL WORKSPACE" : "DEVELOPER CONSOLE"}</p>
        <nav
          aria-label={personal ? "Personal navigation" : "Developer navigation"}
        >
          {items.map((t) => (
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
        <header className="account-top">
          <div>
            <span className="eyebrow">
              {w.role} · {w.kind}
            </span>
            <h1>{w.name}</h1>
          </div>
          <div>
            <label>
              Environment{" "}
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              >
                <option value="sandbox">Sandbox</option>
                {personal && (
                  <option value="production">Personal records</option>
                )}
              </select>
            </label>
            <a href="/app/workspaces">All workspaces</a>
          </div>
        </header>
        <p className="alert">
          {environment === "sandbox"
            ? "Sandbox · test records only. No live funds move."
            : "Recorded personal activity. Manual entries are not provider confirmation."}
        </p>
        <h2>{tab}</h2>
        <Alert error={error} />
        {busy && <p role="status">Updating workspace…</p>}
        {personal && (
          <>
            <div className="account-filters">
              <Field label="Currency">
                <Currency
                  value={currency}
                  onChange={(e: any) => setCurrency(e.target.value)}
                />
              </Field>
              <Field label="From">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
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
                    <strong>{i.reference}</strong>
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
      </main>
    </div>
  );
}
function DeveloperPanels({
  tab,
  data,
  call,
  mutate,
  form,
  busy,
  keyValue,
  setKey,
  result,
  setResult,
  workspace,
}: any) {
  const apps = data.applications || [],
    keys = data.credentials || [],
    hooks = data.webhooks?.data || [],
    logs = data.logs || [],
    requests = data.requests || [];
  return (
    <>
      {["Overview", "Usage & Limits"].includes(tab) && (
        <>
          <div className="account-metrics">
            {[
              ["Applications", apps.length],
              [
                "Active sandbox keys",
                keys.filter((k: any) => !k.revoked_at).length,
              ],
              ["Recent API requests", requests.length],
              [
                "Recent API errors",
                requests.filter((r: any) => r.status_code >= 400).length,
              ],
              ["Webhook endpoints", hooks.length],
            ].map(([label, n]) => (
              <section key={String(label)}>
                <span>{label}</span>
                <strong>{n}</strong>
              </section>
            ))}
          </div>
          <p>
            Activity shows the most recent 100 audit entries, not a billing
            total. Request limits are enforced by the API; this view does not
            imply a production allowance.
          </p>
          <ol>
            <li>Create an application.</li>
            <li>Create a scoped sandbox key.</li>
            <li>Use API Explorer to read synthetic resources.</li>
            <li>Configure an HTTPS webhook on an approved test destination.</li>
          </ol>
        </>
      )}
      {tab === "My Applications" && (
        <>
          <form
            className="account-inline-form"
            onSubmit={form((d: FormData) =>
              call("/records/applications", "POST", {
                name: d.get("name"),
                description: d.get("description"),
              }),
            )}
          >
            <h3>Create application</h3>
            <Field label="Name">
              <input name="name" required minLength={2} maxLength={100} />
            </Field>
            <Field label="Description">
              <input name="description" maxLength={500} />
            </Field>
            <button className="button" disabled={busy}>
              Create application
            </button>
          </form>
          {apps.map((a: any) => (
            <article className="account-record" key={a.id}>
              <strong>{a.name}</strong>
              <code>{a.id}</code>
              <p>{a.description}</p>
            </article>
          ))}
        </>
      )}
      {tab === "API Keys" && (
        <>
          <form
            className="account-inline-form"
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const r = await mutate(() =>
                call("/credentials", "POST", {
                  application_id: d.get("application_id"),
                  scopes: d.getAll("scopes"),
                }),
              );
              if (r?.key) setKey(r.key);
            }}
          >
            <h3>Create sandbox key</h3>
            <Field label="Application">
              <select name="application_id" required>
                <option value="">Select application</option>
                {apps.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend>Scopes</legend>
              {["read", "operations", "finance"].map((s) => (
                <label key={s}>
                  <input
                    type="checkbox"
                    name="scopes"
                    value={s}
                    defaultChecked={s === "read"}
                  />{" "}
                  {s}
                </label>
              ))}
            </fieldset>
            <button className="button" disabled={busy || !apps.length}>
              Create key · shown once
            </button>
          </form>
          {keyValue && (
            <section className="alert">
              <strong>Copy this key now. It is shown once.</strong>
              <code className="secret-once">{keyValue}</code>
              <button onClick={() => setKey("")}>Hide key</button>
            </section>
          )}
          {keys.map((k: any) => (
            <article className="account-record" key={k.id}>
              <code>{k.id}</code>
              <span>
                {k.environment} · {k.revoked_at ? "Revoked" : "Active"} ·{" "}
                {String(k.scopes)}
              </span>
              {!k.revoked_at && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    mutate(() => call("/credentials/" + k.id, "DELETE", {}))
                  }
                >
                  Revoke key
                </button>
              )}
            </article>
          ))}
          <p>
            Rotate by creating a replacement key, updating your integration,
            then revoking the previous key. Raw keys are never stored by this
            interface.
          </p>
        </>
      )}
      {tab === "API Explorer" && (
        <>
          <p>
            Send a read-only request with a scoped sandbox key. Keys stay in
            memory and are sent only to this workspace API.
          </p>
          <form
            className="account-inline-form"
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              try {
                const response = await api(
                  "/api/v1/organizations/" +
                    workspace.id +
                    "/records/" +
                    d.get("resource"),
                  "GET",
                  undefined,
                  "sandbox",
                  { Authorization: "Bearer " + String(d.get("api_key")) },
                );
                setResult(JSON.stringify(response, null, 2));
              } catch (e) {
                setResult((e as Error).message);
              }
            }}
          >
            <Field label="Sandbox API key">
              <input
                name="api_key"
                type="password"
                required
                autoComplete="off"
              />
            </Field>
            <Field label="Resource">
              <select name="resource">
                <option value="customers">Customers</option>
                <option value="invoices">Invoices</option>
              </select>
            </Field>
            <button className="button">Send sandbox request</button>
          </form>
          {result && <pre className="account-code">{result}</pre>}
        </>
      )}
      {tab === "Sandbox" && (
        <>
          <p>
            This creates a synthetic client in your own developer container.
            Business customer data is never copied into it.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              mutate(() =>
                call("/records/customers", "POST", {
                  name: "Synthetic sandbox client",
                  type: "individual",
                  notes: "Developer-created synthetic test data",
                }),
              )
            }
          >
            Create synthetic client
          </button>
          <p>
            Use the finance-scoped API to create test invoices and payment
            requests. <a href="/api/openapi.json">Open the API contract</a>.
          </p>
        </>
      )}
      {tab === "Webhooks" && (
        <>
          <form
            className="account-inline-form"
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const r = await mutate(() =>
                call("/webhooks", "POST", {
                  url: d.get("url"),
                  subscriptions: ["invoice.issued", "payment.succeeded"],
                }),
              );
              if (r) setResult(JSON.stringify(r, null, 2));
            }}
          >
            <h3>Add test webhook</h3>
            <Field label="Public HTTPS destination">
              <input
                name="url"
                type="url"
                required
                placeholder="https://your-approved-test-host.example/events"
              />
            </Field>
            <button className="button" disabled={busy}>
              Create endpoint
            </button>
            <p>
              Backend destination allowlist and private-network restrictions
              apply. Signing secrets are shown only on creation or rotation.
            </p>
          </form>
          {result && <pre className="account-code">{result}</pre>}
          {hooks.map((h: any) => (
            <article className="account-record" key={h.id}>
              <strong>{h.url}</strong>
              <span>{h.environment}</span>
            </article>
          ))}
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => mutate(() => call("/webhooks/process", "POST", {}))}
          >
            Process queued test deliveries
          </button>
          {data.webhooks?.deliveries?.map((d: any) => (
            <article className="account-record" key={d.id}>
              <span>
                {d.event_type} · {d.status} · Attempts {d.attempts}
              </span>
              <button
                disabled={busy}
                onClick={() =>
                  mutate(() =>
                    call("/deliveries/" + d.id + "/replay", "POST", {}),
                  )
                }
              >
                Retry delivery
              </button>
            </article>
          ))}
        </>
      )}
      {tab === "Request Logs" && (
        <>
          <p>
            Recent scoped audit metadata. Request bodies, raw API keys and
            authentication tokens are excluded.
          </p>
          {requests.map((r: any) => (
            <article className="account-record" key={r.id}>
              <strong>
                {r.method} · {r.status_code}
              </strong>
              <code>{r.route}</code>
              <time>{r.created_at}</time>
            </article>
          ))}
          {logs.map((l: any) => (
            <article className="account-record" key={l.id}>
              <strong>{l.action}</strong>
              <time>{l.created_at}</time>
              <code>{l.resource_id}</code>
            </article>
          ))}
        </>
      )}
      {["API Documentation", "SDKs & Examples"].includes(tab) && (
        <>
          <a className="button" href="/docs">
            API documentation
          </a>
          <p>
            <a href="/developers">Developer tutorial</a> ·{" "}
            <a href="/api/openapi.json">OpenAPI schema</a>
          </p>
          <pre className="account-code">{`curl "$AFRICORE_ORIGIN/api/v1/organizations/${workspace.id}/records/customers" \\\n  -H "Authorization: Bearer $AFRICORE_SANDBOX_KEY" \\\n  -H "X-Environment: sandbox"`}</pre>
          <p>Use your own backend to keep integration credentials private.</p>
        </>
      )}
      {tab === "Verification APIs" && (
        <>
          <h3>Independent verification</h3>
          <p>
            Inspect signatures, issuer status and configured blockchain
            evidence. Technical validity does not establish issuer authority or
            business truth.
          </p>
          <a className="button" href="/verify-credential">
            Open credential verifier
          </a>
        </>
      )}
      {tab === "Support" && (
        <>
          <p>
            Include the request ID when reporting an API failure. Never send raw
            keys or personal financial data.
          </p>
          <a href="/support">Support resources</a>
        </>
      )}
    </>
  );
}
