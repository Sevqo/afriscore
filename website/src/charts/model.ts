export function isIsoDate(value: string) {
  const d = new Date(value + "T00:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === value
  );
}
export type ChartPoint = { date: string; [key: string]: string | number };
export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
};
export type ChartRange = "7D" | "30D" | "90D" | "YTD" | "1Y" | "ALL";
export function selectRange(
  points: ChartPoint[],
  range: ChartRange,
  forecast = false,
): ChartPoint[] {
  const sorted = [...points]
    .filter((p) => isIsoDate(p.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length || range === "ALL") return sorted;
  if (forecast) return sorted.slice(0, Number.parseInt(range) || sorted.length);
  const end = new Date(sorted.at(-1)!.date + "T00:00:00Z");
  const start =
    range === "YTD"
      ? new Date(Date.UTC(end.getUTCFullYear(), 0, 1))
      : new Date(
          end.getTime() -
            ((range === "1Y" ? 365 : Number.parseInt(range)) - 1) * 86400000,
        );
  return sorted.filter((p) => p.date >= start.toISOString().slice(0, 10));
}
export function chartDomain(
  points: ChartPoint[],
  keys: string[],
): [number, number] {
  const values = points.flatMap((p) =>
    keys.map((k) => Number(p[k])).filter(Number.isFinite),
  );
  let min = Math.min(0, ...values),
    max = Math.max(0, ...values);
  if (max === min) {
    min = 0;
    max = 1;
  } else {
    const pad = (max - min) * 0.12;
    if (min < 0) min -= pad;
    if (max > 0) max += pad;
  }
  return [min, max];
}
export function nearestPoint(
  clientX: number,
  left: number,
  width: number,
  count: number,
  dates?: string[],
) {
  if (count < 2 || width <= 0) return 0;
  // SVG plot starts 84 units into a 900-unit viewBox and ends at 874.
  const fraction = (((clientX - left) / width) * 900 - 84) / 790;
  if (dates?.length === count) {
    const first = Date.parse(dates[0]),
      last = Date.parse(dates[count - 1]);
    const target = first + Math.max(0, Math.min(1, fraction)) * (last - first);
    return dates.reduce(
      (best, date, i) =>
        Math.abs(Date.parse(date) - target) <
        Math.abs(Date.parse(dates[best]) - target)
          ? i
          : best,
      0,
    );
  }
  return Math.max(0, Math.min(count - 1, Math.round(fraction * (count - 1))));
}
export function groupDatedAmounts(
  records: any[],
  dateKey: string,
  valueKey: string,
): ChartPoint[] {
  const days = new Map<string, number>();
  for (const row of records) {
    const raw = String(row[dateKey] || "");
    const stamp = raw.length > 10 ? new Date(raw) : null;
    const date =
        stamp && Number.isFinite(stamp.getTime())
          ? new Intl.DateTimeFormat("en-CA", {
              timeZone: "Africa/Nairobi",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(stamp)
          : raw.slice(0, 10),
      value = Number(row[valueKey]);
    if (isIsoDate(date) && Number.isFinite(value))
      days.set(date, (days.get(date) || 0) + value);
  }
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export function rangeAvailable(
  points: ChartPoint[],
  range: ChartRange,
  forecast = false,
) {
  if (range === "ALL") return true;
  const sorted = selectRange(points, "ALL");
  if (!sorted.length) return false;
  const first = sorted[0].date,
    last = sorted.at(-1)!.date;
  if (range === "YTD") return first <= last.slice(0, 4) + "-01-01";
  const days = forecast
    ? sorted.length
    : Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1;
  return days >= (range === "1Y" ? 365 : Number.parseInt(range));
}
