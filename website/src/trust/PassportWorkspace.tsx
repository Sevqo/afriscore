import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { Field, Form, Provenance, request, Timeline } from '../operations/UI';
import { isDemo } from '../demo/transport';
export const trustTypes = [
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
const tabs = [
  'Overview',
  'Business Identity',
  'Credentials',
  'Trust Evidence',
  'Business Network',
  'Verification Requests',
  'Shared Access',
  'Activity History',
  'Privacy & Security',
  'Issuer Desk',
  'Trust Operations',
];
export function download(data: any, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function VerificationReport({ report }: { report: any }) {
  return (
    <section
      className="panel verification-report"
      aria-label="Verification report"
    >
      <h2>What the checks establish</h2>
      {Object.entries(report)
        .filter(([key]) => !['credentials', 'limitations'].includes(key))
        .map(([key, value]) => (
          <div className="list-row" key={key}>
            <span>{key.replaceAll('_', ' ')}</span>
            <strong>
              {typeof value === 'object'
                ? JSON.stringify(value)
                : String(value)}
            </strong>
          </div>
        ))}
      {report.credentials?.map((r: any, i: number) => (
        <VerificationReport key={i} report={r} />
      ))}
      <p>
        A valid signature protects integrity. It does not establish that every
        claim is true, that the issuer has institutional authority, or that the
        business will honor a contract.
      </p>
      <p>
        {Array.isArray(report.limitations)
          ? report.limitations.join(' ')
          : report.limitations}
      </p>
    </section>
  );
}
export function PassportWorkspace({
  org,
  environment,
  role,
}: {
  org: string;
  environment: string;
  role: string;
}) {
  const [tab, setTab] = useState('Overview'),
    [data, setData] = useState<any>(null),
    [issuers, setIssuers] = useState<any[]>([]),
    [issuance, setIssuance] = useState<any[]>([]),
    [sources, setSources] = useState<any[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState<any>(null),
    [selected, setSelected] = useState<string[]>([]),
    [history, setHistory] = useState<any[]>([]),
    [file, setFile] = useState<any>(null);
  const editable = ['owner', 'admin'].includes(role),
    base = '/organizations/' + org + '/trust',
    api = (path: string, method = 'GET', body?: any) =>
      request(base + path, method, body, environment);
  async function load() {
    const result = await api('/passport');
    setData(result);
    if (editable) {
      setIssuers((await api('/issuers')).data);
      setIssuance((await api('/issuance-requests')).data);
    }
    setSources((await api('/sources')).data);
    setHistory((await api('/history')).data);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [org, environment]);
  async function act(fn: () => Promise<any>) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await fn();
      await load();
      setNotice('Saved. Review the source and assurance labels below.');
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const p = data?.passport,
    creds = data?.credentials || [],
    evidence = data?.evidence || [];
  const consent = (
    <Field label="I authorize this specific use of the selected records.">
      <input name="consent" type="checkbox" required />
    </Field>
  );
  const evidencePicker = (
    <fieldset>
      <legend>Evidence to authorize</legend>
      {evidence
        .filter((e: any) => e.status === 'active')
        .map((e: any) => (
          <label className="check-row" key={e.id}>
            <input
              type="checkbox"
              checked={selected.includes(e.id)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, e.id]
                    : selected.filter((id) => id !== e.id),
                )
              }
            />
            {e.source_kind} · Level {e.assurance_level} · {e.id.slice(0, 8)}
          </label>
        ))}
    </fieldset>
  );
  if (!data)
    return (
      <section className="panel">
        <p role="status">Loading Business Passport…</p>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  return (
    <div className="passport-workspace">
      {isDemo() && (
        <p className="muted">
          Browser demo: inspect a real signature over synthetic claims. Current
          issuer status, new issuance and recipient authorization require the
          connected backend.
        </p>
      )}
      <nav className="passport-tabs" aria-label="Business Passport sections">
        {tabs.map((t) => (
          <button
            key={t}
            aria-current={tab === t ? 'page' : undefined}
            onClick={() => {
              setTab(t);
              setReport(null);
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      <details className="panel learning-helper">
        <summary>What do the proof checks mean?</summary>
        <p>
          A signature checks integrity. Current status checks expiry or
          revocation. Issuer recognition and evidence assurance need separate
          review. Choose minimal claims for a named recipient rather than
          sharing the entire profile.
        </p>
        <a href="/learn/business-passport">Learn about Business Passports</a>
      </details>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert" role="status">
          {notice}
        </div>
      )}
      {busy && <p role="status">Saving authorized change…</p>}
      {!p ? (
        <Form
          submit={(d) =>
            act(async () => {
              await api('/passport', 'POST', {
                display_name: d.display_name,
                category: d.category,
                industry: d.industry,
                country: d.country,
                public_profile: false,
              });
              return api('/evidence', 'POST', {
                source_kind: 'profile',
                source_id: org,
                lawful_basis: 'consent',
                purpose:
                  'Build my private business passport from my workspace profile.',
              });
            })
          }
        >
          <h2>Your business identity, with evidence.</h2>
          <p>
            Create a private Passport. You choose what to share; no records are
            published to a blockchain.
          </p>
          <Field label="Business display name">
            <input name="display_name" required minLength={2} defaultValue="" />
          </Field>
          <div className="form-grid">
            <Field label="Category">
              <input name="category" defaultValue="Supplier" required />
            </Field>
            <Field label="Industry">
              <input name="industry" defaultValue="Trade" required />
            </Field>
            <Field label="Country code">
              <input
                name="country"
                defaultValue="KE"
                pattern="[A-Z]{2}"
                required
              />
            </Field>
          </div>
          {consent}
          <button className="button" disabled={!editable}>
            Create private Passport
          </button>
        </Form>
      ) : (
        <>
          {tab === 'Overview' && (
            <>
              <section className="passport-card">
                <span className="eyebrow">
                  AFRICORE BUSINESS PASSPORT · SANDBOX BETA
                </span>
                <div className="passport-card-title">
                  <div>
                    <h2>{p.display_name}</h2>
                    <p>
                      {p.category} · {p.country} · {p.industry}
                    </p>
                  </div>
                  <span className="passport-symbol" aria-hidden="true">
                    A
                  </span>
                </div>
                <p>
                  <Provenance label={p.verification_status} />
                </p>
                <p className="record-id">Passport {p.id}</p>
                <p>
                  Private by default · {creds.length} credentials ·
                  Account-managed identity
                </p>
                {p.public_profile ? (
                  <a href={'/passport/' + p.id}>
                    View minimal public profile <Icon name="right" />
                  </a>
                ) : (
                  <button onClick={() => setTab('Verification Requests')}>
                    Review a sharing request <Icon name="right" />
                  </button>
                )}
              </section>
              <div className="metric-grid">
                {[
                  ['Credentials', creds.length],
                  [
                    'Active grants',
                    data.grants?.filter(
                      (g: any) =>
                        !g.revoked_at &&
                        g.expires_at > new Date().toISOString(),
                    ).length || 0,
                  ],
                  [
                    'Relationships',
                    data.relationships?.filter(
                      (r: any) => r.status === 'confirmed',
                    ).length || 0,
                  ],
                  [
                    'Expiring in 30 days',
                    creds.filter(
                      (c: any) =>
                        Date.parse(c.valid_until) - Date.now() < 30 * 86400000,
                    ).length,
                  ],
                ].map(([label, value]) => (
                  <article className="panel metric-definition" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              <section className="panel">
                <h2>Evidence coverage · {data.index?.value || 0}%</h2>
                <p>
                  {data.index?.purpose ||
                    'Category coverage, not creditworthiness or a trust guarantee.'}
                </p>
                {data.index?.components?.map((c: any) => (
                  <div className="list-row" key={c.category}>
                    <span>
                      {c.category} · {c.weight}% weight
                    </span>
                    <b>
                      {c.covered ? 'Recorded' : 'Not observed'} ·{' '}
                      {c.source_verified_count} source verified
                    </b>
                  </div>
                ))}
                <small>
                  Method {data.index?.methodology} · Missing information is not
                  evidence of wrongdoing.
                </small>
              </section>
              <section className="panel">
                <h2>What each assurance level means</h2>
                <p>
                  0 Self-reported · 1 Document reviewed · 2 Source verified · 3
                  Independently corroborated.
                </p>
                <p>
                  Only levels supported by the recorded review method are
                  assigned. Sandbox APIs do not create source-verified business
                  history.
                </p>
              </section>
            </>
          )}
          {tab === 'Business Identity' && (
            <>
              <section className="panel">
                <h2>Business identity review</h2>
                <p>
                  Current: {p.verification_status.replaceAll('_', ' ')}. A
                  manual document review does not establish government registry
                  verification or independent representative authority.
                </p>
                {data.identity_reviews?.map((r: any) => (
                  <article key={r.id}>
                    <p>
                      {r.status} · Review {r.id}
                    </p>
                    <Timeline items={r.history} />
                  </article>
                ))}
              </section>
              {editable && (
                <>
                  <Form
                    submit={(d) =>
                      act(() =>
                        api('/identity-reviews', 'POST', {
                          legal_name: d.legal_name,
                          jurisdiction: d.jurisdiction,
                          registration_number: d.registration_number,
                          representative_statement: d.representative_statement,
                          evidence_ids: selected,
                          consent: true,
                        }),
                      )
                    }
                  >
                    <h3>Submit identity information</h3>
                    <Field label="Legal business name">
                      <input name="legal_name" required />
                    </Field>
                    <div className="form-grid">
                      <Field label="Jurisdiction">
                        <input
                          name="jurisdiction"
                          defaultValue="Kenya"
                          required
                        />
                      </Field>
                      <Field label="Registration reference">
                        <input name="registration_number" required />
                      </Field>
                    </div>
                    <Field label="Authority to represent the business">
                      <textarea
                        name="representative_statement"
                        minLength={10}
                        required
                      />
                    </Field>
                    {evidencePicker}
                    {consent}
                    <button className="button">Submit for review</button>
                  </Form>
                  <Form
                    submit={(d) =>
                      act(() =>
                        api('/documents', 'POST', {
                          review_id: d.review_id,
                          ...file,
                        }),
                      )
                    }
                  >
                    <h3>Attach a supporting document</h3>
                    <Field label="Pending review ID">
                      <input name="review_id" required />
                    </Field>
                    <Field label="TXT, PDF, PNG or JPEG · up to 250 KB">
                      <input
                        type="file"
                        accept=".txt,.pdf,.png,.jpg,.jpeg"
                        required
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 250000) {
                            setError('Maximum 250 KB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            setFile({
                              filename: f.name,
                              content_type: f.type || 'text/plain',
                              content_base64: String(reader.result).split(
                                ',',
                              )[1],
                            });
                          reader.readAsDataURL(f);
                        }}
                      />
                    </Field>
                    <button className="secondary-button">
                      Upload privately
                    </button>
                  </Form>
                </>
              )}
            </>
          )}
          {tab === 'Credentials' && (
            <>
              <section className="panel">
                <h2>Minimal claims. Inspectable signatures.</h2>
                <p>
                  Credentials distinguish issuer authority, evidence level,
                  expiry, status and technical integrity. Entire minimal signed
                  credentials are disclosed when shared; cryptographic selective
                  disclosure is not enabled.
                </p>
                {creds.length ? (
                  creds.map((c: any) => (
                    <article className="credential-card" key={c.id}>
                      <div>
                        <Provenance label={c.status} />
                        <h3>
                          {c.type
                            .replace(/Credential$/, '')
                            .replace(/([A-Z])/g, ' $1')
                            .trim()}
                        </h3>
                        <p className="record-id">{c.id}</p>
                        <p>
                          Issuer {c.issuer_id} · Valid until{' '}
                          {new Date(c.valid_until).toLocaleDateString()}
                        </p>
                        <details>
                          <summary>Inspect exactly what may be shared</summary>
                          <pre>{JSON.stringify(c.claims, null, 2)}</pre>
                        </details>
                      </div>
                      <div className="row-actions">
                        <button
                          onClick={() =>
                            act(async () => {
                              setReport(
                                await api('/verify', 'POST', {
                                  credential_id: c.id,
                                  verify_anchor: true,
                                }),
                              );
                            })
                          }
                        >
                          Verify now
                        </button>
                        <button
                          onClick={() =>
                            act(async () =>
                              download(
                                await api('/credentials/' + c.id + '/export'),
                                'africore-credential-' + c.id + '.json',
                              ),
                            )
                          }
                        >
                          Export verification bundle
                        </button>
                        <button
                          onClick={() =>
                            act(async () =>
                              setReport(
                                await api('/credentials/' + c.id + '/proof'),
                              ),
                            )
                          }
                        >
                          Check anchor
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p>
                    No credentials yet. Request one from an approved sandbox
                    issuer after choosing evidence.
                  </p>
                )}
              </section>
              {editable && (
                <Form
                  submit={(d) =>
                    act(() =>
                      api('/issuance-requests', 'POST', {
                        issuer_id: d.issuer_id,
                        holder_org: org,
                        type: d.type,
                        evidence_ids: selected,
                        valid_days: Number(d.valid_days),
                        consent: true,
                      }),
                    )
                  }
                >
                  <h3>Authorize an issuer request</h3>
                  <Field label="Approved issuer ID">
                    <input name="issuer_id" required />
                  </Field>
                  <Field label="Credential type">
                    <select name="type">
                      {trustTypes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Validity in days">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      defaultValue={90}
                      name="valid_days"
                      required
                    />
                  </Field>
                  {evidencePicker}
                  {consent}
                  <button className="button">
                    Authorize selected evidence
                  </button>
                </Form>
              )}
            </>
          )}
          {tab === 'Trust Evidence' && (
            <>
              <section className="panel">
                <h2>Source and assurance stay visible</h2>
                {evidence.map((e: any) => (
                  <article className="evidence-record" key={e.id}>
                    <h3>
                      {e.source_kind} · Level {e.assurance_level}
                    </h3>
                    <p>
                      {e.status} · {e.method}
                    </p>
                    <p>{e.limitations}</p>
                    <small>
                      Source {e.source_id} · Evidence {e.id}
                    </small>
                  </article>
                ))}
              </section>
              {editable && (
                <>
                  <Form
                    submit={(d) => {
                      const source = sources.find((s) => s.key === d.source);
                      if (!source) throw Error('Choose a source');
                      return act(() =>
                        api('/evidence', 'POST', {
                          source_kind: source.kind,
                          source_id: source.id,
                          lawful_basis: d.lawful_basis,
                          purpose: d.purpose,
                        }),
                      );
                    }}
                  >
                    <h3>Reference an existing business record</h3>
                    <Field label="Source record">
                      <select name="source" required>
                        <option value="">Choose source</option>
                        {sources.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.kind} · {s.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Processing basis">
                      <select name="lawful_basis">
                        <option value="consent">Consent</option>
                        <option value="contract">Contract</option>
                        <option value="legitimate_interests">
                          Legitimate interests (assess first)
                        </option>
                      </select>
                    </Field>
                    <Field label="Specific purpose">
                      <input name="purpose" minLength={10} required />
                    </Field>
                    <button className="button">
                      Reference source evidence
                    </button>
                  </Form>
                  <Form
                    submit={(d) => act(() => api('/corrections', 'POST', d))}
                  >
                    <h3>Challenge an inaccurate record</h3>
                    <Field label="Evidence or credential ID">
                      <input name="resource_id" required />
                    </Field>
                    <Field label="Resource type">
                      <select name="kind">
                        <option value="evidence">Evidence</option>
                        <option value="credential">Credential</option>
                      </select>
                    </Field>
                    <Field label="Reason">
                      <textarea name="reason" minLength={10} required />
                    </Field>
                    <Field label="Supporting statement">
                      <textarea name="supporting_statement" />
                    </Field>
                    <button className="secondary-button">
                      Request correction
                    </button>
                  </Form>
                </>
              )}
              {data.disputes?.map((r: any) => (
                <article className="panel" key={r.id}>
                  <h3>Correction · {r.status}</h3>
                  <p>{r.reason}</p>
                  <Timeline items={r.history} />
                </article>
              ))}
            </>
          )}
          {tab === 'Business Network' && (
            <>
              <section className="panel">
                <h2>Confirmed commercial relationships</h2>
                <p>
                  Counterparty authentication is not proof of independence. No
                  automatic endorsements, credit ratings or universal trust
                  score.
                </p>
                {data.relationships?.map((r: any) => (
                  <article className="commerce-row" key={r.id}>
                    <div>
                      <h3>
                        {r.relationship} · {r.status}
                      </h3>
                      <p>{r.statement}</p>
                      <p className="record-id">
                        {r.org_id} ↔ {r.peer_org}
                      </p>
                    </div>
                    {editable &&
                      r.peer_org === org &&
                      r.status === 'pending' && (
                        <Form
                          submit={(d) =>
                            act(() =>
                              api(
                                '/relationships/' + r.id + '/respond',
                                'POST',
                                d,
                              ),
                            )
                          }
                        >
                          <select name="decision">
                            <option value="confirm">Confirm</option>
                            <option value="reject">Reject</option>
                          </select>
                          <input
                            name="statement"
                            placeholder="Reason / statement"
                            minLength={10}
                            required
                          />
                          <button>Respond as counterparty</button>
                        </Form>
                      )}
                    {editable && r.status === 'confirmed' && (
                      <button
                        onClick={() =>
                          act(() =>
                            api('/relationships/' + r.id + '/respond', 'POST', {
                              decision: 'revoke',
                              statement:
                                'Relationship revoked by an authorized business member.',
                            }),
                          )
                        }
                      >
                        Revoke relationship
                      </button>
                    )}
                  </article>
                ))}
              </section>
              {editable && (
                <Form
                  submit={(d) =>
                    act(() =>
                      api('/relationships', 'POST', { ...d, consent: true }),
                    )
                  }
                >
                  <h3>Request counterparty confirmation</h3>
                  <Field label="Counterparty organization ID">
                    <input name="counterparty_org" required />
                  </Field>
                  <Field label="Relationship">
                    <select name="relationship">
                      {[
                        'supplier',
                        'customer',
                        'logistics',
                        'commercial_partner',
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Relationship statement">
                    <textarea name="statement" minLength={10} required />
                  </Field>
                  {consent}
                  <button className="button">Request confirmation</button>
                </Form>
              )}
            </>
          )}
          {tab === 'Verification Requests' && (
            <>
              <section className="panel">
                <h2>Review before disclosure</h2>
                {data.requests?.map((r: any) => (
                  <article className="credential-card" key={r.id}>
                    <h3>
                      {r.status} · {r.purpose}
                    </h3>
                    <p>
                      Requester {r.org_id} · Holder {r.peer_org}
                    </p>
                    <p>
                      {r.types.join(', ')} · Expires{' '}
                      {new Date(r.expires_at).toLocaleString()}
                    </p>
                    <p className="record-id">Request {r.id}</p>
                    {r.peer_org === org && r.status === 'pending' && (
                      <>
                        <button onClick={() => setTab('Shared Access')}>
                          Choose credentials & create grant
                        </button>
                        <button
                          onClick={() =>
                            act(() =>
                              api('/requests/' + r.id + '/reject', 'POST', {}),
                            )
                          }
                        >
                          Reject request
                        </button>
                      </>
                    )}
                  </article>
                ))}
              </section>
              {editable && (
                <Form
                  submit={(d) =>
                    act(() =>
                      api('/requests', 'POST', {
                        holder_org: d.holder_org,
                        types: [d.type],
                        purpose: d.purpose,
                        expires_days: Number(d.expires_days),
                      }),
                    )
                  }
                >
                  <h3>Request evidence from another business</h3>
                  <Field label="Holder organization ID">
                    <input name="holder_org" required />
                  </Field>
                  <Field label="Required credential">
                    <select name="type">
                      {trustTypes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Purpose">
                    <input name="purpose" minLength={10} required />
                  </Field>
                  <Field label="Expires in days">
                    <input
                      name="expires_days"
                      type="number"
                      min={1}
                      max={30}
                      defaultValue={7}
                    />
                  </Field>
                  <button className="button">Send verification request</button>
                </Form>
              )}
            </>
          )}
          {tab === 'Shared Access' && (
            <>
              <section className="panel">
                <h2>Named recipients. Limited access.</h2>
                <p>
                  Future access can be revoked. Copies already disclosed cannot
                  be erased remotely.
                </p>
                {data.grants?.map((g: any) => (
                  <article className="commerce-row" key={g.id}>
                    <div>
                      <h3>
                        {g.revoked_at
                          ? 'Revoked'
                          : g.consumed_at
                            ? 'Accessed'
                            : g.expires_at < new Date().toISOString()
                              ? 'Expired'
                              : 'Active'}{' '}
                        grant
                      </h3>
                      <p>Recipient {g.recipient_org}</p>
                      <small>
                        {g.id} · Expires{' '}
                        {new Date(g.expires_at).toLocaleString()}
                      </small>
                    </div>
                    {editable && !g.revoked_at && (
                      <button
                        onClick={() =>
                          act(() =>
                            api('/grants/' + g.id + '/revoke', 'POST', {}),
                          )
                        }
                      >
                        Revoke future access
                      </button>
                    )}
                  </article>
                ))}
              </section>
              {editable && (
                <Form
                  submit={async (d) => {
                    const result = await act(() =>
                      api('/grants', 'POST', {
                        recipient_org: d.recipient_org,
                        credential_ids: creds
                          .filter((c: any) => d['credential_' + c.id] === 'on')
                          .map((c: any) => c.id),
                        purpose: d.purpose,
                        expires_hours: Number(d.expires_hours),
                        one_time: d.one_time === 'on',
                        ...(d.request_id ? { request_id: d.request_id } : {}),
                        consent: true,
                      }),
                    );
                    if (result?.url)
                      setNotice(
                        'Save this recipient-bound link now: ' +
                          location.origin +
                          result.url,
                      );
                  }}
                >
                  <h3>Authorize a minimal presentation</h3>
                  <Field label="Named recipient organization ID">
                    <input name="recipient_org" required />
                  </Field>
                  <Field label="Verification request ID (optional)">
                    <input name="request_id" />
                  </Field>
                  <Field label="Purpose (must match a linked request)">
                    <input name="purpose" minLength={10} required />
                  </Field>
                  <Field label="Expires in hours">
                    <input
                      name="expires_hours"
                      type="number"
                      min={1}
                      max={720}
                      defaultValue={168}
                    />
                  </Field>
                  <Field label="One-time access">
                    <input name="one_time" type="checkbox" defaultChecked />
                  </Field>
                  <fieldset>
                    <legend>Exactly these credentials will be disclosed</legend>
                    {creds
                      .filter((c: any) => c.status === 'active')
                      .map((c: any) => (
                        <label className="check-row" key={c.id}>
                          <input type="checkbox" name={'credential_' + c.id} />
                          {c.type} · {c.id.slice(0, 8)}
                        </label>
                      ))}
                  </fieldset>
                  {consent}
                  <button className="button">
                    Create recipient-bound grant
                  </button>
                </Form>
              )}
            </>
          )}
          {tab === 'Activity History' && (
            <section className="panel">
              <h2>Trust activity</h2>
              {history.map((h: any) => (
                <div className="list-row" key={h.id}>
                  <span>{h.action}</span>
                  <small>
                    {h.created_at} · {h.resource_id}
                  </small>
                </div>
              ))}
            </section>
          )}
          {tab === 'Privacy & Security' && (
            <section className="panel">
              <h2>Your disclosure choices</h2>
              <p>
                Private financial documents and credential contents stay
                off-chain. Only randomized batch roots are eligible for
                anchoring. Secure links require the named recipient's
                authenticated membership.
              </p>
              <p>
                Managed custody: the backend holds encrypted disposable sandbox
                signing keys. Production signing is disabled until managed key
                infrastructure and governance are reviewed.
              </p>
              <p>
                Public profile currently{' '}
                {p.public_profile ? 'enabled' : 'disabled'}. Public fields:
                display name, category, industry, country, reference and review
                status only.
              </p>
              {editable && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    act(() =>
                      api('/passport', 'PATCH', {
                        public_profile: !p.public_profile,
                      }),
                    )
                  }
                >
                  {p.public_profile ? 'Disable' : 'Enable'} minimal public
                  profile
                </button>
              )}
              <p>
                Do not upload real identity documents into this demo. Retention
                windows do not replace an approved deletion/legal-hold process.
              </p>
            </section>
          )}
          {tab === 'Issuer Desk' && (
            <>
              <section className="panel">
                <h2>Issuer authority is separately approved</h2>
                <p>
                  An account does not confer institutional authority. Sandbox
                  approval permits labeled test assertions only.
                </p>
                {issuers.map((i) => (
                  <article className="credential-card" key={i.id}>
                    <h3>
                      {i.name} · {i.status}
                    </h3>
                    <p className="record-id">{i.id}</p>
                    <p>{i.authority}</p>
                    {editable && i.status === 'approved_sandbox' && (
                      <Form
                        submit={(d) =>
                          act(() =>
                            api('/issuers/' + i.id + '/rotate', 'POST', {
                              compromise: d.compromise === 'on',
                              reason: d.reason,
                            }),
                          )
                        }
                      >
                        <input
                          name="reason"
                          minLength={10}
                          required
                          placeholder="Rotation reason"
                        />
                        <Field label="Treat prior active key as compromised and revoke its credentials">
                          <input name="compromise" type="checkbox" />
                        </Field>
                        <button>Rotate sandbox key</button>
                      </Form>
                    )}
                  </article>
                ))}
              </section>
              {editable && (
                <Form
                  submit={(d) =>
                    act(() =>
                      api('/issuers', 'POST', {
                        name: d.name,
                        types: [d.type],
                        statement: d.statement,
                      }),
                    )
                  }
                >
                  <h3>Apply as a sandbox issuer</h3>
                  <Field label="Issuer display name">
                    <input name="name" required />
                  </Field>
                  <Field label="Credential type authority requested">
                    <select name="type">
                      {trustTypes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Authority and sandbox purpose">
                    <textarea name="statement" required minLength={10} />
                  </Field>
                  <button className="button">Submit for operator review</button>
                </Form>
              )}
              <section className="panel">
                <h3>Holder-authorized issuance requests</h3>
                {issuance.map((r) => (
                  <article className="credential-card" key={r.id}>
                    <h3>
                      {r.type} · {r.status}
                    </h3>
                    <p>
                      Holder {r.org_id} · {r.evidence?.length || 0} authorized
                      evidence references
                    </p>
                    <p className="record-id">{r.id}</p>
                    {r.peer_org === org && r.status === 'pending' && (
                      <button
                        onClick={() =>
                          act(() =>
                            api('/credentials', 'POST', { request_id: r.id }),
                          )
                        }
                      >
                        Review & issue sandbox credential
                      </button>
                    )}
                  </article>
                ))}
              </section>
              <Form
                submit={(d) =>
                  act(() =>
                    api('/credentials/' + d.credential_id + '/status', 'POST', {
                      status: d.status,
                      reason: d.reason,
                    }),
                  )
                }
              >
                <h3>Issuer status action</h3>
                <Field label="Credential issued by your organization">
                  <input name="credential_id" required />
                </Field>
                <Field label="Status">
                  <select name="status">
                    <option value="suspended">Suspend</option>
                    <option value="revoked">Permanently revoke</option>
                    <option value="active">Resume suspended credential</option>
                  </select>
                </Field>
                <Field label="Reason">
                  <textarea name="reason" minLength={10} required />
                </Field>
                <button className="secondary-button">
                  Record authorized status change
                </button>
              </Form>
            </>
          )}
          {tab === 'Trust Operations' && (
            <section className="panel">
              <h2>Restricted trust operations</h2>
              <p>Issuer reviews and platform-wide trust operations require a separately authorized internal channel. They are unavailable through the public workspace. Business ownership does not grant operator access.</p>
            </section>
          )}
          {report && <VerificationReport report={report} />}
        </>
      )}
    </div>
  );
}
