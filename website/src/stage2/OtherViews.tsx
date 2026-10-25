import { Field, Form, Provenance, Empty, type API, type Action } from './UI';
export function ConnectView({
  data,
  secondary,
  api,
  action,
  admin,
}: {
  data: any;
  secondary: any;
  api: API;
  action: Action;
  admin: boolean;
}) {
  return (
    <>
      <section className="panel">
        <h2>Available connector adapters</h2>
        <div className="connector-catalog">
          {secondary.catalog?.map((c: any) => (
            <article key={c.provider}>
              <h3>{c.provider.replaceAll('_', ' ')}</h3>
              <Provenance
                label={
                  c.production_available
                    ? 'authorized_import'
                    : 'sandbox_or_unavailable'
                }
              />
              <p>{c.authentication.replaceAll('_', ' ')}</p>
              <small>
                {c.capabilities.join(', ') || 'Live access required'}
              </small>
            </article>
          ))}
        </div>
      </section>
      {admin && (
        <Form submit={(d) => action(() => api('/connectors', 'POST', d))}>
          <div className="form-grid">
            <Field label="Sandbox adapter">
              <select name="provider">
                <option value="sandbox_accounting">Accounting</option>
                <option value="sandbox_courier">Courier</option>
                <option value="sandbox_store">Store</option>
              </select>
            </Field>
            <Field label="Test scenario">
              <select name="scenario">
                <option value="success">Success</option>
                <option value="transient_failure">
                  Temporary failure, then recovery
                </option>
                <option value="failure">Persistent failure</option>
              </select>
            </Field>
          </div>
          <button className="button">Configure sandbox source</button>
        </Form>
      )}
      <section className="panel">
        <h2>Connection health</h2>
        {data?.data?.map((c: any) => (
          <article className="commerce-row" key={c.id}>
            <div>
              <h3>{c.provider.replaceAll('_', ' ')}</h3>
              <p>
                {c.status} · Attempts {c.attempts}
              </p>
              <Provenance label={c.authorization_state} />
              <p>Last sync: {c.last_synced_at || 'Never'}</p>
              {c.last_error && (
                <p>
                  Source unavailable ·{' '}
                  {c.next_retry_at ? 'Retry scheduled' : 'Repair and reconnect'}
                </p>
              )}
              <small>
                Schema {c.normalization_version}. Sandbox samples never silently
                become live revenue.
              </small>
            </div>
            {admin && (
              <div className="row-actions">
                <button
                  onClick={() =>
                    action(() =>
                      api('/connectors/' + c.id + '/sync', 'POST', {}),
                    )
                  }
                >
                  Sync
                </button>
                {c.status === 'synced' && c.provider !== 'sandbox_courier' && (
                  <button
                    onClick={() =>
                      action(
                        () =>
                          api('/connectors/' + c.id + '/import', 'POST', {}),
                        'Normalized sandbox sample imported. Repeating is safe.',
                      )
                    }
                  >
                    Import sandbox sample
                  </button>
                )}
                <button
                  onClick={() =>
                    action(() =>
                      api('/connectors/' + c.id + '/action', 'POST', {
                        action:
                          c.status === 'disconnected'
                            ? 'reconnect'
                            : 'disconnect',
                      }),
                    )
                  }
                >
                  {c.status === 'disconnected' ? 'Reconnect' : 'Disconnect'}
                </button>
              </div>
            )}
          </article>
        ))}
        {!data?.data?.length && (
          <Empty text="Real bank, M-Pesa and tax connectors remain unavailable." />
        )}
      </section>
    </>
  );
}
export function RiskView({
  data,
  api,
  action,
}: {
  data: any;
  api: API;
  action: Action;
}) {
  return (
    <section className="panel">
      <h2>Explainable review signals</h2>
      <p>{data?.disclaimer}</p>
      {data?.signals?.length ? (
        data.signals.map((s: any) => (
          <article className="insight-row" key={s.id}>
            <h3>{s.rule.replaceAll('_', ' ')}</h3>
            <p>{s.explanation}</p>
            <small>{s.evidence_ids.length} supporting records</small>
            {s.review ? (
              <p>Reviewed: {s.review.note}</p>
            ) : (
              <Form
                className="compact-form"
                submit={(d) =>
                  action(() =>
                    api('/risk-signals/review', 'POST', {
                      signal_id: s.id,
                      note: d.note,
                    }),
                  )
                }
              >
                <input
                  name="note"
                  required
                  minLength={5}
                  placeholder="Review note"
                />
                <button className="secondary-button">Record review</button>
              </Form>
            )}
          </article>
        ))
      ) : (
        <Empty text="No rules triggered. This is not a guarantee of safety." />
      )}
    </section>
  );
}
export function EngineeringView({
  data,
  query,
  setQuery,
}: {
  data: any;
  query: string;
  setQuery: (q: string) => void;
}) {
  if (!data) return null;
  return (
    <>
      <section className="panel">
        <h2>Orbit · Stage 2 operations</h2>
        <p>
          Verified engineering allowlist only. Aggregated counts exclude
          customer records and raw prompts.
        </p>
        <h3>Automation runs</h3>
        {data.ops.automations.map((r: any) => (
          <p key={r.status}>
            {r.status}: {r.total}
          </p>
        ))}
        <h3>AI usage</h3>
        {data.ops.ai_usage.map((r: any, i: number) => (
          <p key={i}>
            {r.provider} / {r.model} · {r.status}: {r.requests} requests,{' '}
            {r.input_tokens || 0} input / {r.output_tokens || 0} output tokens
          </p>
        ))}
        <p>{data.ops.ai_cost.reason}</p>
        <h3>Webhook reliability</h3>
        {data.ops.deliveries.map((r: any) => (
          <p key={r.status}>
            {r.status}: {r.total}
          </p>
        ))}
      </section>
      <section className="panel">
        <h2>Trailhead / Kai · Approved documentation</h2>
        <input
          aria-label="Search engineering documentation"
          placeholder="Search approved documentation…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {data.docs
          .filter((d: any) =>
            (d.name + ' ' + d.text).toLowerCase().includes(query.toLowerCase()),
          )
          .map((d: any) => (
            <details className="engineering-doc" key={d.name}>
              <summary>{d.name.replaceAll('_', ' ')}</summary>
              <pre>{d.text}</pre>
            </details>
          ))}
        <p>
          Kai provides read-only document retrieval. It cannot execute
          deployments, credential changes or financial actions.
        </p>
      </section>
    </>
  );
}
