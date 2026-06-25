export interface RequestContext {
  method: string;
  path: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
  correlationId: string | undefined;
}

export interface RequestContextSource {
  method: string;
  originalUrl: string;
  ip: string | undefined;
  headers: Record<string, string | string[] | undefined>;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getRequestContext(req: RequestContextSource): RequestContext {
  const correlationId = firstHeaderValue(req.headers["x-correlation-id"]);
  const userAgent = firstHeaderValue(req.headers["user-agent"]);

  return {
    method: req.method,
    path: req.originalUrl,
    ipAddress: req.ip,
    userAgent,
    correlationId,
  };
}
