import type { ClientRequestArgs, OutgoingHttpHeaders } from "http";
import { Router, type Request } from "express";
import proxy from "express-http-proxy";
import { authenticate } from "../middleware/auth";

const RESERVAS_URL =
  process.env["RESERVAS_SERVICE_URL"] ?? "http://localhost:3001";

export const reservasRouter = Router();
const RESERVAS_PREFIX = "/reservas";

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
  proxyReqOpts.headers = headers;
  return proxyReqOpts;
};

function reservasProxy(options?: { forwardIdentity?: boolean }) {
  return proxy(RESERVAS_URL, {
    proxyReqOptDecorator: options?.forwardIdentity ? forwardIdentityHeaders : undefined,
    proxyReqPathResolver: (req) => req.originalUrl.replace(new RegExp(`^${RESERVAS_PREFIX}`), ""),
  });
}

function mountProtectedRoute(path: string): void {
  reservasRouter.use(path, authenticate, reservasProxy({ forwardIdentity: true }));
}

reservasRouter.get("/health", reservasProxy());
reservasRouter.post("/auth/register", reservasProxy());
mountProtectedRoute("/reservations");
reservasRouter.use("/categories", reservasProxy());
reservasRouter.use("/vehicles", reservasProxy());
reservasRouter.use("/zones", reservasProxy());
mountProtectedRoute("/auth/me");
mountProtectedRoute("/auth/audit-logs");
mountProtectedRoute("/users");
