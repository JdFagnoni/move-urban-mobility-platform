import type { NotificationStatus, NotificationType } from "@move/shared";
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
import {
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
} from "../constants";
import { ReservationModel } from "./reservation";
import { UserModel } from "./user";

@Table({
  tableName: "notifications",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
})
export class NotificationModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare reservationId: string;

  @Column({
    type: DataType.ENUM(...NOTIFICATION_TYPES),
    allowNull: false,
  })
  declare type: NotificationType;

  @Column({
    type: DataType.ENUM(...NOTIFICATION_STATUSES),
    allowNull: false,
    defaultValue: "pending",
  })
  declare status: NotificationStatus;

  @Column({ type: DataType.DATE, allowNull: true })
  declare acknowledgedAt: Date | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare acknowledgedByUserId: string | null;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;

  @BelongsTo(() => ReservationModel, { foreignKey: "reservationId", as: "reservation" })
  declare reservation?: ReservationModel;

  @BelongsTo(() => UserModel, { foreignKey: "acknowledgedByUserId", as: "acknowledgedByUser" })
  declare acknowledgedByUser?: UserModel | null;
}
