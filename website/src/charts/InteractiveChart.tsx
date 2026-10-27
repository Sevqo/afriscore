import { useId, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import {
  chartDomain,
  nearestPoint,
  selectRange,
  rangeAvailable,
  type ChartPoint,
  type ChartRange,
  type ChartSeries,
} from "./model";
export const financialSeries: ChartSeries[] = [
  { key: "inflows", label: "Confirmed inflows", color: "#426900" },
  { key: "outflows", label: "Recorded outflows", color: "#595959" },
  { key: "net", label: "Net movement", color: "#985b20", dashed: true },
];
const format = (n: number, currency?: string) =>
  currency
    ? new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(
        n / (["UGX", "RWF"].includes(currency) ? 1 : 100),
      )
    : new Intl.NumberFormat("en-KE").format(n);
export function InteractiveChart({
  title,
  points,
  series,
  currency,
  forecast = false,
  description,
  loading = false,
  headingLevel = 2,
  asOfDate,
  compact = false,
}: {
  title: string;
  points: ChartPoint[];
  series: ChartSeries[];
  currency?: string;
  forecast?: boolean;
  description: string;
  loading?: boolean;
  headingLevel?: 2 | 3;
  asOfDate?: string;
  compact?: boolean;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const id = useId(),
    [range, setRange] = useState<ChartRange>("ALL"),
    [active, setActive] = useState<number | null>(null),
    [hidden, setHidden] = useState<string[]>([]);
  const shown = useMemo(
    () =>
      selectRange(
        points.filter((p) =>
          series.every((s) => Number.isFinite(Number(p[s.key]))),
        ),
        range,
        forecast,
        asOfDate,
      ),
    [points, range, forecast, series, asOfDate],
  );
  const visible = series.filter((s) => !hidden.includes(s.key));
  const [min, max] = chartDomain(
    shown,
    visible.map((s) => s.key),
  );
  const x = (i: number) =>
    shown.length < 2 || shown[0].date === shown.at(-1)!.date
      ? 479
      : 84 +
        ((Date.parse(shown[i].date) - Date.parse(shown[0].date)) /
          (Date.parse(shown.at(-1)!.date) - Date.parse(shown[0].date))) *
          790;
  const y = (n: number) => 24 + ((max - n) / (max - min)) * 226;
  const selected = shown.length
    ? shown[Math.min(active ?? shown.length - 1, shown.length - 1)]
    : null;
  const ranges: ChartRange[] = forecast
    ? ["7D", "30D", "90D", "ALL"]
    : ["7D", "30D", "90D", "YTD", "1Y", "ALL"];
  function choose(clientX: number, element: SVGSVGElement) {
    const r = element.getBoundingClientRect();
    setActive(
      nearestPoint(
        clientX,
        r.left,
        r.width,
        shown.length,
        shown.map((p) => p.date),
      ),
    );
  }
  return (
    <figure className="interactive-chart" aria-labelledby={id + "-title"}>
      <figcaption>
        <div>
          <span className="chart-context">
            {forecast
              ? "Scenario projection"
              : active === null
                ? "Totals for loaded range"
                : "Selected date"}
            {currency ? " · " + currency : ""}
          </span>
          <Heading id={id + "-title"}>{title}</Heading>
        </div>
        <span className="chart-date">
          {active === null && !forecast && shown.length
            ? shown[0].date + " – " + shown.at(-1)!.date
            : selected?.date || "No recorded dates"}
        </span>
      </figcaption>
      {(!compact||shown.length>0)&&<div className="chart-readout" aria-live="off">
        {visible.map((s) => (
          <div key={s.key}>
            <span>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
            <strong>
              {selected
                ? format(
                    active === null && !forecast
                      ? shown.reduce((sum, p) => sum + Number(p[s.key]), 0)
                      : Number(selected[s.key]),
                    currency,
                  )
                : "—"}
            </strong>
          </div>
        ))}
      </div>}
      <div
        className="chart-ranges"
        role="group"
        aria-label={forecast ? "Projection window" : "Chart time range"}
      >
        {ranges.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            disabled={!rangeAvailable(points, r, forecast)}
            title={
              rangeAvailable(points, r, forecast)
                ? "Filter loaded records"
                : "This complete time range is not loaded"
            }
            onClick={() => {
              setRange(r);
              setActive(null);
            }}
          >
            {r === "ALL" ? "ALL" : r}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="chart-loading" role="status">
          Loading recorded activity…
        </div>
      ) : !shown.length ? (
        <div className="chart-empty">
          <h4>No financial activity for this period</h4>
          <p>
            Choose another period or add a relevant record to this workspace.
          </p>
        </div>
      ) : (
        <>
          <div className="chart-plot">
            {active !== null && selected && (
              <div
                className="chart-tooltip"
                role="tooltip"
                aria-hidden="true"
                style={{
                  left:
                    "clamp(0px," +
                    (x(Math.min(active, shown.length - 1)) / 900) * 100 +
                    "%,calc(100% - 180px))",
                }}
              >
                <strong>{selected.date}</strong>
                {visible.map((s) => (
                  <span key={s.key}>
                    {s.label}: {format(Number(selected[s.key]), currency)}
                  </span>
                ))}
              </div>
            )}
            <svg
              viewBox="0 0 900 300"
              role="img"
              aria-label={
                title +
                ". " +
                shown.length +
                " dates. Use the chart explorer below or the data table for exact values."
              }
              onPointerMove={(e) => choose(e.clientX, e.currentTarget)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                choose(e.clientX, e.currentTarget);
              }}
              onPointerLeave={() => setActive(null)}
            >
              {[max, (max + min) / 2, min].map((n, i) => (
                <g key={i}>
                  <line
                    x1="84"
                    x2="874"
                    y1={y(n)}
                    y2={y(n)}
                    stroke="#dedede"
                    strokeDasharray="3 5"
                  />
                  <text x="72" y={y(n) + 4} textAnchor="end">
                    {new Intl.NumberFormat("en-KE", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(
                      currency
                        ? n / (["UGX", "RWF"].includes(currency) ? 1 : 100)
                        : n,
                    )}
                  </text>
                </g>
              ))}
              {min < 0 && max > 0 && (
                <line x1="84" x2="874" y1={y(0)} y2={y(0)} stroke="#aaa" />
              )}
              {visible.map((s) => (
                <g key={s.key}>
                  <path
                    d={shown
                      .map(
                        (p, i) =>
                          (i ? "L" : "M") + x(i) + "," + y(Number(p[s.key])),
                      )
                      .join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={s.dashed ? "7 5" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                  {shown.length === 1 && (
                    <circle
                      cx={x(0)}
                      cy={y(Number(shown[0][s.key]))}
                      r="5"
                      fill={s.color}
                    />
                  )}
                </g>
              ))}
              {active !== null && shown[active] && (
                <g>
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1="20"
                    y2="254"
                    stroke="#999"
                    strokeDasharray="3 4"
                  />
                  {visible.map((s) => (
                    <circle
                      key={s.key}
                      cx={x(active)}
                      cy={y(Number(shown[active][s.key]))}
                      r="5"
                      fill={s.color}
                      stroke="white"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              )}
              <text x="84" y="284">
                {shown[0].date}
              </text>
              <text x="874" y="284" textAnchor="end">
                {shown.at(-1)!.date}
              </text>
            </svg>
            <div className="chart-mobile-axis">
              <span>{shown[0].date}</span>
              <span>{shown.at(-1)!.date}</span>
            </div>
          </div>
          <label className="chart-explorer">
            Explore a date
            <input
              aria-label={"Explore " + title + " by date"}
              type="range"
              min="0"
              max={Math.max(0, shown.length - 1)}
              value={Math.min(active ?? shown.length - 1, shown.length - 1)}
              aria-valuetext={
                selected
                  ? selected.date +
                    ": " +
                    visible
                      .map(
                        (s) =>
                          s.label +
                          " " +
                          format(Number(selected[s.key]), currency),
                      )
                      .join(", ")
                  : ""
              }
              onChange={(e) => setActive(Number(e.target.value))}
            />
          </label>
        </>
      )}
      {(!compact||shown.length>0)&&<div
        className="chart-legend"
        role="group"
        aria-label="Visible chart series"
      >
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={!hidden.includes(s.key)}
            disabled={!hidden.includes(s.key) && visible.length === 1}
            onClick={() =>
              setHidden(
                hidden.includes(s.key)
                  ? hidden.filter((k) => k !== s.key)
                  : [...hidden, s.key],
              )
            }
          >
            <i style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>}
      <p className="chart-description">
        {shown.length === 1
          ? "Only one recorded date is available; it does not establish a trend. "
          : ""}
        {description}{" "}
        {forecast
          ? "Ranges show the first projected days."
          : "Ranges filter the loaded records and end on their latest date."}
      </p>
      <details className="chart-data">
        <summary>View exact data</summary>
        <div className="table-scroll">
          <DataTable>
            <thead>
              <tr>
                <th>Date</th>
                {series.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  {series.map((s) => (
                    <td key={s.key}>{format(Number(p[s.key]), currency)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </details>
    </figure>
  );
}
