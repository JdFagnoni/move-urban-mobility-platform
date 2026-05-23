import type { AuthAuditDecision, AuthAuditEventType, ClientType, UserRole } from "@move/shared";
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";
import {
  AUTH_AUDIT_DECISIONS,
  AUTH_AUDIT_EVENT_TYPES,
  CLIENT_TYPES,
  USER_ROLES,
} from "../constants";
import { UserModel } from "./user";

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

  @BelongsTo(() => UserModel, { foreignKey: "userId", as: "user" })
  declare user?: UserModel | null;
}
