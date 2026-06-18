import type { AuthAuditDecision, AuthAuditEventType, ClientType, UserRole } from "../types";
import { Column, CreatedAt, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";

const AUTH_AUDIT_EVENT_TYPES: readonly AuthAuditEventType[] = [
  "registration_success",
  "registration_failure",
  "token_accepted",
  "token_rejected",
  "access_denied",
  "status_changed",
  "profile_updated",
];

const AUTH_AUDIT_DECISIONS: readonly AuthAuditDecision[] = [
  "authorized",
  "denied",
  "failed",
  "success",
];

const USER_ROLES: readonly UserRole[] = ["admin", "operator", "client", "driver"];
const CLIENT_TYPES: readonly ClientType[] = ["individual", "company"];

@Table({
  tableName: "auth_audit_logs",
  timestamps: true,
  underscored: true,
  createdAt: "occurred_at",
  updatedAt: false,
})
export class AuthAuditLogModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.ENUM(...AUTH_AUDIT_EVENT_TYPES), allowNull: false })
  declare eventType: AuthAuditEventType;

  @Column({ type: DataType.ENUM(...AUTH_AUDIT_DECISIONS), allowNull: false })
  declare decision: AuthAuditDecision;

  @Column({ type: DataType.UUID, allowNull: true })
  declare userId: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare authSubject: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare email: string | null;

  @Column({ type: DataType.ENUM(...USER_ROLES), allowNull: true })
  declare role: UserRole | null;

  @Column({ type: DataType.ENUM(...CLIENT_TYPES), allowNull: true })
  declare clientType: ClientType | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare method: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare path: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare statusCode: number | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare ipAddress: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare userAgent: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare correlationId: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare reason: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  declare metadata: Record<string, unknown>;

  @CreatedAt
  declare occurredAt: Date;
}
