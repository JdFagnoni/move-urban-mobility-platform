import type { CategoryRule } from "@move/shared";
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
import { CargoItemModel } from "./cargo-item";

@Table({
  tableName: "categories",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
})
export class CategoryModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare active: boolean;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  declare rules: CategoryRule[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @HasMany(() => CargoItemModel, { foreignKey: "categoryId", as: "cargoItems" })
  declare cargoItems?: CargoItemModel[];
}
