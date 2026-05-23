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
import { type RequestContext } from "@move/shared";
import { Op, type WhereOptions } from "sequelize";
import { AuthAuditLogModel } from "../../db/models";

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

function mapAuditLog(row: AuthAuditLogModel): AuthAuditLogDTO {
  return {
    id: row.id,
    occurredAt: toIsoString(row.occurredAt),
    eventType: row.eventType,
    decision: row.decision,
    userId: row.userId,
    authSubject: row.authSubject,
    email: row.email,
    role: row.role,
    clientType: row.clientType,
    method: row.method,
    path: row.path,
    statusCode: row.statusCode,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    correlationId: row.correlationId,
    reason: row.reason,
    metadata: row.metadata,
  };
}

export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
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

export async function listAuditLogs(
  filters: ListAuthAuditLogsQueryDTO
): Promise<PaginatedResult<AuthAuditLogDTO>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const where: WhereOptions<AuthAuditLogModel> = {};

  if (filters.eventType) {
    where.eventType = filters.eventType;
  }

  if (filters.email) {
    where.email = { [Op.iLike]: `%${filters.email.toLowerCase()}%` };
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.from || filters.to) {
    where.occurredAt = filters.from && filters.to
      ? { [Op.between]: [new Date(filters.from), new Date(filters.to)] }
      : filters.from
        ? { [Op.gte]: new Date(filters.from) }
        : { [Op.lte]: new Date(filters.to as string) };
  }

  const result = await AuthAuditLogModel.findAndCountAll({
    where,
    order: [["occurred_at", "DESC"]],
    limit: pageSize,
    offset,
  });

  return {
    data: result.rows.map(mapAuditLog),
    total: result.count,
    page,
    pageSize,
  };
}
