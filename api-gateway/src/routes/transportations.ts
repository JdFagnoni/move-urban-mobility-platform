import type { ClientRequestArgs, OutgoingHttpHeaders } from "http";
import { Router } from "express";
import proxy from "express-http-proxy";
import type { Request } from "express";

const TRANSPORTATIONS_URL = process.env["TRANSPORTATIONS_URL"] ?? "http://localhost:3002";

export const transportationsRouter = Router();

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

transportationsRouter.use(
  "/",
  proxy(TRANSPORTATIONS_URL, {
    proxyReqOptDecorator: forwardIdentityHeaders,
  })
);
