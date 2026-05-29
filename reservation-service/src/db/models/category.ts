import type { CategoryBehaviorConfig, CategoryPricingConfig, CategoryRule } from "@move/shared";
import { DEFAULT_CATEGORY_BEHAVIOR, DEFAULT_CATEGORY_PRICING } from "@move/shared";
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
import { CompanyProductModel } from "./company-product";
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

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: DEFAULT_CATEGORY_PRICING })
  declare pricing: CategoryPricingConfig;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: DEFAULT_CATEGORY_BEHAVIOR })
  declare behavior: CategoryBehaviorConfig;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @HasMany(() => CargoItemModel, { foreignKey: "categoryId", as: "cargoItems" })
  declare cargoItems?: CargoItemModel[];

  @HasMany(() => CompanyProductModel, { foreignKey: "categoryId", as: "companyProducts" })
  declare companyProducts?: CompanyProductModel[];
}
