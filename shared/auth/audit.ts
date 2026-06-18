import { randomUUID } from "crypto";
import type { AuthAuditDecision, AuthAuditEventType, ClientType, UserRole } from "../types";
import type { RequestContext } from "../http/request-context";
import { AuthAuditLogModel } from "./audit-model";

export interface RecordAuditLogInput extends Partial<RequestContext> {
  eventType: AuthAuditEventType;
  decision: AuthAuditDecision;
  userId?: string | null | undefined;
  authSubject?: string | null | undefined;
  email?: string | null | undefined;
  role?: UserRole | null | undefined;
  clientType?: ClientType | null | undefined;
  statusCode?: number | null | undefined;
  reason?: string | null | undefined;
  metadata?: Record<string, unknown>;
}

export async function recordAuthAuditLog(input: RecordAuditLogInput): Promise<void> {
  await AuthAuditLogModel.create({
    id: randomUUID(),
    eventType: input.eventType,
    decision: input.decision,
    userId: input.userId ?? null,
    authSubject: input.authSubject ?? null,
    email: input.email?.toLowerCase() ?? null,
    role: input.role ?? null,
    clientType: input.clientType ?? null,
    method: input.method ?? null,
    path: input.path ?? null,
    statusCode: input.statusCode ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    correlationId: input.correlationId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}
