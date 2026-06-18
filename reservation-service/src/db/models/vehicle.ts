import type { VehicleStatus } from "@move/shared";
import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "sequelize-typescript";

@Table({
  tableName: "vehicles",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
})
export class VehicleReadModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare plate: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare type: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare capacity: number;

  @Column({
    type: DataType.ENUM("available", "busy", "maintenance", "inactive"),
    allowNull: false,
    defaultValue: "available",
  })
  declare status: VehicleStatus;

  @Column({ type: DataType.STRING, allowNull: true })
  declare gpsDeviceId: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  declare customFeatures: Record<string, unknown>;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
