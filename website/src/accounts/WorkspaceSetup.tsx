import { useState, type FormEvent } from "react";
import { api } from "../lib/api-client";
import { Logo } from "../components/Logo";
import { Icon } from "../components/Icon";
import { types, url, Field, Alert, Currency } from "./AccountUI";
export function Workspaces({ account }: { account: any }) {
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
      <details className="panel"><summary>Join an invited workspace</summary>
        <form className="account-inline-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('/api/v1/invitations/accept','POST',{token:String(new FormData(e.currentTarget).get('token')||'')});location.href='/app/workspaces';}catch(error){setError((error as Error).message);setBusy(false);}}}>
          <Field label="Invitation token"><input required name="token" minLength={64} maxLength={64} autoComplete="off"/></Field><button className="button" disabled={busy}>Join workspace</button>
          <p>Use the token shared by the workspace owner and the email address they invited.</p>
        </form>
      </details>
    </main>
  );
}
