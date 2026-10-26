import { useEffect, useRef, useState } from "react";
import { InteractiveChart, financialSeries } from "./InteractiveChart";
import { groupDatedAmounts } from "./model";
export function FinancialActivity({
  load,
  scope,
  currency,
}: {
  load: (path: string) => Promise<any>;
  scope: string;
  currency: string;
}) {
  const loader = useRef(load);
  loader.current = load;
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    loader
      .current("/intelligence?currency=" + encodeURIComponent(currency))
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, currency, retry]);
  return (
    <section className="panel activity-panel">
      {error ? (
        <div role="status">
          <h2>Activity chart unavailable</h2>
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => setRetry(retry + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        <InteractiveChart
          title="Financial activity"
          points={(data?.series?.some(
            (p: any) => p.confirmed_inflows_minor || p.recorded_outflows_minor,
          )
            ? data.series
            : []
          ).map((p: any) => ({
            date: p.date,
            inflows: p.confirmed_inflows_minor,
            outflows: p.recorded_outflows_minor,
            net: p.confirmed_inflows_minor - p.recorded_outflows_minor,
          }))}
          series={financialSeries}
          currency={currency}
          loading={!data}
          description="Confirmed payment events and recorded outflows, kept in one currency. This shows movement in covered records, not a bank balance or profit."
        />
      )}
    </section>
  );
}
export function RecordAnalytics({
  records,
  kind,
}: {
  records: any[];
  kind: "payments" | "invoices";
}) {
  const currencies = [
    ...new Set(records.map((r) => r.currency).filter(Boolean)),
  ] as string[];
  const [chosen, setChosen] = useState("KES");
  const currency = currencies.includes(chosen) ? chosen : currencies[0];
  if (!currency) return null;
  const rows = records.filter((r) => r.currency === currency),
    key = kind === "payments" ? "amount_minor" : "total_minor";
  const states = [...new Set(rows.map((r) => r.status || "unknown"))];
  return (
    <section className="panel record-analytics">
      <label className="analytics-currency">
        Chart currency
        <select value={currency} onChange={(e) => setChosen(e.target.value)}>
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <InteractiveChart
        title={
          kind === "payments" ? "Payment requests created" : "Invoices created"
        }
        points={groupDatedAmounts(rows, "created_at", key)}
        series={[
          {
            key: "value",
            label:
              kind === "payments" ? "Requested amount" : "Invoice face value",
            color: "#426900",
          },
        ]}
        currency={currency}
        description={
          kind === "payments"
            ? "Amounts requested, not confirmed receipts or settlement. Only loaded payment requests are included."
            : "Face value on the creation date, not cash received. This is a view of loaded invoices, not historical outstanding balances."
        }
      />
      <div className="status-breakdown" aria-label="Current record statuses">
        {states.map((state) => {
          const count = rows.filter(
            (r) => (r.status || "unknown") === state,
          ).length;
          return (
            <div key={state}>
              <span>{state.replaceAll("_", " ")}</span>
              <div>
                <i style={{ width: (count / rows.length) * 100 + "%" }} />
              </div>
              <strong>
                {count} of {rows.length}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export function ReconciliationOverview({ data }: { data: any }) {
  const rows = [
    [
      "Confirmed allocations",
      data?.allocations?.length || 0,
      "Allocations associate trusted payment amounts with documents.",
    ],
    [
      "Pending review",
      (data?.exceptions || []).filter((r: any) => r.status === "pending_review")
        .length,
      "These exception records need a documented review; do not force them into a match.",
    ],
    [
      "Reviewed exceptions",
      (data?.exceptions || []).filter((r: any) => r.status !== "pending_review")
        .length,
      "Review history is retained alongside the original financial event.",
    ],
  ] as const;
  const [selected, setSelected] = useState(0),
    max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className="panel reconciliation-overview">
      <h2>Matching and review</h2>
      <p>
        Counts of loaded records. Allocations and exceptions are different
        record types and are not parts of a shared total.
      </p>
      <div className="review-bars">
        {rows.map(([label, count], i) => (
          <button
            key={label}
            type="button"
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <span>{label}</span>
            <i>
              <b style={{ width: (count / max) * 100 + "%" }} />
            </i>
            <strong>{count}</strong>
          </button>
        ))}
      </div>
      <p role="status">{rows[selected][2]}</p>
    </section>
  );
}
