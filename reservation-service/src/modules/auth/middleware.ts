import type { NextFunction, Request, Response } from "express";
import type { UserDTO, UserRole } from "@move/shared";
import { getRequestContext } from "@move/shared";
import { verifyAccessToken, type OidcClaims } from "./oidc";
import { recordAuditLog } from "./audit";
import { getUserByAuthSubject, touchLastLogin } from "../users/service";

export interface AuthenticatedRequestUser {
  claims: OidcClaims;
  profile: UserDTO;
}

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUser?: AuthenticatedRequestUser;
  }
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const context = getRequestContext(req);
  const token = getBearerToken(req);

  if (!token) {
    await recordAuditLog({
      ...context,
      eventType: "token_rejected",
      decision: "denied",
      statusCode: 401,
      reason: "Missing bearer token",
    });
    res.status(401).json({ success: false, error: "Missing bearer token" });
    return;
  }

  try {
    const claims = await verifyAccessToken(token);
    const user = await getUserByAuthSubject(claims.sub);

    if (!user) {
      await recordAuditLog({
        ...context,
        eventType: "access_denied",
        decision: "denied",
        statusCode: 403,
        authSubject: claims.sub,
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

    req.authenticatedUser = { claims, profile: user };
    await touchLastLogin(user.id);
    await recordAuditLog({
      ...context,
      eventType: "token_accepted",
      decision: "authorized",
      statusCode: 200,
      userId: user.id,
      authSubject: user.authSubject,
      email: user.email,
      role: user.role,
      clientType: user.clientType,
    });
    next();
  } catch (error) {
    await recordAuditLog({
      ...context,
      eventType: "token_rejected",
      decision: "denied",
      statusCode: 401,
      reason: error instanceof Error ? error.message : "Invalid token",
    });
    res.status(401).json({ success: false, error: "Invalid token" });
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
