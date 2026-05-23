import type { AuthProvider, ClientType, UserRole, UserStatus } from "@move/shared";
import {
  Column,
  CreatedAt,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
import { AUTH_PROVIDERS, CLIENT_TYPES, USER_ROLES, USER_STATUSES } from "../constants";
import { AuthAuditLogModel } from "./auth-audit-log";
import { ReservationModel } from "./reservation";

@Table({
  tableName: "users",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
})
export class UserModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.ENUM(...AUTH_PROVIDERS), allowNull: false, defaultValue: "auth0" })
  declare authProvider: AuthProvider;

  @Column({ type: DataType.STRING, allowNull: false })
  declare authSubject: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.ENUM(...USER_ROLES), allowNull: false })
  declare role: UserRole;

  @Column({ type: DataType.ENUM(...CLIENT_TYPES), allowNull: true })
  declare clientType: ClientType | null;

  @Column({ type: DataType.ENUM(...USER_STATUSES), allowNull: false, defaultValue: "active" })
  declare status: UserStatus;

  @Column({ type: DataType.STRING, allowNull: true })
  declare phone: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare documentType: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare documentNumber: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare companyName: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare taxId: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare lastLoginAt: Date | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @HasMany(() => ReservationModel, { foreignKey: "clientId", as: "reservations" })
  declare reservations?: ReservationModel[];

  @HasMany(() => AuthAuditLogModel, { foreignKey: "userId", as: "auditLogs" })
  declare auditLogs?: AuthAuditLogModel[];
}
