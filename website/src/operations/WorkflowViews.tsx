import { DataTable } from '../components/DataTable';
import {
  Field,
  Form,
  Provenance,
  Empty,
  factor,
  type API,
  type Action,
} from './UI';
export function AutomationView({
  data,
  secondary,
  api,
  action,
  currency,
}: {
  data: any;
  secondary: any;
  api: API;
  action: Action;
  currency: string;
}) {
  return (
    <>
      <div className="dashboard-columns">
        <Form
          submit={(d) =>
            action(
              () =>
                api('/automations', 'POST', {
                  name: d.name,
                  template: d.template,
                  enabled: d.enabled === 'on',
                  schedule: { frequency: d.frequency, hour: Number(d.hour) },
                  conditions: {
                    currency,
                    minimum_minor: Math.round(
                      Number(d.minimum || 0) * factor(currency),
                    ),
                    days_before_due: Number(d.days || 3),
                  },
                }),
              'Workflow saved. Actions are in-app only.',
            )
          }
        >
          <h2>Create a workflow</h2>
          <Field label="Name">
            <input name="name" required maxLength={100} />
          </Field>
          <Field label="Trigger template">
            <select name="template">
              {secondary.templates?.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Frequency">
              <select name="frequency">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
            <Field label="Hour (Africa/Nairobi)">
              <input
                name="hour"
                type="number"
                min={0}
                max={23}
                defaultValue={9}
              />
            </Field>
            <Field label="Days before due">
              <input
                name="days"
                type="number"
                min={0}
                max={30}
                defaultValue={3}
              />
            </Field>
            <Field label={'Minimum amount (' + currency + ')'}>
              <input name="minimum" type="number" min={0} defaultValue={0} />
            </Field>
          </div>
          <p>
            Action: notify the workflow owner in AfriCore. No customer message
            or financial action is sent.
          </p>
          <label className="checkbox-field">
            <input type="checkbox" name="enabled" />
            Enable workflow
          </label>
          <button className="button">Create workflow</button>
        </Form>
        <section className="panel">
          <h2>Your workflows</h2>
          {data?.data?.length ? (
            data.data.map((w: any) => (
              <div className="list-row" key={w.id}>
                <div>
                  <b>{w.name}</b>
                  <p>
                    {w.template} · {w.schedule.frequency} ·{' '}
                    {w.enabled ? 'Enabled' : 'Paused'}
                  </p>
                </div>
                <button
                  onClick={() =>
                    action(() =>
                      api('/automations/' + w.id, 'PATCH', {
                        enabled: !w.enabled,
                      }),
                    )
                  }
                >
                  {w.enabled ? 'Pause' : 'Resume'}
                </button>
              </div>
            ))
          ) : (
            <Empty text="Choose a template for a controlled business review." />
          )}
          <button
            className="secondary-button"
            onClick={() =>
              action(
                () => api('/automations/process', 'POST', {}),
                'Due workflows checked; duplicate triggers ignored.',
              )
            }
          >
            Process due triggers
          </button>
        </section>
      </div>
      <section className="panel">
        <h2>Run history</h2>
        <div className="table-scroll">
          <DataTable>
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {secondary.runs?.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.status}</td>
                  <td>{r.attempts}</td>
                  <td>
                    {new Date(r.created_at).toLocaleString('en-KE', {
                      timeZone: 'Africa/Nairobi',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>
    </>
  );
}
export function NotificationView({
  data,
  api,
  action,
}: {
  data: any;
  api: API;
  action: Action;
}) {
  return (
    <>
      <section className="panel">
        <h2>Notification preferences</h2>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={!!data?.preferences?.paused}
            onChange={(e) =>
              action(() =>
                api('/notification-preferences', 'PUT', {
                  paused: e.target.checked,
                  muted_categories: data?.preferences?.muted_categories || [],
                }),
              )
            }
          />
          Pause my in-app notifications
        </label>
        <details>
          <summary>Choose categories to mute</summary>
          <div className="notification-categories">
            {[
              'payments',
              'invoices',
              'cash_flow',
              'reconciliation',
              'integrations',
              'orders',
              'deliveries',
              'protected_payments',
              'automation_failures',
              'security',
              'team',
            ].map((category) => (
              <label key={category} className="checkbox-field">
                <input
                  type="checkbox"
                  checked={
                    data?.preferences?.muted_categories?.includes(category) ||
                    false
                  }
                  onChange={(e) => {
                    const muted = data?.preferences?.muted_categories || [];
                    action(() =>
                      api('/notification-preferences', 'PUT', {
                        paused: !!data?.preferences?.paused,
                        muted_categories: e.target.checked
                          ? [...muted, category]
                          : muted.filter((c: string) => c !== category),
                      }),
                    );
                  }}
                />
                {category.replaceAll('_', ' ')}
              </label>
            ))}
          </div>
        </details>
        <p>
          Preferences and read state are personal. External delivery is not
          configured.
        </p>
      </section>
      <section className="panel">
        <h2>Your notification center</h2>
        {data?.data?.length ? (
          data.data.map((n: any) => (
            <article
              className={'notification-item ' + (!n.read_at ? 'unread' : '')}
              key={n.id}
            >
              <div>
                <Provenance label={n.category} />
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small>
                  {new Date(n.created_at).toLocaleString('en-KE', {
                    timeZone: 'Africa/Nairobi',
                  })}
                </small>
              </div>
              {!n.read_at && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    action(() => api('/notifications/' + n.id, 'PATCH', {}))
                  }
                >
                  Mark read
                </button>
              )}
            </article>
          ))
        ) : (
          <Empty text="Only relevant, deduplicated updates appear here." />
        )}
      </section>
    </>
  );
}
export function ApprovalView({
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
      <Form
        submit={(d) =>
          action(
            () => api('/approvals', 'POST', {action:d.action,approver:d.approver,resource_id:d.resource_id,parameters:d.action==='dispute_resolution'?{decision:d.dispute_decision}:{}}),
            'Approval requested; the assigned person must decide separately.',
          )
        }
      >
        <h2>Request a second-person review</h2>
        <Field label="Dispute outcome (for dispute resolution only)"><select name="dispute_decision"><option value="refund">Refund</option><option value="release">Release</option></select></Field>
        <div className="form-grid">
          <Field label="Action">
            <select name="action">
              {[
                'protected_release',
                'dispute_resolution',
                'protected_refund',
                'sensitive_integration_change',
                'invoice_adjustment',
                'manual_reconciliation',
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Resource ID">
            <input name="resource_id" required />
          </Field>
          <Field label="Assigned approver">
            <select name="approver" required>
              {secondary.team
                ?.filter((m: any) => ['owner', 'admin'].includes(m.role))
                .map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.email} · {m.role}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <p>
          Self-approval is rejected. Requests expire in 24 hours. An approval
          does not execute a financial action.
        </p>
        <button className="button">Request approval</button>
      </Form>
      <section className="panel">
        <h2>My review queue</h2>
        {data?.data?.length ? (
          data.data.map((a: any) => (
            <article className="approval-item" key={a.id}>
              <div>
                <b>{a.action}</b>
                <p>{a.resource_id}</p>
                <code>Approval: {a.id}</code>
                {a.review_summary&&<p>Reviewed details: {a.review_summary}</p>}
                {a.parameters&&<p>Exact decision: {a.parameters}</p>}
                {!a.resource_hash&&<p>This older request needs a new review before execution.</p>}
                {a.consumed_at&&<small>Already used · a new action requires a new approval.</small>}
                <p>
                  {a.status} · Expires{' '}
                  {new Date(a.expires_at).toLocaleString('en-KE', {
                    timeZone: 'Africa/Nairobi',
                  })}
                </p>
              </div>
              {a.status === 'pending' && admin && (
                <Form
                  className="approval-form"
                  submit={(d) =>
                    action(() =>
                      api('/approvals/' + a.id + '/decide', 'POST', d),
                    )
                  }
                >
                  <input
                    required
                    name="reason"
                    minLength={5}
                    placeholder="Reason for the decision"
                  />
                  <select name="decision">
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                  </select>
                  <button className="secondary-button">Record decision</button>
                </Form>
              )}
            </article>
          ))
        ) : (
          <Empty text="No requests assigned to or created by you." />
        )}
      </section>
    </>
  );
}
