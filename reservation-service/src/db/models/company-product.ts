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
import { CategoryModel } from "./category";
import { UserModel } from "./user";

@Table({
  tableName: "company_products",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    {
      unique: true,
      fields: ["client_id", "product_name"],
    },
  ],
})
export class CompanyProductModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare clientId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare productName: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare categoryId: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @BelongsTo(() => UserModel, { foreignKey: "clientId", as: "client" })
  declare client?: UserModel;

  @BelongsTo(() => CategoryModel, { foreignKey: "categoryId", as: "category" })
  declare category?: CategoryModel;
}
