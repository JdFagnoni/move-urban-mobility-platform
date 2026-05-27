import type { ClientRequestArgs, OutgoingHttpHeaders } from "http";
import { Router, type Request } from "express";
import proxy from "express-http-proxy";
import { authenticate } from "../middleware/auth";

const RESERVATIONS_URL = process.env["RESERVATIONS_URL"] ?? "http://localhost:3001";

export const reservationsRouter = Router();
const RESERVATIONS_PREFIX = "/reservations";

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

function reservationsProxy(options?: { forwardIdentity?: boolean }) {
  return proxy(RESERVATIONS_URL, {
    proxyReqOptDecorator: options?.forwardIdentity ? forwardIdentityHeaders : undefined,
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace(new RegExp(`^${RESERVATIONS_PREFIX}`), ""),
  });
}

function mountProtectedRoute(path: string): void {
  reservationsRouter.use(path, authenticate, reservationsProxy({ forwardIdentity: true }));
}

reservationsRouter.get("/health", reservationsProxy());
reservationsRouter.post("/auth/register", reservationsProxy());
mountProtectedRoute("/reservations");
reservationsRouter.use("/categories", reservationsProxy());
mountProtectedRoute("/vehicles");
reservationsRouter.use("/zones", reservationsProxy());
mountProtectedRoute("/auth/me");
mountProtectedRoute("/auth/audit-logs");
mountProtectedRoute("/users");
