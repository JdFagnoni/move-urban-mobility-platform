import type { NextFunction, Request, Response } from "express";
import type { UserDTO, UserRole } from "../types";
import { HttpError } from "../http/errors";
import { getRequestContext } from "../http/request-context";
import { query } from "../db/pool";
import { recordAuthAuditLog } from "./audit";

export interface AuthenticatedRequestUser {
  profile: UserDTO;
}

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUser?: AuthenticatedRequestUser;
  }
}

export interface CreateAuthenticateConfig {
  onAuthenticated?: (user: UserDTO) => Promise<void> | void;
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

function getInternalGatewaySecret(): string | null {
  const value = process.env["INTERNAL_GATEWAY_SECRET"]?.trim();
  return value || null;
}

interface UserRow {
  id: string;
  auth_provider: string;
  auth_subject: string;
  email: string;
  name: string;
  role: string;
  client_type: string | null;
  status: string;
  phone: string | null;
  document_type: string | null;
  document_number: string | null;
  company_name: string | null;
  tax_id: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUserDTO(row: UserRow): UserDTO {
  const dto: UserDTO = {
    id: row.id,
    authProvider: row.auth_provider as UserDTO["authProvider"],
    authSubject: row.auth_subject,
    email: row.email,
    name: row.name,
    role: row.role as UserDTO["role"],
    status: row.status as UserDTO["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.client_type !== null) dto.clientType = row.client_type as NonNullable<UserDTO["clientType"]>;
  if (row.phone !== null) dto.phone = row.phone;
  if (row.document_type !== null) dto.documentType = row.document_type;
  if (row.document_number !== null) dto.documentNumber = row.document_number;
  if (row.company_name !== null) dto.companyName = row.company_name;
  if (row.tax_id !== null) dto.taxId = row.tax_id;
  if (row.last_login_at !== null) dto.lastLoginAt = row.last_login_at;
  return dto;
}

async function getUserByAuthSubject(authSubject: string): Promise<UserDTO | null> {
  const result = await query<UserRow>(
    "SELECT * FROM users WHERE auth_subject = $1 LIMIT 1",
    [authSubject]
  );
  const row = result.rows[0];
  return row ? rowToUserDTO(row) : null;
}

export function createAuthenticate(config?: CreateAuthenticateConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = getRequestContext(req);
    const internalGatewaySecret = getInternalGatewaySecret();
    const gatewaySecret = getGatewaySecretHeader(req);
    const authSubject = getAuthSubjectHeader(req);

    if (!internalGatewaySecret) {
      await recordAuthAuditLog({
        ...context,
        eventType: "access_denied",
        decision: "denied",
        statusCode: 503,
        reason: "Internal gateway secret is not configured",
        metadata: { stage: "service" },
      });
      res.status(503).json({ success: false, error: "Authentication service unavailable" });
      return;
    }

    if (gatewaySecret !== internalGatewaySecret) {
      await recordAuthAuditLog({
        ...context,
        eventType: "access_denied",
        decision: "denied",
        statusCode: 401,
        reason: "Invalid gateway authentication context",
        metadata: { stage: "service" },
      });
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    if (!authSubject) {
      await recordAuthAuditLog({
        ...context,
        eventType: "access_denied",
        decision: "denied",
        statusCode: 401,
        reason: "Missing gateway authentication context",
        metadata: { stage: "service" },
      });
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    try {
      const user = await getUserByAuthSubject(authSubject);

      if (!user) {
        await recordAuthAuditLog({
          ...context,
          eventType: "access_denied",
          decision: "denied",
          statusCode: 403,
          authSubject,
          reason: "Authenticated subject is not registered in MOVE",
          metadata: { stage: "service" },
        });
        res.status(403).json({ success: false, error: "User is not registered" });
        return;
      }

      if (user.status !== "active") {
        await recordAuthAuditLog({
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
          metadata: { stage: "service" },
        });
        res.status(403).json({ success: false, error: "User is not active" });
        return;
      }

      const auditPromise = recordAuthAuditLog({
        ...context,
        eventType: "token_accepted",
        decision: "authorized",
        statusCode: 200,
        userId: user.id,
        authSubject: user.authSubject,
        email: user.email,
        role: user.role,
        clientType: user.clientType,
        reason: "Gateway identity authorized",
        metadata: { stage: "service" },
      });

      if (config?.onAuthenticated) {
        await Promise.all([auditPromise, config.onAuthenticated(user)]);
      } else {
        await auditPromise;
      }

      req.authenticatedUser = { profile: user };
      next();
    } catch (error) {
      const message =
        error instanceof HttpError ? error.message : "Gateway authentication context is invalid";
      await recordAuthAuditLog({
        ...context,
        eventType: "access_denied",
        decision: "denied",
        statusCode: 401,
        authSubject,
        reason: message,
        metadata: { stage: "service" },
      });
      res.status(401).json({ success: false, error: "Authentication required" });
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.authenticatedUser?.profile;
    if (!user) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    if (!roles.includes(user.role)) {
      await recordAuthAuditLog({
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
        metadata: { stage: "service" },
      });
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    next();
  };
}
