import { useEffect, useState } from 'react';
import { Field, Form, Provenance, Timeline, money, request } from './UI';
export function BuyerPortal() {
  const token = location.pathname.split('/').pop() || '',
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [file, setFile] = useState<any>(null);
  const api = (suffix: string, method = 'GET', body?: unknown) =>
    request('/buyer/' + token + suffix, method, body);
  const load = () =>
    api('')
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function action(fn: () => Promise<any>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      setNotice('Sandbox workflow updated. No real funds moved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="buyer-portal">
      <header>
        <a className="logo" href="/">
          AfriCore<span className="logo-period">.</span>
        </a>
        <Provenance label="sandbox_protected_sale" />
      </header>
      <main>
        <div className="alert">
          Evaluation only. No real payment, funds custody or production
          buyer-protection promise.
        </div>
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
        {!data ? (
          <div className="skeleton">Loading secure purchase link…</div>
        ) : (
          <>
            <section className="panel buyer-summary">
              <span className="eyebrow">PURCHASE FROM {data.merchant}</span>
              <h1>{data.title}</h1>
              <p>{data.description}</p>
              <strong className="buyer-amount">
                {money(data.amount_minor, data.currency)}
              </strong>
              <p>Merchant verification: {data.merchant_verification}</p>
              <Provenance label={data.state} />
              <div className="buyer-terms">
                <div>
                  <h3>Payment & custody</h3>
                  <p>{data.provider}</p>
                  <p>{data.custody}</p>
                  <p>Fee: {money(0, data.currency)}</p>
                </div>
                <div>
                  <h3>Delivery & inspection</h3>
                  <p>{data.delivery_terms}</p>
                  <p>
                    {data.inspection_hours}-hour inspection after receipt
                    confirmation.
                  </p>
                </div>
                <div>
                  <h3>Cancellation & disputes</h3>
                  <p>{data.cancellation_terms}</p>
                  <p>{data.refund_terms}</p>
                  <p>Merchant support: {data.support_contact}</p>
                </div>
              </div>
              <div className="actions">
                {data.state === 'awaiting_buyer_payment' && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      action(() => api('/action', 'POST', { action: 'pay' }))
                    }
                  >
                    Simulate buyer payment
                  </button>
                )}
                {data.state === 'shipped' && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      action(() =>
                        api('/action', 'POST', { action: 'confirm_receipt' }),
                      )
                    }
                  >
                    Confirm receipt in sandbox
                  </button>
                )}
                {data.state === 'inspection_period' && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      action(() => api('/action', 'POST', { action: 'accept' }))
                    }
                  >
                    Accept purchase
                  </button>
                )}
                {data.state === 'awaiting_buyer_payment' && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() =>
                      action(() => api('/action', 'POST', { action: 'cancel' }))
                    }
                  >
                    Cancel unpaid sale
                  </button>
                )}
              </div>
            </section>
            <section className="panel">
              <h2>Delivery tracking</h2>
              {data.shipments.length ? (
                data.shipments.map((s: any) => (
                  <div className="list-row" key={s.id}>
                    <div>
                      <b>{s.tracking_reference}</b>
                      <p>
                        {s.courier} · {s.status.replaceAll('_', ' ')}
                      </p>
                      <Provenance label={s.delivery_assurance} />
                    </div>
                    <span>{s.estimated_delivery}</span>
                  </div>
                ))
              ) : (
                <p>No shipment recorded yet.</p>
              )}
            </section>
            {[
              'awaiting_shipment',
              'shipped',
              'inspection_period',
              'accepted',
            ].includes(data.state) && (
              <Form submit={(d) => action(() => api('/disputes', 'POST', d))}>
                <h2>Raise a dispute</h2>
                <p>
                  A complaint creates a review record, never an automatic
                  refund.
                </p>
                <Field label="Reason">
                  <select name="reason">
                    {[
                      'not_delivered',
                      'incorrect_item',
                      'damaged_item',
                      'missing_items',
                      'delivery_disagreement',
                      'payment_discrepancy',
                      'contract_issue',
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Your statement">
                  <textarea
                    name="statement"
                    required
                    minLength={10}
                    maxLength={3000}
                  />
                </Field>
                <button className="secondary-button">Open dispute</button>
              </Form>
            )}
            {data.disputes.map((d: any) => (
              <section className="panel" key={d.id}>
                <h2>{d.reason.replaceAll('_', ' ')}</h2>
                <p>
                  {d.status}
                  {d.decision ? ' · Reviewed decision: ' + d.decision : ''}
                </p>
                <Timeline items={d.history} />
                {d.status !== 'resolved' && (
                  <Form
                    className="compact-form"
                    submit={(input) =>
                      action(() =>
                        api('/disputes/' + d.id + '/evidence', 'POST', {
                          statement: input.statement,
                          ...(file || {}),
                        }),
                      )
                    }
                  >
                    <Field label="Additional evidence">
                      <textarea name="statement" required minLength={5} />
                    </Field>
                    <Field label="Optional file (250 KB max)">
                      <input
                        type="file"
                        accept=".txt,.png,.jpg,.jpeg,.pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 250000) {
                            setError('Use a file up to 250 KB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            setFile({
                              filename: f.name,
                              content_type: f.type,
                              content_base64: String(reader.result).split(
                                ',',
                              )[1],
                            });
                          reader.readAsDataURL(f);
                        }}
                      />
                    </Field>
                    <button className="secondary-button">
                      Append evidence
                    </button>
                  </Form>
                )}
              </section>
            ))}
            <section className="panel">
              <h2>Purchase timeline</h2>
              <Timeline items={data.history} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
