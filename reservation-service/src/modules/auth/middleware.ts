import type { NextFunction, Request, Response } from "express";
import { HttpError, type UserDTO, type UserRole, getRequestContext } from "@move/shared";
import { recordAuditLog } from "./audit";
import { getUserByAuthSubject } from "../users/service";

const INTERNAL_GATEWAY_SECRET = getRequiredInternalGatewaySecret();

export interface AuthenticatedRequestUser {
  profile: UserDTO;
}

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUser?: AuthenticatedRequestUser;
  }
}

function getAuthSubjectHeader(req: Request): string | null {
  const header = req.headers["x-auth-subject"];
  if (typeof header !== "string") {
    return null;
  }

  const authSubject = header.trim();
  return authSubject || null;
}

function getGatewaySecretHeader(req: Request): string | null {
  const header = req.headers["x-internal-gateway-secret"];
  if (typeof header !== "string") {
    return null;
  }

  const secret = header.trim();
  return secret || null;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const context = getRequestContext(req);
  const gatewaySecret = getGatewaySecretHeader(req);
  const authSubject = getAuthSubjectHeader(req);

  if (gatewaySecret !== INTERNAL_GATEWAY_SECRET) {
    await recordAuditLog({
      ...context,
      eventType: "access_denied",
      decision: "denied",
      statusCode: 401,
      reason: "Invalid gateway authentication context",
    });
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  if (!authSubject) {
    await recordAuditLog({
      ...context,
      eventType: "access_denied",
      decision: "denied",
      statusCode: 401,
      reason: "Missing gateway authentication context",
    });
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  try {
    const user = await getUserByAuthSubject(authSubject);

    if (!user) {
      await recordAuditLog({
        ...context,
        eventType: "access_denied",
        decision: "denied",
        statusCode: 403,
        authSubject,
        reason: "Authenticated subject is not registered in MOVE",
      });
      res.status(403).json({ success: false, error: "User is not registered" });
      return;
    }

    if (user.status !== "active") {
      await recordAuditLog({
        ...context,
        eventType: "access_denied",
        decision: "denied",
        statusCode: 403,
        userId: user.id,
        authSubject: user.authSubject,
        email: user.email,
        role: user.role,
        clientType: user.clientType,
        reason: `User status is ${user.status}`,
      });
      res.status(403).json({ success: false, error: "User is not active" });
      return;
    }

    req.authenticatedUser = { profile: user };
    next();
  } catch (error) {
    const message =
      error instanceof HttpError ? error.message : "Gateway authentication context is invalid";
    await recordAuditLog({
      ...context,
      eventType: "access_denied",
      decision: "denied",
      statusCode: 401,
      authSubject,
      reason: message,
    });
    res.status(401).json({ success: false, error: "Authentication required" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.authenticatedUser?.profile;
    if (!user) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    if (!roles.includes(user.role)) {
      await recordAuditLog({
        ...getRequestContext(req),
        eventType: "access_denied",
        decision: "denied",
        statusCode: 403,
        userId: user.id,
        authSubject: user.authSubject,
        email: user.email,
        role: user.role,
        clientType: user.clientType,
        reason: `Role ${user.role} is not allowed`,
      });
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    next();
  };
}

function getRequiredInternalGatewaySecret(): string {
  const value = process.env["INTERNAL_GATEWAY_SECRET"];
  if (!value) {
    throw new Error("INTERNAL_GATEWAY_SECRET is not configured");
  }
  return value;
}
