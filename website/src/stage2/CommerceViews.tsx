import { Overlay } from '../components/Overlay';
import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import {
  Field,
  Form,
  Provenance,
  Empty,
  Timeline,
  money,
  factor,
  type API,
  type Action,
} from './UI';
export function FulfillmentView({
  data,
  secondary,
  api,
  action,
  onDetail,
}: {
  data: any;
  secondary: any;
  api: API;
  action: Action;
  onDetail: (record: any) => void;
}) {
  const [selectedOrder, setSelectedOrder] = useState('');
  const selected = secondary.orders?.find((o: any) => o.id === selectedOrder);
  return (
    <>
      <Form
        submit={(d) =>
          action(
            () =>
              api('/shipments', 'POST', {
                order_id: d.order_id,
                courier: d.courier,
                tracking_reference: d.tracking_reference,
                estimated_delivery: d.estimated_delivery,
                items: (selected?.items || [])
                  .map((_: any, index: number) => ({
                    item_index: index,
                    quantity: Number(d['quantity_' + index]),
                  }))
                  .filter((i: any) => i.quantity > 0),
                ...(d.protected_sale_id
                  ? { protected_sale_id: d.protected_sale_id }
                  : {}),
              }),
            'Shipment created with seller-reported provenance.',
          )
        }
      >
        <h2>Create shipment</h2>
        <div className="form-grid">
          <Field label="Order">
            <select
              name="order_id"
              required
              value={selectedOrder}
              onChange={(e) => setSelectedOrder(e.target.value)}
            >
              <option value="">Choose order</option>
              {secondary.orders?.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.reference} · {o.items.length} line items
                </option>
              ))}
            </select>
          </Field>
          <Field label="Courier">
            <select name="courier">
              <option value="manual">Manual tracking</option>
              <option value="sandbox_courier">Sandbox courier</option>
            </select>
          </Field>
          <Field label="Tracking reference">
            <input name="tracking_reference" required minLength={2} />
          </Field>
          <Field label="Estimated delivery">
            <input name="estimated_delivery" type="date" required />
          </Field>
          <Field label="Protected sale ID (optional)">
            <input name="protected_sale_id" />
          </Field>
        </div>
        <div className="form-grid">
          {selected?.items.map((item: any, index: number) => (
            <Field
              key={index}
              label={item.description + ' · ordered ' + item.quantity}
            >
              <input
                name={'quantity_' + index}
                type="number"
                min={0}
                max={item.quantity}
                defaultValue={0}
                required
              />
            </Field>
          ))}
        </div>
        <p>
          Enter quantities in this shipment. Previously shipped quantities are
          validated when saving.
        </p>
        <button className="button">Create shipment</button>
      </Form>
      <section className="panel">
        <h2>Shipments & delivery evidence</h2>
        {data?.data?.length ? (
          data.data.map((s: any) => (
            <article className="commerce-row" key={s.id}>
              <div>
                <h3>{s.tracking_reference}</h3>
                <p>
                  {s.courier} · {s.status.replaceAll('_', ' ')}
                </p>
                <Provenance label={s.delivery_assurance} />
                <p className="record-id">Shipment: {s.id}</p>
              </div>
              <div className="row-actions">
                <button onClick={() => onDetail(s)}>History & evidence</button>
                <Form
                  className="compact-form"
                  submit={(d) =>
                    action(() =>
                      api('/shipments/' + s.id + '/transition', 'POST', d),
                    )
                  }
                >
                  <select name="status">
                    {[
                      'processing',
                      'ready_for_dispatch',
                      'shipped',
                      'out_for_delivery',
                      'delivered',
                      'delivery_exception',
                      'returned',
                      'cancelled',
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <button>Record milestone</button>
                </Form>
              </div>
            </article>
          ))
        ) : (
          <Empty text="Fulfillment is separate from payment. Seller reports are explicitly labeled." />
        )}
      </section>
    </>
  );
}
export function ProtectedView({
  data,
  api,
  action,
  onDetail,
  setNotice,
}: {
  data: any;
  api: API;
  action: Action;
  onDetail: (record: any) => void;
  setNotice: (text: string) => void;
}) {
  return (
    <>
      <div className="alert">
        Sandbox partner orchestration. No real funds, wallet, custody or live
        escrow. Release and dispute decisions require a second authorized
        reviewer.
      </div>
      <Form
        submit={async (d) => {
          const r = await action(() =>
            api('/protected-sales', 'POST', {
              title: d.title,
              description: d.description,
              amount_minor: Math.round(Number(d.amount) * factor(d.currency)),
              currency: d.currency,
              delivery_terms: d.delivery_terms,
              inspection_hours: Number(d.inspection_hours),
              cancellation_terms: d.cancellation_terms,
              support_contact: d.support_contact,
              ...(d.order_id ? { order_id: d.order_id } : {}),
            }),
          );
          if (r?.buyer_url)
            setNotice(
              'Save the buyer link now: ' + location.origin + r.buyer_url,
            );
        }}
      >
        <h2>Create a protected sale</h2>
        <div className="form-grid">
          <Field label="Product / sale title">
            <input name="title" required minLength={2} />
          </Field>
          <Field label="Amount">
            <input
              name="amount"
              type="number"
              min={0.01}
              step={0.01}
              required
            />
          </Field>
          <Field label="Currency">
            <select name="currency">
              {['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'RWF'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Order ID (optional)">
            <input name="order_id" />
          </Field>
          <Field label="Inspection period (hours)">
            <input
              name="inspection_hours"
              type="number"
              min={1}
              max={168}
              defaultValue={48}
            />
          </Field>
          <Field label="Merchant support contact">
            <input name="support_contact" required minLength={5} />
          </Field>
        </div>
        <Field label="Purchase description">
          <textarea name="description" />
        </Field>
        <Field label="Delivery terms">
          <textarea name="delivery_terms" required minLength={10} />
        </Field>
        <Field label="Cancellation & refund terms">
          <textarea name="cancellation_terms" required minLength={10} />
        </Field>
        <button className="button">Create sandbox sale</button>
      </Form>
      <section className="panel">
        <h2>Protected sales</h2>
        {data?.data?.length ? (
          data.data.map((s: any) => (
            <article className="commerce-row" key={s.id}>
              <div>
                <h3>
                  <button className="text-button" onClick={() => onDetail(s)}>
                    {s.title}
                  </button>
                </h3>
                <p>
                  {money(s.amount_minor, s.currency)} ·{' '}
                  {s.state.replaceAll('_', ' ')}
                </p>
                <p className="record-id">Sale: {s.id}</p>
                <p className="record-id">Order for shipment: {s.order_id}</p>
                <Provenance label="sandbox_partner" />
              </div>
              <div className="row-actions">
                {s.state === 'accepted' && (
                  <Form
                    className="compact-form"
                    submit={(d) =>
                      action(() =>
                        api('/protected-sales/' + s.id + '/action', 'POST', {
                          action: 'request_release',
                          approval_id: d.approval_id,
                        }),
                      )
                    }
                  >
                    <input
                      name="approval_id"
                      required
                      placeholder="Approved release request ID"
                    />
                    <button>Request release</button>
                  </Form>
                )}
                {['release_requested', 'refund_requested'].includes(
                  s.state,
                ) && (
                  <button
                    onClick={() =>
                      action(
                        () =>
                          api('/protected-sales/' + s.id + '/action', 'POST', {
                            action: 'confirm_partner_settlement',
                          }),
                        'Partner simulator confirmed the outcome. No real funds moved.',
                      )
                    }
                  >
                    Simulate partner settlement
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <Empty text="Create a sale to test payment, shipment, inspection and reviewed settlement." />
        )}
      </section>
    </>
  );
}
export function DisputeView({
  data,
  api,
  action,
  admin,
  onDetail,
}: {
  data: any;
  api: API;
  action: Action;
  admin: boolean;
  onDetail: (record: any) => void;
}) {
  return (
    <section className="panel">
      <h2>Dispute review</h2>
      <p>
        Statements are claims, not proof. Resolution requires a separate
        approver and does not itself confirm settlement.
      </p>
      {data?.data?.length ? (
        data.data.map((d: any) => (
          <article className="dispute-item" key={d.id}>
            <div>
              <h3>{d.reason.replaceAll('_', ' ')}</h3>
              <p>
                {d.status} · {d.id}
              </p>
              <button className="text-button" onClick={() => onDetail(d)}>
                Inspect timeline & evidence <Icon name="right" />
              </button>
            </div>
            {d.status !== 'resolved' && (
              <>
                <Form
                  className="compact-form"
                  submit={(input) =>
                    action(() =>
                      api('/disputes/' + d.id + '/respond', 'POST', input),
                    )
                  }
                >
                  <Field label="Seller response">
                    <textarea name="statement" minLength={5} required />
                  </Field>
                  <button className="secondary-button">Append response</button>
                </Form>
                {admin && (
                  <Form
                    className="compact-form"
                    submit={(input) =>
                      action(() =>
                        api('/disputes/' + d.id + '/resolve', 'POST', input),
                      )
                    }
                  >
                    <Field label="Decision">
                      <select name="decision">
                        <option value="refund">Request partner refund</option>
                        <option value="release">Request partner release</option>
                      </select>
                    </Field>
                    <Field label="Resolution reason">
                      <textarea name="reason" minLength={10} required />
                    </Field>
                    <Field label="Approved dispute-resolution request ID">
                      <input name="approval_id" required />
                    </Field>
                    <button className="button">
                      Record reviewed resolution
                    </button>
                  </Form>
                )}
              </>
            )}
          </article>
        ))
      ) : (
        <Empty text="No disputes. Complaints never cause automatic refunds." />
      )}
    </section>
  );
}
export function RecordDetail({
  record,
  api,
  writable,
  onClose,
}: {
  record: any;
  api: API;
  writable: boolean;
  onClose: () => void;
}) {
  const [evidence, setEvidence] = useState<any[]>([]),
    [error, setError] = useState(''),
    [file, setFile] = useState<any>(null);
  const load = () =>
    api('/evidence/' + record.id)
      .then((r) => setEvidence(r.data))
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (['shipments', 'disputes'].includes(record.kind)) load();
  }, [record.id]);
  return (
    <Overlay onClose={onClose}>
      <section
        className="record-modal panel"
        role="dialog"
        aria-modal="true"
        aria-label="History and evidence"
      >
        <button className="close-modal" onClick={onClose}>
          Close <Icon name="close" />
        </button>
        <h2>{record.title || record.tracking_reference || record.reason}</h2>
        <p className="record-id">{record.id}</p>
        <Timeline items={record.history} />
        {error && <p role="alert">{error}</p>}
        {evidence.map((e) => (
          <article className="evidence-record" key={e.id}>
            <Provenance label={e.assurance} />
            <p>{e.statement}</p>
            <small>
              {e.filename || 'Statement only'} · {e.created_at}
            </small>
          </article>
        ))}
        {writable && record.kind === 'shipments' && (
          <Form
            submit={async (d) => {
              await api('/shipments/' + record.id + '/evidence', 'POST', {
                statement: d.statement,
                ...(file || {}),
              });
              await load();
            }}
          >
            <Field label="Evidence statement">
              <textarea name="statement" required minLength={5} />
            </Field>
            <Field label="Optional evidence file (250 KB max)">
              <input
                type="file"
                accept=".txt,.pdf,.png,.jpg,.jpeg"
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
                      content_base64: String(reader.result).split(',')[1],
                    });
                  reader.readAsDataURL(f);
                }}
              />
            </Field>
            <button className="secondary-button">Append seller evidence</button>
          </Form>
        )}
      </section>
    </Overlay>
  );
}
