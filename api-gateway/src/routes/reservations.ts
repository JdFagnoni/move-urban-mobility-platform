import type { ClientRequestArgs, OutgoingHttpHeaders } from "http";
import { Router, type NextFunction, type Request, type Response } from "express";
import proxy from "express-http-proxy";
import { authenticate } from "../middleware/auth";
import { logger } from "../middleware/logging";

const RESERVATIONS_URL = process.env["RESERVATIONS_URL"] ?? "http://localhost:3001";
const INTERNAL_GATEWAY_SECRET_ENV = "INTERNAL_GATEWAY_SECRET";
const RESERVATIONS_GATEWAY_CONFIG_ERROR = "Reservations gateway is not configured";
const RESERVATIONS_SERVICE_UNAVAILABLE_ERROR = "Reservations service unavailable";

export const reservationsRouter = Router();
export const webhooksRouter = Router();
const RESERVATIONS_PREFIX = "/reservations";

class ReservationsProxyError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
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

function reservationsProxy(options?: { forwardIdentity?: boolean; parseRequestBody?: boolean }) {
  return proxy(RESERVATIONS_URL, {
    parseReqBody: options?.parseRequestBody ?? true,
    proxyErrorHandler: (error, res) => {
      const request = res.req;
      const proxyError = getProxyError(error);
      logger.error({
        event: "reservations_proxy_error",
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
      req.originalUrl.replace(new RegExp(`^${RESERVATIONS_PREFIX}`), ""),
  });
}

function mountProtectedRoute(path: string): void {
  reservationsRouter.use(
    path,
    ensureReservationsGatewayConfiguration,
    authenticate,
    reservationsProxy({ forwardIdentity: true })
  );
}

reservationsRouter.get("/health", reservationsProxy());
reservationsRouter.post("/auth/register", reservationsProxy());
mountProtectedRoute("/reservations");
reservationsRouter.use("/categories", reservationsProxy());
mountProtectedRoute("/preregistrations");
reservationsRouter.use("/vehicles", reservationsProxy());
// GET /zones is public so F15 geofencing can consume it without auth
reservationsRouter.get("/zones", reservationsProxy());
reservationsRouter.get("/zones/:id", reservationsProxy());
reservationsRouter.post("/zones", authenticate, reservationsProxy({ forwardIdentity: true }));
reservationsRouter.patch("/zones/:id", authenticate, reservationsProxy({ forwardIdentity: true }));
reservationsRouter.delete("/zones/:id", authenticate, reservationsProxy({ forwardIdentity: true }));
mountProtectedRoute("/vehicles");
reservationsRouter.use("/zones", reservationsProxy());
mountProtectedRoute("/auth/me");
mountProtectedRoute("/auth/audit-logs");
mountProtectedRoute("/users");

webhooksRouter.post("/stripe", reservationsProxy({ parseRequestBody: false }));

export function validateReservationsProxyConfiguration(): void {
  if (getInternalGatewaySecret()) {
    return;
  }

  logger.error({
    event: "reservations_proxy_configuration_invalid",
    envVar: INTERNAL_GATEWAY_SECRET_ENV,
    message: `${INTERNAL_GATEWAY_SECRET_ENV} is not configured; protected reservations routes will return 503`,
  });
}

function ensureReservationsGatewayConfiguration(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (getInternalGatewaySecret()) {
    next();
    return;
  }

  logger.error({
    event: "reservations_proxy_configuration_missing",
    path: res.req.originalUrl,
    method: res.req.method,
    envVar: INTERNAL_GATEWAY_SECRET_ENV,
  });
  res.status(503).json({ success: false, error: RESERVATIONS_GATEWAY_CONFIG_ERROR });
}

function getInternalGatewaySecret(): string | null {
  const value = process.env[INTERNAL_GATEWAY_SECRET_ENV]?.trim();
  return value || null;
}

function getRequiredInternalGatewaySecret(): string {
  const value = getInternalGatewaySecret();
  if (!value) {
    throw new ReservationsProxyError(503, RESERVATIONS_GATEWAY_CONFIG_ERROR);
  }

  return value;
}

function getProxyError(error: unknown): ReservationsProxyError {
  if (error instanceof ReservationsProxyError) {
    return error;
  }

  return new ReservationsProxyError(503, RESERVATIONS_SERVICE_UNAVAILABLE_ERROR);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: String(error) };
}
