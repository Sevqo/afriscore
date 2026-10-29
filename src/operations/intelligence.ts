import {basisPoints,nextOccurrence,sumMinor} from '../finance/money';
import {
  expenseSchema,
  obligationSchema,
  analyticsQuery,
  forecastSchema,
} from './contracts';
export {
  expenseSchema,
  obligationSchema,
  analyticsQuery,
  forecastSchema,
} from './contracts';
import { z } from 'zod';
import { dbAll, dbGet } from '../db';
import { Access, fail } from '../platform/auth';
import { currencySchema } from '../platform/domain';
import { all, atomic, create, day, addDays, legacy, minor } from './store';
import { emit } from './events';

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b),
    m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const sum = (rows: any[], field: string) =>
  sumMinor(rows.map(r=>Number(r[field]||0)));
function effective(rows: any[]) {
  const replaced = new Set(rows.map((r) => r.supersedes_id).filter(Boolean));
  return rows.filter((r) => !replaced.has(r.id)&&r.status!=='archived');
}
export async function addExpense(a: Access, input: unknown) {
  const d = expenseSchema.parse(input);
  if(d.status==='archived'&&!d.supersedes_id)fail(400,'Archive an existing expense through a retained correction');
  const organization=await dbGet('SELECT profile FROM ac_organizations WHERE id=?',[a.org]);
  const profile=JSON.parse(organization?.profile||'{}');
  const obligation=d.obligation_id?(await all(a,'obligations')).find(o=>o.id===d.obligation_id):undefined;
  const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:obligation?.timezone||profile.timezone||'Africa/Nairobi'}).format(new Date());
  if (d.occurred_on > localDay)
    fail(400, 'An expense cannot be recorded in the future');
  return atomic(a, async () => {
    if (d.obligation_id) {
      const obligation = (await all(a, 'obligations')).find(
        (o) => o.id === d.obligation_id && o.currency === d.currency,
      );
      if (!obligation)
        fail(400, 'Authorized obligation in the same currency required');
    }
    if (d.transaction_id) {
      const tx = (await legacy(a, 'transactions')).find(
        (t) => t.id === d.transaction_id,
      );
      if (
        !tx ||
        tx.type !== 'outflow' ||
        tx.currency !== d.currency ||
        tx.amount_minor !== d.amount_minor
      )
        fail(400, 'Expense must match an authorized outflow');
      if (
        effective(await all(a, 'expenses')).some(
          (e) =>
            e.transaction_id === d.transaction_id && e.id !== d.supersedes_id,
        )
      )
        fail(409, 'Transaction already categorized');
    }
    if (d.supersedes_id) {
      const old = (await all(a, 'expenses')).find(
        (e) => e.id === d.supersedes_id,
      );
      if (!old || old.currency !== d.currency)
        fail(
          400,
          'Correction must reference an authorized expense in the same currency',
        );
      if (d.transaction_id && d.transaction_id !== old!.transaction_id)
        fail(400, 'Correction cannot change the source transaction');
      d.transaction_id = old!.transaction_id;
      d.obligation_id = d.obligation_id || old!.obligation_id;
      if ((await all(a, 'expenses')).some((e) => e.supersedes_id === old!.id))
        fail(409, 'Expense already corrected');
    }
    const r = await create(a, 'expenses', {
      ...d,
      provenance: 'self_reported',
      assurance: 'merchant_recorded',
    });
    await emit(a, 'expense.recorded', { id: r.id });
    return r;
  });
}
export async function financialSnapshot(
  a: Access,
  input: unknown = {},
  asOf = day(),
) {
  const query = analyticsQuery.parse(input);
  let from = query.from || addDays(asOf, -89);
  const to = query.to || asOf;
  if (
    ((query.range!=='all'||query.from)&&from > to) ||
    to > asOf ||
    (query.range!=='all'&&Date.parse(to) - Date.parse(from) > 366 * 86400000)
  )
    fail(400, 'Choose a historical range of at most 366 days');
  const [
    invoices,
    orders,
    transactions,
    customers,
    expenses,
    obligations,
    shipments,
    disputes,
    integrations,
  ] = await Promise.all([
    legacy(a, 'invoices'),
    legacy(a, 'orders'),
    legacy(a, 'transactions'),
    legacy(a, 'customers'),
    all(a, 'expenses'),
    all(a, 'obligations'),
    all(a, 'shipments'),
    all(a, 'disputes'),
    all(a, 'connectors'),
  ]);
  const events = await dbAll(
    'SELECT e.*,d.related_event_id,d.time_basis FROM ac_financial_events e LEFT JOIN ac_payment_event_details d ON d.event_id=e.id WHERE e.org_id=? AND e.environment=? ORDER BY e.created_at',
    [a.org, a.environment],
  );
  const allocations = await dbAll(
    'SELECT * FROM ac_effective_allocations WHERE org_id=? AND environment=? ORDER BY created_at',
    [a.org, a.environment],
  );
  const exceptions = await dbAll(
    "SELECT * FROM ac_exceptions WHERE org_id=? AND environment=? AND status='pending_review'",
    [a.org, a.environment],
  );
  if(query.range==='all'&&!query.from){const dates=[...invoices.map(i=>i.issue_date),...events.map(e=>e.created_at.slice(0,10)),...transactions.map(t=>t.occurred_at.slice(0,10)),...expenses.map(e=>e.occurred_on)].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=to).sort();from=dates[0]||to;}
  const inPeriod = (d: string) =>
    d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const issued = invoices.filter(
    (i) =>
      i.currency === query.currency &&
      i.issue_date <= to &&
      !['draft', 'voided'].includes(i.status),
  );
  const selectedInvoices = issued.filter((i) => i.issue_date >= from);
  const selectedEvents = events.filter(
    (e) => e.currency === query.currency && inPeriod(e.created_at),
  );
  const confirmed = selectedEvents.filter((e) => e.status === 'succeeded');
  const returns=selectedEvents.filter(e=>e.related_event_id&&['reversed','refunded'].includes(e.status));
  const credited=await dbAll('SELECT invoice_id,amount_minor FROM ac_credit_notes WHERE org_id=? AND environment=? AND issued_on<=?',[a.org,a.environment,to]);
  const moneyExpenses = effective(expenses).filter(
    (e) => e.currency === query.currency && inPeriod(e.occurred_on),
  );
  const categorized = new Set(
    effective(expenses)
      .map((e) => e.transaction_id)
      .filter(Boolean),
  );
  const importedOutflows = transactions.filter(
    (t) =>
      t.currency === query.currency &&
      t.type === 'outflow' &&
      inPeriod(t.occurred_at) &&
      !categorized.has(t.id),
  );
  const outflows =
    sum(moneyExpenses, 'amount_minor') + sum(importedOutflows, 'amount_minor');
  const periods = new Map<
    string,
    {
      date: string;
      confirmed_inflows_minor: number;
      recorded_outflows_minor: number;
    }
  >();
  const point=(date:string)=>{let value=periods.get(date);if(!value){value={date,confirmed_inflows_minor:0,recorded_outflows_minor:0};periods.set(date,value);}return value;};
  for (const e of confirmed)
    point(e.created_at.slice(0, 10)).confirmed_inflows_minor += Number(
      e.amount_minor,
    );
  for(const e of returns)point(e.created_at.slice(0,10)).confirmed_inflows_minor-=Number(e.amount_minor);
  for (const e of moneyExpenses)
    point(e.occurred_on).recorded_outflows_minor += Number(
      e.amount_minor,
    );
  for (const e of importedOutflows)
    point(e.occurred_at.slice(0, 10)).recorded_outflows_minor += Number(
      e.amount_minor,
    );
  const balances = issued.map((i) => {
    const paid = allocations
      .filter((p) => p.document_id === i.id && p.created_at.slice(0, 10) <= to)
      .reduce((s, p) => s + Number(p.amount_minor), 0);
    return {
      ...i,
      paid_minor: paid,
      credited_minor:sum(credited.filter(c=>c.invoice_id===i.id),'amount_minor'),
      outstanding_minor: Math.max(0, i.total_minor - paid-sum(credited.filter(c=>c.invoice_id===i.id),'amount_minor')),
      overdue_days: Math.max(
        0,
        Math.floor((Date.parse(to) - Date.parse(i.due_date)) / 86400000),
      ),
    };
  });
  const aging = {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_over_90: 0,
  };
  for (const i of balances) {
    const key =
      i.overdue_days === 0
        ? 'current'
        : i.overdue_days <= 30
          ? 'days_1_30'
          : i.overdue_days <= 60
            ? 'days_31_60'
            : i.overdue_days <= 90
              ? 'days_61_90'
              : 'days_over_90';
    aging[key] += i.outstanding_minor;
  }
  const behavior = customers.map((c) => {
    const docs = balances.filter((i) => i.customer_id === c.id),
      paid = docs.filter((i) => i.outstanding_minor === 0 && i.credited_minor===0),
      observations = paid
        .map((i) => {
          const ps = allocations.filter(
            (p) => p.document_id === i.id && p.created_at.slice(0, 10) <= to,
          );
          const settled = ps.some(p=>p.time_basis==='observed_confirmation')?undefined:ps[ps.length - 1]?.created_at.slice(0, 10);
          return {
            invoice_id: i.id,
            paid_on: settled,
            delay_days: settled
              ? Math.max(
                  0,
                  Math.round(
                    (Date.parse(settled) - Date.parse(i.due_date)) / 86400000,
                  ),
                )
              : null,
          };
        })
        .filter((i) => i.delay_days !== null);
    const delays = observations.map((o) => o.delay_days as number),
      adequate = delays.length >= 3;
    return {
      customer_id: c.id,
      name: c.name,
      total_invoiced_minor: sum(docs, 'total_minor'),
      total_paid_minor: sum(docs, 'paid_minor'),
      outstanding_minor: sum(docs, 'outstanding_minor'),
      settled_invoice_count: observations.length,
      average_delay_days: adequate
        ? Math.round(sum(observations, 'delay_days') / delays.length)
        : null,
      median_delay_days: adequate ? median(delays) : null,
      on_time_percent: adequate
        ? Math.round(
            (delays.filter((d) => d === 0).length / delays.length) * 100,
          )
        : null,
      most_recent_payment:
        allocations
          .filter(
            (p) =>
              docs.some((i) => i.id === p.document_id) &&
              p.created_at.slice(0, 10) <= to,
          )
          .at(-1)?.created_at || null,
      open_disputes: disputes.filter(
        (d) =>
          d.customer_id === c.id && !['resolved', 'closed'].includes(d.status),
      ).length,
      observations,
      limited_data: !adequate,
    };
  });
  const issuedTotal = sum(balances, 'total_minor'),
    concentration = behavior
      .map((c) => ({
        customer_id: c.customer_id,
        name: c.name,
        share_bps: issuedTotal
          ? Math.round((c.total_invoiced_minor / issuedTotal) * 10000)
          : 0,
      }))
      .sort((a, b) => b.share_bps - a.share_bps);
  const recordedDates = [
    ...events.map((e) => e.created_at.slice(0, 10)),
    ...transactions.map((t) => t.occurred_at.slice(0, 10)),
    ...expenses.map((e) => e.occurred_on),
  ]
    .filter((d) => d <= to)
    .sort();
  const historyDays = recordedDates.length
    ? Math.max(
        1,
        Math.round((Date.parse(to) - Date.parse(recordedDates[0])) / 86400000) +
          1,
      )
    : 0;
  const quality = {
    history_days: historyDays,
    missing_expense_data: outflows === 0,
    source_count: integrations.filter((i) => i.status === 'synced').length,
    last_sync:
      integrations
        .map((i) => i.last_synced_at)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
    last_transaction_at:
      events.filter((e) => e.created_at.slice(0, 10) <= to).at(-1)
        ?.created_at || null,
    unreconciled_count: exceptions.length,
    unallocated_confirmations: confirmed.filter(
      (e) => !allocations.some((p) => p.event_id === e.id),
    ).length,
    missing_due_dates: issued.filter((i) => !i.due_date).length,
    limited_history: historyDays < 30,
    unknown_provider_occurrence_dates:events.filter(e=>e.time_basis==='observed_confirmation').length,
    bank_balance_available: false,
    profit_available: false,
    source_labels: [
      'provider_confirmed (sandbox simulation when applicable)',
      'merchant_recorded expenses/imports',
      'derived aggregates',
    ],
  };
  const insights: any[] = [];
  const outstanding = sum(balances, 'outstanding_minor'),
    overdue = sum(
      balances.filter((i) => i.overdue_days > 0),
      'outstanding_minor',
    );
  if (overdue > 0)
    insights.push({
      id: 'overdue',
      classification: 'derived_metric',
      title: 'Receivables need follow-up',
      evidence: {
        overdue_minor: overdue,
        invoice_ids: balances
          .filter((i) => i.overdue_days > 0 && i.outstanding_minor > 0)
          .map((i) => i.id),
      },
      period: { from, to },
      limitation: 'Due dates and verified allocations only.',
      action: 'Invoices',
    });
  if (concentration[0]?.share_bps > 4000)
    insights.push({
      id: 'concentration',
      classification: 'derived_metric',
      title: 'Invoiced sales are concentrated',
      evidence: concentration[0],
      period: { from, to },
      limitation: 'Concentration is not proof of creditworthiness or fraud.',
      action: 'Customers',
    });
  if (quality.missing_expense_data)
    insights.push({
      id: 'expense_gap',
      classification: 'data_limitation',
      title: 'Expense coverage is incomplete',
      evidence: { recorded_outflows_minor: outflows },
      period: { from, to },
      limitation: 'A full profit or cash balance cannot be inferred.',
      action: 'Intelligence',
    });
  if (!historyDays)
    insights.push({
      id: 'no_history',
      classification: 'data_limitation',
      title: 'Start with reliable records',
      evidence: { record_count: 0 },
      period: { from, to },
      limitation: 'No artificial trend is generated.',
      action: 'Invoices',
    });
  return {
    currency: query.currency,
    environment: a.environment,
    period: { from, to },
    as_of: to,
    definitions: {
      confirmed_inflows:
        'Provider-confirmed collections less linked, confirmed returns in the selected occurrence period. Sandbox provider results are simulations.',
      recorded_outflows:
        'Self-reported expenses plus uncategorized merchant-imported outflows; not a verified expense ledger.',
      net_movement:
        'Recorded coverage only; not available bank balance or profit.',
      receivables:
        'Issued invoices at range end, less effective allocations and credit notes as of that date.',
    },
    totals: {
      confirmed_inflows_minor: sum(confirmed, 'amount_minor')-sum(returns,'amount_minor'),
      gross_confirmed_inflows_minor:sum(confirmed,'amount_minor'),returned_minor:sum(returns,'amount_minor'),
      recorded_outflows_minor: outflows,
      net_movement_minor: sum(confirmed, 'amount_minor') -sum(returns,'amount_minor')- outflows,
      outstanding_minor: outstanding,
      overdue_minor: overdue,
      invoiced_sales_minor: sum(selectedInvoices, 'total_minor'),
    },
    quality,
    aging,
    customers: behavior,
    concentration,
    invoices: balances,
    series: [...periods.values()].sort((a,b)=>a.date.localeCompare(b.date)),
    insights,
    payments: {
      successful: confirmed.length,
      failed: selectedEvents.filter((e) => e.status === 'failed').length,
      reversals: selectedEvents.filter((e) => e.status === 'reversed').length,
      reconciliation_rate: confirmed.length
        ? Math.round(
            (confirmed.filter((e) =>
              allocations.some((p) => p.event_id === e.id),
            ).length /
              confirmed.length) *
              100,
          )
        : null,
      confirmation_delay_ms: null,
      method_breakdown: confirmed.length
        ? [
            {
              method: a.environment === 'sandbox' ? 'sandbox' : 'provider',
              count: confirmed.length,
            },
          ]
        : [],
    },
    operations: {
      orders_created: orders.filter((o) => inPeriod(o.created_at)).length,
      shipments: shipments.length,
      seller_reported_delivered: shipments.filter(
        (s) => s.status === 'delivered',
      ).length,
      confirmed_deliveries: shipments.filter(
        (s) =>
          s.delivery_assurance === 'customer_confirmed' ||
          s.delivery_assurance === 'partner_verified',
      ).length,
      open_disputes: disputes.filter((d) => d.status !== 'resolved').length,
    },
    inputs: {
      obligations: obligations.filter(
        (o) => o.currency === query.currency && o.status === 'active',
      ),
      events: events.filter((e) => e.currency === query.currency),
      expenses: moneyExpenses,
      imported_outflows: importedOutflows,
    },
  };
}
export async function forecast(a: Access, input: unknown, asOf = day()) {
  const q = forecastSchema.parse(input),
    snapshot = await financialSnapshot(
      a,
      { currency: q.currency, from: addDays(asOf, -89), to: asOf },
      asOf,
    );
  const defaults = {
    expected: { collection: 9000, delay: 0, outflow: 10000 },
    optimistic: { collection: 10000, delay: 0, outflow: 9000 },
    conservative: { collection: 6500, delay: 14, outflow: 12000 },
    custom: {
      collection: q.collection_bps ?? 9000,
      delay: q.delay_days ?? 0,
      outflow: q.outflow_bps ?? 10000,
    },
  }[q.scenario];
  const points = Array.from({ length: q.horizon }, (_, i) => ({
    date: addDays(asOf, i + 1),
    inflow_minor: 0,
    outflow_minor: 0,
    net_movement_minor: 0,
    cumulative_net_movement_minor: 0,
  }));
  const add = (
    date: string,
    field: 'inflow_minor' | 'outflow_minor',
    value: number,
  ) => {
    const p = points.find((p) => p.date === date);
    if (p) p[field] += value;
  };
  const projectedInvoices = snapshot.invoices
    .filter((i) => i.outstanding_minor > 0)
    .map((i) => {
      const c = snapshot.customers.find((c) => c.customer_id === i.customer_id),
        delay = (c?.median_delay_days || 0) + defaults.delay;
      const expected = addDays(i.due_date, delay),
        date = expected <= asOf ? addDays(asOf, 1 + defaults.delay) : expected,
        amount = basisPoints(i.outstanding_minor,defaults.collection);
      add(date, 'inflow_minor', amount);
      return {
        invoice_id: i.id,
        customer_id: i.customer_id,
        expected_date: date,
        expected_receipt_minor: amount,
        outstanding_minor: i.outstanding_minor,
        delay_observations: c?.settled_invoice_count || 0,
      };
    });
  let recurring = 0;
  for (const o of snapshot.inputs.obligations) {
    let date =
        o.recurrence === 'once' && o.next_due_date <= asOf
          ? addDays(asOf, 1)
          : o.next_due_date,
      steps = 0;
    while (date <= points[points.length - 1].date && steps++ < 400) {
      if (date > asOf) {
        const amount = basisPoints(o.amount_minor,defaults.outflow);
        add(date, 'outflow_minor', amount);
        recurring += amount;
      }
      const next=nextOccurrence(date,o.recurrence,o.anchor_day||Number(o.next_due_date.slice(8)));if(!next)break;date=next;
    }
  }
  // Non-invoice collections only: never extrapolate the same invoice receipts twice.
  const invoiceIds = new Set(snapshot.invoices.map((i) => i.id)),
    requests = await dbAll(
      'SELECT id,document_id FROM ac_requests WHERE org_id=? AND environment=?',
      [a.org, a.environment],
    );
  const requestIds = new Set(
    requests.filter((r) => !invoiceIds.has(r.document_id)).map((r) => r.id),
  );
  const nonInvoice = snapshot.inputs.events.filter(
    (e) =>
      e.status === 'succeeded' &&
      requestIds.has(e.request_id) &&
      e.created_at.slice(0, 10) >= snapshot.period.from &&
      e.created_at.slice(0, 10) <= asOf,
  );
  const enough = snapshot.quality.history_days >= 30 && nonInvoice.length >= 5;
  const baseline = enough
    ? Math.round(
        ((sum(nonInvoice, 'amount_minor') /
          Math.min(90, Math.max(1, snapshot.quality.history_days))) *
          defaults.collection) /
          10000,
      )
    : 0;
  // Historical expense baseline excludes recurring categories to avoid counting rent etc twice.
  const coveredCategories = new Set(
    snapshot.inputs.obligations.map((o) => o.id),
  );
  const irregular = snapshot.inputs.expenses.filter(
    (e) => !coveredCategories.has(e.obligation_id),
  );
  const outflowBaseline =
    snapshot.quality.history_days >= 30
      ? Math.round(
          (((sum(irregular, 'amount_minor') +
            sum(snapshot.inputs.imported_outflows, 'amount_minor')) /
            Math.min(90, Math.max(1, snapshot.quality.history_days))) *
            defaults.outflow) /
            10000,
        )
      : 0;
  let cumulative = 0;
  for (const p of points) {
    p.inflow_minor += baseline;
    p.outflow_minor += outflowBaseline;
    p.net_movement_minor = p.inflow_minor - p.outflow_minor;
    cumulative += p.net_movement_minor;
    p.cumulative_net_movement_minor = cumulative;
  }
  return {
    currency: q.currency,
    environment: a.environment,
    classification: 'forecast_estimate',
    as_of: asOf,
    horizon: q.horizon,
    scenario: q.scenario,
    starting_balance_minor: null,
    projected_inflows_minor: sum(points, 'inflow_minor'),
    projected_outflows_minor: sum(points, 'outflow_minor'),
    estimated_net_movement_minor: cumulative,
    confidence:
      snapshot.quality.history_days >= 30 &&
      snapshot.customers.filter((c) => !c.limited_data).length
        ? 'moderate'
        : 'limited_data',
    confidence_interval: null,
    uncertainty:
      'Scenario assumptions, not statistical confidence intervals or guaranteed receipts.',
    assumptions: {
      collection_bps: defaults.collection,
      additional_delay_days: defaults.delay,
      outflow_bps: defaults.outflow,
      historical_window_days: Math.min(90, snapshot.quality.history_days),
      non_invoice_baseline_included: enough,
      recorded_obligations_minor: recurring,
      no_opening_balance: true,
    },
    quality: snapshot.quality,
    projected_invoices: projectedInvoices,
    series: points,
    actions: [
      ...(snapshot.quality.missing_expense_data
        ? ['Record expenses and upcoming obligations for a fuller picture.']
        : []),
      ...(snapshot.totals.overdue_minor > 0
        ? ['Review overdue invoices and customer follow-up.']
        : []),
      ...(points.some((p) => p.cumulative_net_movement_minor < 0)
        ? [
            'Projected recorded net movement is negative; review timing. This is not evidence of an actual bank shortfall.',
          ]
        : []),
    ],
  };
}
