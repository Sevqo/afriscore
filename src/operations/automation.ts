import { automationTemplates, automationSchema,workflowEditInput } from './contracts';
export { automationTemplates, automationSchema } from './contracts';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db';
import { Access, audit, fail } from '../platform/auth';
import { permitted } from '../platform/domain';
import { now,hash } from '../platform/crypto';
import { all, atomic, change, create, day, addDays, get, legacy } from './store';
import { emit } from './events';
import {requireServices,checkLimits,recordUsage} from '../marketplace/engine';

export async function notify(
  a: Access,
  input: {
    category: string;
    title: string;
    body: string;
    resource_id?: string;
    key: string;
    user_id?: string;
  },
) {
  const members = await dbAll(
    'SELECT user_id FROM ac_memberships WHERE org_id=?' +
      (input.user_id ? ' AND user_id=?' : ''),
    [a.org, ...(input.user_id ? [input.user_id] : [])],
  );
  const prefs = await all(a, 'notification_preferences');
  let inserted = 0;
  for (const member of members) {
    const pref = prefs.find((p) => p.user_id === member.user_id);
    if (pref?.paused || pref?.muted_categories?.includes(input.category))
      continue;
    const cap = await dbGet(
      'SELECT COUNT(*) AS total FROM ac2_notifications WHERE org_id=? AND user_id=? AND created_at>=?',
      [a.org, member.user_id, day() + 'T00:00:00'],
    );
    if (Number(cap.total) >= 100) continue;
    const result = await dbRun(
      'INSERT INTO ac2_notifications(id,org_id,environment,user_id,category,title,body,resource_id,dedupe_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,user_id,dedupe_key) DO NOTHING',
      [
        randomUUID(),
        a.org,
        a.environment,
        member.user_id,
        input.category,
        input.title,
        input.body,
        input.resource_id || null,
        input.key,
        now(),
      ],
    );
    inserted += result.changes;
  }
  return { inserted };
}
export async function createAutomation(a: Access, input: unknown) {
  const d = automationSchema.parse(input);
  if (a.api) fail(403, 'A member must own an automation');
  return atomic(a, async()=>{const w=await create(a,'automations',{...d,created_by:a.actor});await saveWorkflowVersion(a,w);return w;});
}
export async function setAutomation(a: Access, id: string, enabled: boolean) {
  return atomic(a, async () => {
    const w = await get(a, id, 'automations');
    const result = await change(a, w, { enabled });
    await saveWorkflowVersion(a,result);
    await audit(
      a.org,
      a.actor,
      enabled ? 'automation.resumed' : 'automation.paused',
      id,
    );
    return result;
  });
}
export async function notificationPreferences(a: Access, input: unknown) {
  if (a.api) fail(403, 'Member session required');
  const d = z
    .object({
      paused: z.boolean(),
      muted_categories: z
        .array(
          z.enum([
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
          ]),
        )
        .max(11),
    })
    .strict()
    .parse(input);
  return atomic(a, async () => {
    const existing = (await all(a, 'notification_preferences')).find(
      (p) => p.user_id === a.actor,
    );
    return existing
      ? change(a, existing, d)
      : create(a, 'notification_preferences', { ...d, user_id: a.actor });
  });
}
async function candidates(a: Access, w: any, at: Date) {
  const template = automationTemplates.find((t) => t.id === w.template)!;
  if (template.trigger !== 'schedule')
    return (
      await dbAll(
        'SELECT e.* FROM ac2_events e WHERE e.org_id=? AND e.environment=? AND e.event_type=? AND e.occurred_at>=? AND NOT EXISTS (SELECT 1 FROM ac2_runs r WHERE r.org_id=e.org_id AND r.environment=e.environment AND r.workflow_id=? AND r.trigger_key=e.id) ORDER BY e.occurred_at,e.id LIMIT 100',
        [a.org, a.environment, template.trigger, w.created_at,w.id],
      )
    ).map((e) => ({
      key: e.id,
      resource_id: e.resource_id,
      payload: JSON.parse(e.payload),
    }));
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:w.schedule.timezone||'Africa/Nairobi'}).format(at),
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: w.schedule.timezone||'Africa/Nairobi',
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(at),
    );
  if (hour < w.schedule.hour) return [];
  const weekly =
    w.schedule.frequency === 'weekly' || w.template === 'weekly_cashflow';
  const key = weekly
    ? new Date(
        Date.parse(today + 'T00:00:00Z') -
          ((new Date(today).getUTCDay() + 6) % 7) * 86400000,
      )
        .toISOString()
        .slice(0, 10)
    : today;
  if (
    ['invoice_due_soon', 'invoice_overdue', 'customer_follow_up'].includes(
      w.template,
    )
  ) {
    const invoices = await legacy(a, 'invoices');
    return invoices
      .filter(
        (i) =>
          i.currency === w.conditions.currency &&
          !['draft', 'voided', 'paid','credited'].includes(i.status) &&
          i.total_minor - i.paid_minor-(i.credited_minor||0) >= w.conditions.minimum_minor &&
          (w.template === 'invoice_due_soon'
            ? i.due_date >= today &&
              i.due_date <=
                new Date(
                  Date.parse(today) + w.conditions.days_before_due * 86400000,
                )
                  .toISOString()
                  .slice(0, 10)
            : i.due_date < today),
      )
      .map((i) => ({
        key: key + ':' + i.id,
        resource_id: i.id,
        payload: {
          id: i.id,
          reference: i.reference,
          currency: i.currency,
          amount_minor: i.total_minor - i.paid_minor-(i.credited_minor||0),
        },
      }));
  }
  if(w.template==='obligation_due')return (await all(a,'obligations')).filter(o=>o.status==='active'&&o.currency===w.conditions.currency&&o.amount_minor>=w.conditions.minimum_minor&&o.next_due_date<=addDays(today,w.conditions.days_before_due)).map(o=>({key:key+':'+o.id,resource_id:o.id,payload:{id:o.id,currency:o.currency,amount_minor:o.amount_minor}}));
  if(w.template==='credential_expiry')return (await dbAll("SELECT id,valid_until FROM ac3_credentials WHERE org_id=? AND environment=? AND status='active' AND valid_until<=? AND valid_until>?",[a.org,a.environment,addDays(today,w.conditions.days_before_due)+'T23:59:59.999Z',at.toISOString()])).map(c=>({key:key+':'+c.id,resource_id:c.id,payload:{id:c.id}}));
  return [{ key, resource_id: undefined, payload: {} }];
}
export async function runAutomations(a: Access, at = new Date()) {
  return atomic(a, async () => {
    await requireServices(a,['automations']);
    await dbRun(
      "UPDATE ac2_approvals SET status='expired' WHERE org_id=? AND environment=? AND status='pending' AND expires_at<?",
      [a.org, a.environment, at.toISOString()],
    );
    const workflows = await all(a, 'automations');
    let queued = 0;
    for (const w of workflows.filter((w) => w.enabled)) {
      const member = await dbGet(
        'SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',
        [a.org, w.created_by],
      );
      if (!member || !permitted(member.role, 'finance')) {
        await change(a, w, {
          enabled: false,
          last_error: 'owner_permission_revoked',
        });
        await notify(a, {
          category: 'automation_failures',
          title: 'Automation paused',
          body: 'Its owner no longer has finance permissions.',
          resource_id: w.id,
          key: 'permission:' + w.id,
        });
        continue;
      }
      for (const trigger of await candidates(a, w, at)) {
        if (
          trigger.payload.currency &&
          trigger.payload.currency !== w.conditions.currency
        )
          continue;
        if (
          trigger.payload.amount_minor !== undefined &&
          trigger.payload.amount_minor < w.conditions.minimum_minor
        )
          continue;
        if (queued >= 50) break;
        await saveWorkflowVersion(a,w);
        const runId=randomUUID();
        const result = await dbRun(
          'INSERT INTO ac2_runs(id,org_id,environment,workflow_id,trigger_key,status,next_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,workflow_id,trigger_key) DO NOTHING',
          [
            runId,
            a.org,
            a.environment,
            w.id,
            trigger.key,
            'pending',
            new Date(at.getTime()+(w.delay_minutes||0)*60000).toISOString(),
            at.toISOString(),
            at.toISOString(),
          ],
        );
        if(result.changes)await dbRun('INSERT INTO ac_workflow_run_versions(run_id,workflow_id,version) VALUES (?,?,?)',[runId,w.id,w.version]);
        queued += result.changes;
      }
    }
    const runs = await dbAll(
      "SELECT * FROM ac2_runs WHERE org_id=? AND environment=? AND status='pending' AND next_at<=? ORDER BY created_at LIMIT 50",
      [a.org, a.environment, at.toISOString()],
    );
    for (const run of runs) {
      const w = await get(a, run.workflow_id, 'automations');
      const binding=await dbGet('SELECT version FROM ac_workflow_run_versions WHERE run_id=?',[run.id]);
      const member=await dbGet('SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',[a.org,w.created_by]);
      const resourceId=run.trigger_key.split(':').at(-1);
      const invoice=['invoice_due_soon','invoice_overdue','customer_follow_up'].includes(w.template)?await dbGet("SELECT data FROM ac_records WHERE id=? AND org_id=? AND environment=? AND kind='invoices'",[resourceId,a.org,a.environment]):null;
      const currentInvoice=invoice?JSON.parse(invoice.data):null;
      if ((['invoice_due_soon','invoice_overdue','customer_follow_up'].includes(w.template)&&!currentInvoice)||!w.enabled||!member||!permitted(member.role,'finance')||(binding&&Number(binding.version)!==w.version)||(currentInvoice&&(['draft','voided','paid','credited'].includes(currentInvoice.status)||currentInvoice.currency!==w.conditions.currency||currentInvoice.total_minor-currentInvoice.paid_minor-(currentInvoice.credited_minor||0)<=0||currentInvoice.total_minor-currentInvoice.paid_minor-(currentInvoice.credited_minor||0)<w.conditions.minimum_minor))) {
        await dbRun(
          "UPDATE ac2_runs SET status='cancelled',updated_at=? WHERE id=?",
          [now(), run.id],
        );
        continue;
      }
      try {
        await checkLimits(a,'automations',1);
        const template = automationTemplates.find((t) => t.id === w.template);
        if (!template) throw new Error('unsupported_template');
        const resource = run.trigger_key.split(':').at(-1);
        let body =
          'A business record needs your review. This is an in-app reminder; no customer message or financial action was sent.';
        if (['daily_summary', 'weekly_cashflow'].includes(w.template)) {
          const { financialSnapshot } = await import('./intelligence');
          const { day, addDays } = await import('./store');
          const end = day(at),
            start = addDays(end, w.template === 'weekly_cashflow' ? -6 : 0),
            summary = await financialSnapshot(
              a,
              { currency: w.conditions.currency, from: start, to: end },
              end,
            );
          body =
            'Recorded ' +
            start +
            ' to ' +
            end +
            ': confirmed collections ' +
            summary.totals.confirmed_inflows_minor +
            ' ' +
            w.conditions.currency +
            ' minor units; recorded outflows ' +
            summary.totals.recorded_outflows_minor +
            '; outstanding receivables ' +
            summary.totals.outstanding_minor +
            '. Coverage limits apply; this is not profit or a bank balance.';
        }
        const delivery=await notify(a, {
          category: template.category,
          title: template.name,
          body,
          resource_id: resource,
          key: 'automation:' + run.id,
          user_id: w.created_by,
        });
        await dbRun(
          "UPDATE ac2_runs SET status='succeeded',attempts=attempts+1,result=?,updated_at=? WHERE id=?",
          [
            JSON.stringify({
              action: 'in_app_notification',
              external_messages_sent: 0,
              notifications_created:delivery.inserted,
              delivery_status:delivery.inserted?'created':'suppressed_by_preferences_or_cap',
            }),
            now(),
            run.id,
          ],
        );
        await audit(a.org, w.created_by, 'automation.succeeded', run.id);
        if(delivery.inserted)await recordUsage(a,'automations','workflow:'+run.id,1,'workflow_completed');
      } catch (error) {
        const attempts = run.attempts + 1;
        await dbRun(
          'UPDATE ac2_runs SET status=?,attempts=?,result=?,next_at=?,updated_at=? WHERE id=?',
          [
            attempts >= 3 ? 'dead_letter' : 'pending',
            attempts,
            JSON.stringify({ error: 'execution_failed' }),
            new Date(at.getTime() + 1000 * 2 ** attempts).toISOString(),
            now(),
            run.id,
          ],
        );
        if (attempts >= 3) {
          await emit(a, 'automation.run_failed', {
            id: run.id,
            workflow_id: w.id,
          });
          await notify(a, {
            category: 'automation_failures',
            title: 'Automation needs attention',
            body: 'The run exhausted its retry policy.',
            resource_id: w.id,
            key: 'failure:' + run.id,
          });
        }
      }
    }
    return { queued, processed: runs.length };
  });
}
async function approvalResourceHash(a:Access,id:string){
 const object=await dbGet('SELECT id,kind,data,version,updated_at FROM ac2_objects WHERE id=? AND org_id=? AND environment=?',[id,a.org,a.environment])||await dbGet('SELECT id,kind,data,updated_at FROM ac_records WHERE id=? AND org_id=? AND environment=?',[id,a.org,a.environment]);
 if(!object)fail(404,'Approval resource not found');
 return hash(JSON.stringify([a.org,a.environment,object.id,object.kind,object.data,object.version??null,object.updated_at]));
}
async function approvalBinding(a:Access,approval:any,parameters?:unknown){
 const binding=await dbGet('SELECT * FROM ac_approval_bindings WHERE approval_id=? AND org_id=? AND environment=?',[approval.id,a.org,a.environment]);
 if(!binding||binding.consumed_at||binding.resource_hash!==await approvalResourceHash(a,approval.resource_id))fail(409,'Approval is stale or already consumed; request a new review');
 if(parameters!==undefined&&binding.parameters!==JSON.stringify(parameters))fail(409,'Execution parameters differ from the reviewed decision');
 return binding;
}
export async function requestApproval(a: Access, input: unknown) {
  if (a.api) fail(403, 'A human member must request approval');
  const d = z
    .object({
      approver: z.string().uuid(),
      action: z.enum([
        'protected_release',
        'protected_refund',
        'dispute_resolution',
        'sensitive_integration_change',
        'invoice_adjustment',
        'manual_reconciliation',
      ]),
      resource_id: z.string().uuid(),
      parameters:z.object({decision:z.enum(['release','refund']).optional()}).strict().default({}),
    })
    .strict()
    .parse(input);
  if (d.approver === a.actor) fail(400, 'Choose a different approver');
  if(d.action==='dispute_resolution'&&!d.parameters.decision)fail(400,'Choose the exact dispute outcome before requesting review');
  const m = await dbGet(
    'SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',
    [a.org, d.approver],
  );
  if (!m || !['owner', 'admin'].includes(m.role))
    fail(400, 'Approver must be an owner or admin');
  const kind =
    d.action === 'dispute_resolution'
      ? 'disputes'
      : d.action.startsWith('protected_')
        ? 'protected_sales'
        : d.action === 'sensitive_integration_change'
          ? 'connectors'
          : undefined;
  if (kind) await get(a, d.resource_id, kind);
  else {
    const object = await dbGet(
      'SELECT id FROM ac_records WHERE id=? AND org_id=? AND environment=?',
      [d.resource_id, a.org, a.environment],
    );
    if (!object) fail(404, 'Resource not found');
  }
  const id = randomUUID();
  const resourceHash=await approvalResourceHash(a,d.resource_id);
  const resourceRow=await dbGet('SELECT kind,data FROM ac2_objects WHERE id=? AND org_id=? AND environment=?',[d.resource_id,a.org,a.environment])||await dbGet('SELECT kind,data FROM ac_records WHERE id=? AND org_id=? AND environment=?',[d.resource_id,a.org,a.environment]);
  const source=JSON.parse(resourceRow.data),summary=Object.fromEntries(['amount_minor','currency','buyer_name','recipient_org','state','status','description'].filter(key=>source[key]!==undefined).map(key=>[key,source[key]]));
  await dbRun(
    'INSERT INTO ac2_approvals(id,org_id,environment,requester,approver,action,resource_id,status,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [
      id,
      a.org,
      a.environment,
      a.actor,
      d.approver,
      d.action,
      d.resource_id,
      'pending',
      new Date(Date.now() + 86400000).toISOString(),
      now(),
    ],
  );
  await dbRun('INSERT INTO ac_approval_bindings(approval_id,org_id,environment,resource_hash,parameters,review_summary) VALUES (?,?,?,?,?,?)',[id,a.org,a.environment,resourceHash,JSON.stringify(d.parameters),JSON.stringify(summary)]);
  await audit(a.org, a.actor, 'approval.requested', id);
  await emit(a, 'approval.requested', { id, resource_id: d.resource_id });
  await notify(a, {
    category: 'security',
    title: 'Approval requested',
    body: 'Review the request before deciding. Self-approval is not permitted.',
    resource_id: id,
    key: id,
    user_id: d.approver,
  });
  return { id, ...d, status: 'pending' };
}
export async function decideApproval(a: Access, id: string, input: unknown) {
  if (a.api) fail(403, 'Human session required');
  const d = z
    .object({
      decision: z.enum(['approved', 'rejected']),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict()
    .parse(input);
  return atomic(a, async () => {
    const approval = await dbGet(
      'SELECT * FROM ac2_approvals WHERE id=? AND org_id=? AND environment=?',
      [id, a.org, a.environment],
    );
    if (!approval) fail(404, 'Approval not found');
    if (approval.approver !== a.actor || approval.requester === a.actor)
      fail(403, 'Assigned non-requesting approver required');
    const currentRole=await dbGet('SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',[a.org,a.actor]);
    if(!currentRole||!['owner','admin'].includes(currentRole.role))fail(403,'Approver authority revoked');
    if (approval.status !== 'pending' || approval.expires_at < now())
      fail(409, 'Approval is closed or expired');
    if(d.decision==='approved')await approvalBinding(a,approval);
    await dbRun(
      'UPDATE ac2_approvals SET status=?,reason=?,decided_at=? WHERE id=?',
      [d.decision, d.reason, now(), id],
    );
    await audit(a.org, a.actor, 'approval.' + d.decision, id);
    await emit(a, 'approval.decided', { id, status: d.decision });
    return { id, status: d.decision, executed: false };
  });
}
export async function requireApproval(
  a: Access,
  id: string | undefined,
  action: string,
  resource: string,
  parameters:unknown={},
) {
  if (!id) fail(409, 'An approved request is required');
  const approval = await dbGet(
    "SELECT * FROM ac2_approvals WHERE id=? AND org_id=? AND environment=? AND action=? AND resource_id=? AND status='approved' AND expires_at>?",
    [id, a.org, a.environment, action, resource, now()],
  );
  if (!approval || approval.requester !== a.actor)
    fail(
      403,
      'An unexpired approval for this requester and resource is required',
    );
  const approver = await dbGet(
    'SELECT role FROM ac_memberships WHERE org_id=? AND user_id=?',
    [a.org, approval.approver],
  );
  if (!approver || !['owner', 'admin'].includes(approver.role))
    fail(403, 'Approver authority revoked');
  await approvalBinding(a,approval,parameters);
  const consumed=await dbRun('UPDATE ac_approval_bindings SET consumed_at=? WHERE approval_id=? AND consumed_at IS NULL',[now(),approval.id]);
  if(!consumed.changes)fail(409,'Approval already consumed');
  await audit(a.org,a.actor,'approval.consumed',approval.id);
  return approval;
}

export async function saveWorkflowVersion(a:Access,w:any){await dbRun('INSERT INTO ac_workflow_versions(workflow_id,version,org_id,environment,actor,configuration,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(workflow_id,version) DO NOTHING',[w.id,w.version,a.org,a.environment,a.actor,JSON.stringify(w),now()]);}
export async function editAutomation(a:Access,id:string,input:unknown){const d=workflowEditInput.parse(input);if(a.api)fail(403,'A human member must own a workflow change');return atomic(a,async()=>{const w=await get(a,id,'automations');if(w.version!==d.expected_version)fail(409,'Workflow changed; reload before editing');await saveWorkflowVersion(a,w);const result=await change(a,w,d.configuration);await saveWorkflowVersion(a,result);await audit(a.org,a.actor,'automation.version_updated',id);return result;});}
