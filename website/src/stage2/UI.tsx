import { DataTable } from '../components/DataTable';
import { transport } from '../demo/transport';
import { useState, type FormEvent, type ReactNode } from 'react';
export type API = (
  suffix: string,
  method?: string,
  body?: unknown,
) => Promise<any>;
export type Action = (fn: () => Promise<any>, message?: string) => Promise<any>;
export const factor = (currency: string) =>
  ['UGX', 'RWF'].includes(currency) ? 1 : 100;
export const money = (n: number, currency: string) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(
    n / factor(currency),
  );
export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Provenance({ label }: { label: string }) {
  return <span className="badge provenance">{label.replaceAll('_', ' ')}</span>;
}
export function MetricDefinition({
  label,
  value,
  definition,
}: {
  label: string;
  value: string;
  definition: string;
}) {
  return (
    <article className="panel metric-definition">
      <span>{label}</span>
      <strong>{value}</strong>
      <details>
        <summary>Source & meaning</summary>
        <p>{definition}</p>
      </details>
    </article>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <h3>Ready when you are.</h3>
      <p>{text}</p>
    </div>
  );
}
export function Form({
  children,
  submit,
  className = 'panel',
}: {
  children: ReactNode;
  submit: (data: any) => Promise<any>;
  className?: string;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submit(Object.fromEntries(new FormData(e.currentTarget)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={className} onSubmit={onSubmit}>
      <fieldset disabled={busy} className="form-fieldset">
        {children}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
      </fieldset>
    </form>
  );
}
export function Trend({
  points,
  forecast = false,
  currency,
}: {
  points: any[];
  forecast?: boolean;
  currency: string;
}) {
  const values = points.map((p) =>
      forecast
        ? p.cumulative_net_movement_minor
        : p.confirmed_inflows_minor - p.recorded_outflows_minor,
    ),
    max = Math.max(1, ...values.map((v) => Math.abs(v))),
    poly = values
      .map(
        (v, i) =>
          `${40 + (i / Math.max(1, values.length - 1)) * 720},${130 - (v / max) * 95}`,
      )
      .join(' ');
  return (
    <div className="trend-chart">
      <svg
        viewBox="0 0 800 270"
        role="img"
        aria-label={
          forecast
            ? 'Estimated net movement, not a bank balance'
            : 'Recorded net movement over selected dates'
        }
      >
        <line
          x1="40"
          y1="130"
          x2="760"
          y2="130"
          stroke="var(--line)"
          strokeDasharray="4 4"
        />
        <polyline
          points={poly}
          fill="none"
          stroke="var(--accent-text)"
          strokeWidth="3"
        />
        {points.length > 0 && (
          <>
            <text x="40" y="250">
              {points[0].date}
            </text>
            <text x="640" y="250">
              {points.at(-1).date}
            </text>
          </>
        )}
      </svg>
      <p>
        {forecast ? 'Forecast estimate' : 'Recorded movement'} · {currency} ·
        Source coverage applies.
      </p>
      <details>
        <summary>Accessible data table</summary>
        <div className="table-scroll">
          <DataTable>
            <thead>
              <tr>
                <th>Date</th>
                <th>Net movement</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>{money(values[i], currency)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </details>
    </div>
  );
}
export function Timeline({ items }: { items: any[] }) {
  return (
    <ol className="event-timeline">
      {items?.map((h, i) => (
        <li key={i}>
          <b>{(h.state || h.status).replaceAll('_', ' ')}</b>
          <Provenance label={h.source || h.party || 'review_record'} />
          <p>{h.statement || h.reason || h.note || ''}</p>
          <small>
            {new Date(h.at).toLocaleString('en-KE', {
              timeZone: 'Africa/Nairobi',
            })}
          </small>
        </li>
      ))}
    </ol>
  );
}
export async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  environment = 'sandbox',
) {
  const r = await transport('/api/v1' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Environment': environment,
      ...(method === 'POST' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      data.message ||
        data.issues?.map((i: any) => i.message).join(', ') ||
        data.error ||
        'Request failed',
    );
  return data;
}
