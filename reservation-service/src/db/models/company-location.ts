import type { CompanyLocationKind, GeoPoint } from "@move/shared";
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
import { UserModel } from "./user";

@Table({
  tableName: "company_locations",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    {
      unique: true,
      fields: ["client_id", "label"],
    },
  ],
})
export class CompanyLocationModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare clientId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare label: string;

  @Column({
    type: DataType.ENUM("origin", "destination", "both"),
    allowNull: false,
  })
  declare kind: CompanyLocationKind;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare location: GeoPoint;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @BelongsTo(() => UserModel, { foreignKey: "clientId", as: "client" })
  declare client?: UserModel;
}
