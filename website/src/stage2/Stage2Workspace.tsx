import { useEffect, useState } from 'react';
import { IntelligenceView, ForecastView } from './IntelligenceViews';
import { AssistantView } from './AssistantView';
import {
  AutomationView,
  NotificationView,
  ApprovalView,
} from './WorkflowViews';
import {
  FulfillmentView,
  ProtectedView,
  DisputeView,
  RecordDetail,
} from './CommerceViews';
import { ConnectView, RiskView, EngineeringView } from './OtherViews';
import { Provenance, request, type API, type Action } from './UI';
export const stage2Tabs = [
  'Intelligence',
  'Forecasts',
  'Assistant',
  'Automations',
  'Notifications',
  'Approvals',
  'Fulfillment',
  'Protected Payments',
  'Disputes',
  'Connect',
  'Risk Review',
  'Engineering',
];
export function Stage2Workspace({
  section,
  org,
  environment,
  role,
  onNavigate,
}: {
  section: string;
  org: string;
  environment: string;
  role: string;
  onNavigate: (tab: string) => void;
}) {
  const base = '/organizations/' + org,
    [data, setData] = useState<any>(null),
    [secondary, setSecondary] = useState<any>({}),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [currency, setCurrency] = useState('KES'),
    [detail, setDetail] = useState<any>(null),
    [query, setQuery] = useState('');
  const api: API = (suffix, method = 'GET', body) =>
      request(base + suffix, method, body, environment),
    finance = ['owner', 'admin', 'finance'].includes(role),
    operations = ['owner', 'admin', 'finance', 'operations'].includes(role),
    admin = ['owner', 'admin'].includes(role);
  async function load() {
    setError('');
    setBusy(true);
    try {
      if (section === 'Intelligence') {
        setData(await api('/intelligence?currency=' + currency));
        setSecondary({
          expenses: (await api('/expenses')).data,
          obligations: (await api('/obligations')).data,
        });
      } else if (section === 'Forecasts')
        setData(
          await api('/forecasts', 'POST', {
            currency,
            horizon: 30,
            scenario: 'expected',
          }),
        );
      else if (section === 'Automations') {
        setData(await api('/automations'));
        setSecondary({
          templates: (await api('/automations/templates')).data,
          runs: (await api('/automation-runs')).data,
        });
      } else if (section === 'Notifications')
        setData(await api('/notifications'));
      else if (section === 'Approvals') {
        setData(await api('/approvals'));
        setSecondary({ team: (await api('/team')).data });
      } else if (section === 'Fulfillment') {
        setData(await api('/shipments'));
        setSecondary({ orders: (await api('/records/orders?limit=100')).data });
      } else if (section === 'Protected Payments')
        setData(await api('/protected-sales'));
      else if (section === 'Disputes') setData(await api('/disputes'));
      else if (section === 'Connect') {
        setData(await api('/connectors'));
        setSecondary({ catalog: (await api('/connectors/catalog')).data });
      } else if (section === 'Risk Review') setData(await api('/risk-signals'));
      else if (section === 'Engineering') {
        const ops = await request(
            '/internal/stage2/operations',
            'GET',
            undefined,
            environment,
          ),
          docs = await request(
            '/internal/stage2/docs',
            'GET',
            undefined,
            environment,
          );
        setData({ ops, docs: docs.data });
      } else setData({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [section, org, environment, currency]);
  const action: Action = async (fn, message = 'Saved.') => {
    setError('');
    setBusy(true);
    try {
      const result = await fn();
      setNotice(message);
      await load();
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stage2-workspace">
      <div className="stage2-toolbar">
        <Provenance
          label={
            environment === 'sandbox' ? 'sandbox_simulation' : 'recorded_data'
          }
        />
        {['Intelligence', 'Forecasts', 'Assistant', 'Automations'].includes(
          section,
        ) && (
          <label className="currency-selector">
            Currency
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'RWF'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <button className="secondary-button" onClick={load} disabled={busy}>
          Refresh
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert one-time" role="status">
          {notice}
          {notice.includes('/buyer/') && (
            <p>
              <a
                href={notice.slice(notice.indexOf('http'))}
                target="_blank"
                rel="noreferrer"
              >
                Open sandbox buyer link ↗
              </a>
            </p>
          )}
        </div>
      )}
      {busy && !data && (
        <div className="skeleton" role="status">
          Loading authorized records…
        </div>
      )}
      {section === 'Intelligence' && (
        <IntelligenceView
          data={data}
          secondary={secondary}
          api={api}
          action={action}
          currency={currency}
          writable={finance}
          onNavigate={onNavigate}
          setData={setData}
        />
      )}
      {section === 'Forecasts' && (
        <ForecastView
          data={data}
          currency={currency}
          api={api}
          setData={setData}
        />
      )}
      {section === 'Assistant' && (
        <AssistantView api={api} currency={currency} />
      )}
      {section === 'Automations' && (
        <AutomationView
          data={data}
          secondary={secondary}
          api={api}
          action={action}
          currency={currency}
        />
      )}
      {section === 'Notifications' && (
        <NotificationView data={data} api={api} action={action} />
      )}
      {section === 'Approvals' && (
        <ApprovalView
          data={data}
          secondary={secondary}
          api={api}
          action={action}
          admin={admin}
        />
      )}
      {section === 'Fulfillment' && (
        <FulfillmentView
          data={data}
          secondary={secondary}
          api={api}
          action={action}
          onDetail={setDetail}
        />
      )}
      {section === 'Protected Payments' && (
        <ProtectedView
          data={data}
          api={api}
          action={action}
          onDetail={setDetail}
          setNotice={setNotice}
        />
      )}
      {section === 'Disputes' && (
        <DisputeView
          data={data}
          api={api}
          action={action}
          admin={admin}
          onDetail={setDetail}
        />
      )}
      {section === 'Connect' && (
        <ConnectView
          data={data}
          secondary={secondary}
          api={api}
          action={action}
          admin={admin}
        />
      )}
      {section === 'Risk Review' && (
        <RiskView data={data} api={api} action={action} />
      )}
      {section === 'Engineering' && (
        <EngineeringView data={data} query={query} setQuery={setQuery} />
      )}
      {detail && (
        <RecordDetail
          record={detail}
          api={api}
          writable={operations}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
