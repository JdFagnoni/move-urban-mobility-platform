import { randomUUID } from "crypto";
import type {
  AuthAuditDecision,
  AuthAuditEventType,
  AuthAuditLogDTO,
  ClientType,
  ListAuthAuditLogsQueryDTO,
  PaginatedResult,
  UserRole,
} from "@move/shared";
import { query, type RequestContext } from "@move/shared";

interface AuditLogRow {
  id: string;
  occurred_at: Date | string;
  event_type: AuthAuditEventType;
  decision: AuthAuditDecision;
  user_id: string | null;
  auth_subject: string | null;
  email: string | null;
  role: UserRole | null;
  client_type: ClientType | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

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

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapAuditLogRow(row: AuditLogRow): AuthAuditLogDTO {
  return {
    id: row.id,
    occurredAt: toIsoString(row.occurred_at),
    eventType: row.event_type,
    decision: row.decision,
    userId: row.user_id,
    authSubject: row.auth_subject,
    email: row.email,
    role: row.role,
    clientType: row.client_type,
    method: row.method,
    path: row.path,
    statusCode: row.status_code,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    correlationId: row.correlation_id,
    reason: row.reason,
    metadata: row.metadata,
  };
}

export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  await query(
    `
      INSERT INTO auth_audit_logs (
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
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, lower($6), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)
    `,
    [
      randomUUID(),
      input.eventType,
      input.decision,
      input.userId ?? null,
      input.authSubject ?? null,
      input.email ?? null,
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
    ]
  );
}

export async function listAuditLogs(
  filters: ListAuthAuditLogsQueryDTO
): Promise<PaginatedResult<AuthAuditLogDTO>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.eventType) {
    params.push(filters.eventType);
    clauses.push(`event_type = $${params.length}`);
  }

  if (filters.email) {
    params.push(`%${filters.email.toLowerCase()}%`);
    clauses.push(`lower(email) LIKE $${params.length}`);
  }

  if (filters.userId) {
    params.push(filters.userId);
    clauses.push(`user_id = $${params.length}`);
  }

  if (filters.from) {
    params.push(filters.from);
    clauses.push(`occurred_at >= $${params.length}`);
  }

  if (filters.to) {
    params.push(filters.to);
    clauses.push(`occurred_at <= $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countResult = await query<{ total: string }>(
    `SELECT count(*) AS total FROM auth_audit_logs ${where}`,
    params
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  params.push(pageSize, offset);
  const result = await query<AuditLogRow>(
    `
      SELECT *
      FROM auth_audit_logs
      ${where}
      ORDER BY occurred_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return {
    data: result.rows.map(mapAuditLogRow),
    total,
    page,
    pageSize,
  };
}
