import { type FormEvent } from "react";
import { api } from "../lib/api-client";
import { Field } from "./AccountUI";
export function DeveloperPanels({
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
