import type { GeoPoint, ReservationStatus } from "@move/shared";
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
import { RESERVATION_STATUSES } from "../constants";
import { CargoItemModel } from "./cargo-item";
import { NotificationModel } from "./notification";
import { PaymentModel } from "./payment";
import { UserModel } from "./user";

@Table({
  tableName: "reservations",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    {
      fields: ["client_id", "created_at"],
    },
  ],
})
export class ReservationModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare clientId: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare origin: GeoPoint;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare destination: GeoPoint;

  @Column({ type: DataType.DATE, allowNull: false })
  declare scheduledAt: Date;

  @Column({
    type: DataType.ENUM(...RESERVATION_STATUSES),
    allowNull: false,
    defaultValue: "pending_classification",
  })
  declare status: ReservationStatus;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: true })
  declare quotedPrice: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare vehicleId: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare driverId: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare rejectedAt: Date | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare rejectedByUserId: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare rejectionReason: string | null;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;

  @BelongsTo(() => UserModel, { foreignKey: "clientId", as: "client" })
  declare client?: UserModel;

  @HasMany(() => CargoItemModel, { foreignKey: "reservationId", as: "cargoItems" })
  declare cargoItems?: CargoItemModel[];

  @HasMany(() => PaymentModel, { foreignKey: "reservationId", as: "payments" })
  declare payments?: PaymentModel[];

  @HasMany(() => NotificationModel, {
    foreignKey: "reservationId",
    as: "notifications",
  })
  declare notifications?: NotificationModel[];
}
