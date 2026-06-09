import { randomUUID } from "crypto";
import type {
  AuthAuditDecision,
  AuthAuditEventType,
  ClientType,
  RequestContext,
  UserRole,
} from "@move/shared";
import { query } from "@move/shared";

export interface GatewayAuditLogInput extends Partial<RequestContext> {
  eventType: AuthAuditEventType;
  decision: AuthAuditDecision;
  authSubject?: string | null | undefined;
  email?: string | null | undefined;
  role?: UserRole | null | undefined;
  clientType?: ClientType | null | undefined;
  statusCode?: number | null | undefined;
  reason?: string | null | undefined;
  metadata?: Record<string, unknown>;
}

export async function recordGatewayAuditLog(input: GatewayAuditLogInput): Promise<void> {
  try {
    await query(
      `INSERT INTO auth_audit_logs (
        id,
        event_type,
        decision,
        user_id,
        auth_subject,
        email,
        role,
        client_type,
        method,
        path,
        status_code,
        ip_address,
        user_agent,
        correlation_id,
        reason,
        metadata,
        occurred_at
      ) VALUES (
        $1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16
      )`,
      [
        randomUUID(),
        input.eventType,
        input.decision,
        input.authSubject ?? null,
        input.email?.toLowerCase() ?? null,
        input.role ?? null,
        input.clientType ?? null,
        input.method ?? null,
        input.path ?? null,
        input.statusCode ?? null,
        input.ipAddress ?? null,
        input.userAgent ?? null,
        input.correlationId ?? null,
        input.reason ?? null,
        JSON.stringify(input.metadata ?? {}),
        new Date(),
      ]
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "gateway_auth_audit_log_failed",
        auditEventType: input.eventType,
        decision: input.decision,
        statusCode: input.statusCode,
        reason: input.reason,
        error: serializeError(error),
      })
    );
  }
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
