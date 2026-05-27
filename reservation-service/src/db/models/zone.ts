import type { GeoPolygon, ZoneType } from "@move/shared";
import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
import { ZONE_TYPES } from "../constants";

@Table({
  tableName: "zones",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
})
export class ZoneModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.ENUM(...ZONE_TYPES), allowNull: false })
  declare type: ZoneType;

  @Column({ type: DataType.STRING, allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare polygon: GeoPolygon;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare active: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
