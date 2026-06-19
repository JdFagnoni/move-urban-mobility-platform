import type { NextFunction, Request, Response } from "express";
import { recordHttpRequest } from "../metrics/registry";

export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    recordHttpRequest(req.method, resolveRoute(req), res.statusCode, Date.now() - start);
  });
  next();
}

// express-http-proxy mounts via router.use(path, ...), which never sets req.route, so the
// baseUrl (the matched mount prefix) is the best available stand-in for those proxied routes.
function resolveRoute(req: Request): string {
  if (req.route?.path) {
    const routePath = req.route.path === "/" ? "" : (req.route.path as string);
    return `${req.baseUrl}${routePath}` || "/";
  }
  return req.baseUrl || req.path;
}
