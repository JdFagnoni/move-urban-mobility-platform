import type { NextFunction, Request, Response } from "express";

function getConfiguredSecret(): string | null {
  const value = process.env["INTERNAL_GATEWAY_SECRET"]?.trim();
  return value || null;
}

export function requireInternalGatewaySecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const configuredSecret = getConfiguredSecret();
  if (!configuredSecret) {
    res.status(503).json({ success: false, error: "Internal gateway secret is not configured" });
    return;
  }

  const provided = req.headers["x-internal-gateway-secret"];
  if (typeof provided !== "string" || provided.trim() !== configuredSecret) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  next();
}
