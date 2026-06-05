import type { PaymentProvider, PaymentStatus } from "@move/shared";
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
import { PAYMENT_PROVIDERS, PAYMENT_STATUSES } from "../constants";
import { ReservationModel } from "./reservation";
import { UserModel } from "./user";

@Table({
  tableName: "payments",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
})
export class PaymentModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare reservationId: string;

  @Column({ type: DataType.ENUM(...PAYMENT_PROVIDERS), allowNull: false })
  declare provider: PaymentProvider;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare providerPaymentId: string;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  declare amount: string;

  @Column({ type: DataType.STRING(3), allowNull: false })
  declare currency: string;

  @Column({ type: DataType.ENUM(...PAYMENT_STATUSES), allowNull: false })
  declare status: PaymentStatus;

  @Column({ type: DataType.STRING, allowNull: true })
  declare failureReason: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare providerResponseCode: string | null;

  @Column({ type: DataType.STRING, allowNull: true, unique: true })
  declare providerEventId: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare requestedByUserId: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare paymentMethodType: string | null;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;

  @BelongsTo(() => ReservationModel, { foreignKey: "reservationId", as: "reservation" })
  declare reservation?: ReservationModel;

  @BelongsTo(() => UserModel, { foreignKey: "requestedByUserId", as: "requestedByUser" })
  declare requestedByUser?: UserModel | null;
}
