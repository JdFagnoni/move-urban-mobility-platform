import type { ClientRequestArgs, OutgoingHttpHeaders } from "http";
import { Router } from "express";
import proxy from "express-http-proxy";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { logger } from "../middleware/logging";

const TRANSPORTATIONS_URL = process.env["TRANSPORTATIONS_URL"] ?? "http://localhost:3002";
const INTERNAL_GATEWAY_SECRET_ENV = "INTERNAL_GATEWAY_SECRET";
const TRANSPORTATIONS_PREFIX = "/transportations";

export const transportationsRouter = Router();

class TransportationsProxyError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getInternalGatewaySecret(): string | null {
  const value = process.env[INTERNAL_GATEWAY_SECRET_ENV]?.trim();
  return value || null;
}

function getRequiredInternalGatewaySecret(): string {
  const value = getInternalGatewaySecret();
  if (!value) {
    throw new TransportationsProxyError(503, "Transportations gateway is not configured");
  }
  return value;
}

function ensureTransportationsGatewayConfiguration(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (getInternalGatewaySecret()) {
    next();
    return;
  }

  logger.error({
    event: "transportations_proxy_configuration_missing",
    path: res.req.originalUrl,
    method: res.req.method,
    envVar: INTERNAL_GATEWAY_SECRET_ENV,
  });
  res.status(503).json({ success: false, error: "Transportations gateway is not configured" });
}

const forwardIdentityHeaders = (proxyReqOpts: ClientRequestArgs, srcReq: Request) => {
  const claims = srcReq.user;
  if (!claims) {
    return proxyReqOpts;
  }

  const headers: OutgoingHttpHeaders = {};
  if (proxyReqOpts.headers && !Array.isArray(proxyReqOpts.headers)) {
    Object.assign(headers, proxyReqOpts.headers);
  }
  headers["x-auth-subject"] = claims.sub;
  headers["x-internal-gateway-secret"] = getRequiredInternalGatewaySecret();
  proxyReqOpts.headers = headers;
  return proxyReqOpts;
};

function getProxyError(error: unknown): TransportationsProxyError {
  if (error instanceof TransportationsProxyError) {
    return error;
  }
  return new TransportationsProxyError(503, "Transportations service unavailable");
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: String(error) };
}

function transportationsProxy(options?: { forwardIdentity?: boolean }) {
  return proxy(TRANSPORTATIONS_URL, {
    proxyErrorHandler: (error, res) => {
      const request = res.req;
      const proxyError = getProxyError(error);
      logger.error({
        event: "transportations_proxy_error",
        method: request.method,
        path: request.originalUrl,
        status: proxyError.statusCode,
        error: proxyError.message,
        details: serializeError(error),
      });
      res.status(proxyError.statusCode).json({ success: false, error: proxyError.message });
    },
    proxyReqOptDecorator: options?.forwardIdentity ? forwardIdentityHeaders : undefined,
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace(new RegExp(`^${TRANSPORTATIONS_PREFIX}`), ""),
  });
}

function mountProtectedRoute(path: string): void {
  transportationsRouter.use(
    path,
    ensureTransportationsGatewayConfiguration,
    authenticate,
    transportationsProxy({ forwardIdentity: true })
  );
}

// Vehicles — GET list is public for the geo monitoring UI (F15), write operations require auth
transportationsRouter.get("/vehicles", transportationsProxy());
mountProtectedRoute("/vehicles");

// Zones — GET is public, write operations require auth
transportationsRouter.get("/zones", transportationsProxy());
transportationsRouter.get("/zones/:id", transportationsProxy());
transportationsRouter.post(
  "/zones",
  ensureTransportationsGatewayConfiguration,
  authenticate,
  transportationsProxy({ forwardIdentity: true })
);
transportationsRouter.patch(
  "/zones/:id",
  ensureTransportationsGatewayConfiguration,
  authenticate,
  transportationsProxy({ forwardIdentity: true })
);
transportationsRouter.delete(
  "/zones/:id",
  ensureTransportationsGatewayConfiguration,
  authenticate,
  transportationsProxy({ forwardIdentity: true })
);

// Monitoring read endpoints — public for the geo monitoring UI (F15)
transportationsRouter.get("/gps/latest-positions", transportationsProxy());
transportationsRouter.get("/gps/vehicle/:vehicleId/latest", transportationsProxy());
transportationsRouter.get("/alerts", transportationsProxy());
transportationsRouter.get("/trips", transportationsProxy());

// Catch-all for existing routes (trips, gps, alerts, operator)
mountProtectedRoute("/");
