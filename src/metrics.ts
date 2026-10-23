import type { Request, Response, NextFunction } from "express";

/**
 * Minimal, dependency-free Prometheus-style metrics.
 *
 * In-process only: counters reset on restart and are per-instance. Enough to
 * answer "is this instance healthy / which routes are hot / what is the
 * latency" until a real metrics pipeline (OpenTelemetry/Prometheus) is added.
 */

interface DurationBucket {
  count: number;
  sumMs: number;
}

interface MetricsState {
  requests: Map<string, number>;
  durations: Map<string, DurationBucket>;
  inFlight: number;
  startedAt: number;
}

const state: MetricsState = {
  requests: new Map(),
  durations: new Map(),
  inFlight: 0,
  startedAt: Date.now(),
};

function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  state.inFlight++;
  const started = process.hrtime.bigint();

  res.on("finish", () => {
    state.inFlight = Math.max(0, state.inFlight - 1);
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const routeKey = `${req.method}|${statusClass(res.statusCode)}`;

    state.requests.set(routeKey, (state.requests.get(routeKey) ?? 0) + 1);
    const bucket = state.durations.get(routeKey) ?? { count: 0, sumMs: 0 };
    bucket.count += 1;
    bucket.sumMs += durationMs;
    state.durations.set(routeKey, bucket);
  });

  next();
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderMetrics(): string {
  const lines: string[] = [
    "# HELP afriscore_http_requests_total Total HTTP requests by method and status class.",
    "# TYPE afriscore_http_requests_total counter",
  ];

  for (const [key, count] of [...state.requests.entries()].sort()) {
    const [method, status] = key.split("|");
    lines.push(`afriscore_http_requests_total{method="${escapeLabel(method)}",status="${escapeLabel(status)}"} ${count}`);
  }

  lines.push("# HELP afriscore_http_request_duration_ms HTTP request duration in milliseconds.");
  lines.push("# TYPE afriscore_http_request_duration_ms summary");
  for (const [key, bucket] of [...state.durations.entries()].sort()) {
    const [method, status] = key.split("|");
    const labels = `method="${escapeLabel(method)}",status="${escapeLabel(status)}"`;
    lines.push(`afriscore_http_request_duration_ms_sum{${labels}} ${bucket.sumMs.toFixed(3)}`);
    lines.push(`afriscore_http_request_duration_ms_count{${labels}} ${bucket.count}`);
  }

  lines.push("# HELP afriscore_http_requests_in_flight Requests currently being processed.");
  lines.push("# TYPE afriscore_http_requests_in_flight gauge");
  lines.push(`afriscore_http_requests_in_flight ${state.inFlight}`);

  lines.push("# HELP afriscore_process_uptime_seconds Process uptime in seconds.");
  lines.push("# TYPE afriscore_process_uptime_seconds gauge");
  lines.push(`afriscore_process_uptime_seconds ${((Date.now() - state.startedAt) / 1000).toFixed(1)}`);

  return lines.join("\n") + "\n";
}

/** Test helper. */
export function resetMetrics(): void {
  state.requests.clear();
  state.durations.clear();
  state.inFlight = 0;
  state.startedAt = Date.now();
}
