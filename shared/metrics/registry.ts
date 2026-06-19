type ExternalCallOutcome = "success" | "error" | "timeout";

interface RouteCounter {
  count: number;
  totalDurationMs: number;
  statusCodes: Record<string, number>;
}

interface ExternalCallCounter {
  success: number;
  error: number;
  timeout: number;
  totalDurationMs: number;
}

export interface MetricsSnapshot {
  uptimeSeconds: number;
  requestsByRoute: Record<
    string,
    { count: number; avgDurationMs: number; statusCodes: Record<string, number> }
  >;
  externalCalls: Record<
    string,
    { success: number; error: number; timeout: number; avgDurationMs: number }
  >;
}

const startedAt = Date.now();
const requestsByRoute = new Map<string, RouteCounter>();
const externalCalls = new Map<string, ExternalCallCounter>();

export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
): void {
  const key = `${method} ${route}`;
  const counter = requestsByRoute.get(key) ?? { count: 0, totalDurationMs: 0, statusCodes: {} };
  counter.count += 1;
  counter.totalDurationMs += durationMs;
  const statusKey = String(statusCode);
  counter.statusCodes[statusKey] = (counter.statusCodes[statusKey] ?? 0) + 1;
  requestsByRoute.set(key, counter);
}

export function recordExternalCall(
  provider: string,
  outcome: ExternalCallOutcome,
  durationMs: number
): void {
  const counter = externalCalls.get(provider) ?? {
    success: 0,
    error: 0,
    timeout: 0,
    totalDurationMs: 0,
  };
  counter[outcome] += 1;
  counter.totalDurationMs += durationMs;
  externalCalls.set(provider, counter);
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const requestsSnapshot: MetricsSnapshot["requestsByRoute"] = {};
  for (const [key, counter] of requestsByRoute) {
    requestsSnapshot[key] = {
      count: counter.count,
      avgDurationMs: Math.round(counter.totalDurationMs / counter.count),
      statusCodes: counter.statusCodes,
    };
  }

  const externalCallsSnapshot: MetricsSnapshot["externalCalls"] = {};
  for (const [provider, counter] of externalCalls) {
    const total = counter.success + counter.error + counter.timeout;
    externalCallsSnapshot[provider] = {
      success: counter.success,
      error: counter.error,
      timeout: counter.timeout,
      avgDurationMs: total > 0 ? Math.round(counter.totalDurationMs / total) : 0,
    };
  }

  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    requestsByRoute: requestsSnapshot,
    externalCalls: externalCallsSnapshot,
  };
}
