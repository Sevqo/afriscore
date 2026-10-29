import { InteractiveChart, financialSeries } from '../charts/InteractiveChart';
import { api } from '../lib/api-client';
import { useState, type FormEvent, type ReactNode } from 'react';
export type API = (
  suffix: string,
  method?: string,
  body?: unknown,
  headers?:Record<string,string>,
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
  const data = points.map((p) => ({
    date: p.date,
    inflows: Number(p.confirmed_inflows_minor ?? p.inflow_minor ?? 0),
    outflows: Number(p.recorded_outflows_minor ?? p.outflow_minor ?? 0),
    net: forecast
      ? Number(p.cumulative_net_movement_minor)
      : Number(p.confirmed_inflows_minor || 0) -
        Number(p.recorded_outflows_minor || 0),
  }));
  return (
    <InteractiveChart
      compact
      headingLevel={3}
      title={forecast ? 'Projected net movement' : 'Money in and money out'}
      points={data}
      series={
        forecast
          ? [{ key: 'net', label: 'Projected net movement', color: '#426900' }]
          : financialSeries
      }
      currency={currency}
      forecast={forecast}
      description={
        forecast
          ? 'Scenario estimate, not a guaranteed receipt or bank balance.'
          : 'Provider-confirmed inflows and recorded outflows. Missing records affect this view; this is not a bank balance or profit.'
      }
    />
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
  headers?:Record<string,string>,
) {
  return api('/api/v1'+path,method,body,environment,method==='POST'?{'Idempotency-Key':crypto.randomUUID(),...headers}:headers);

}
