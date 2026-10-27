import { Icon } from '../components/Icon';
import { useEffect, useRef, useState } from 'react';
import { createRequestGate } from '../components/requestGate';
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
export const operationsTabs = [
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
export function OperationsWorkspace({
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
  const scope = org + '\0' + environment + '\0' + section + '\0' + currency;
  const currentScope = useRef(scope),
    gate = useRef(createRequestGate());
  currentScope.current = scope;
  async function load() {
    if (currentScope.current !== scope) return;
    const latest = gate.current.begin(),
      current = () => latest() && currentScope.current === scope;
    const publishData = (value: any) => {
        if (current()) setData(value);
      },
      publishSecondary = (value: any) => {
        if (current()) setSecondary(value);
      };
    setData(null);
    setSecondary({});
    setError('');
    setBusy(true);
    try {
      if (section === 'Intelligence') {
        publishData(await api('/intelligence?currency=' + currency));
        publishSecondary({
          expenses: (await api('/expenses')).data,
          obligations: (await api('/obligations')).data,
        });
      } else if (section === 'Forecasts')
        publishData(
          await api('/forecasts', 'POST', {
            currency,
            horizon: 30,
            scenario: 'expected',
          }),
        );
      else if (section === 'Automations') {
        publishData(await api('/automations'));
        publishSecondary({
          templates: (await api('/automations/templates')).data,
          runs: (await api('/automation-runs')).data,
        });
      } else if (section === 'Notifications')
        publishData(await api('/notifications'));
      else if (section === 'Approvals') {
        publishData(await api('/approvals'));
        publishSecondary({ team: (await api('/team')).data });
      } else if (section === 'Fulfillment') {
        publishData(await api('/shipments'));
        publishSecondary({
          orders: (await api('/records/orders?limit=100')).data,
        });
      } else if (section === 'Protected Payments')
        publishData(await api('/protected-sales'));
      else if (section === 'Disputes') publishData(await api('/disputes'));
      else if (section === 'Connect') {
        publishData(await api('/connectors'));
        publishSecondary({ catalog: (await api('/connectors/catalog')).data });
      } else if (section === 'Risk Review')
        publishData(await api('/risk-signals'));
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
        publishData({ ops, docs: docs.data });
      } else publishData({});
    } catch (e) {
      if (current()) setError((e as Error).message);
    } finally {
      if (current()) setBusy(false);
    }
  }
  useEffect(() => {
    load();
    return () => gate.current.invalidate();
  }, [section, org, environment, currency]);
  const action: Action = async (fn, message = 'Saved.') => {
    if (currentScope.current !== scope) return null;
    setError('');
    setBusy(true);
    try {
      const result = await fn();
      if (currentScope.current !== scope) return null;
      setNotice(message);
      await load();
      return result;
    } catch (e) {
      if (currentScope.current === scope) setError((e as Error).message);
      return null;
    } finally {
      if (currentScope.current === scope) setBusy(false);
    }
  };
  return (
    <div className="operations-workspace">
      <div className="operations-toolbar">
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
                Open sandbox buyer link <Icon name="right" />
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
              setData={(result) => { if(currentScope.current === scope) setData(result); }}
        />
      )}
      {section === 'Forecasts' && (
        <ForecastView
          data={data}
          currency={currency}
          api={api}
              setData={(result) => { if(currentScope.current === scope) setData(result); }}
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
