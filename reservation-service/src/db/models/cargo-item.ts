import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";
import { CategoryModel } from "./category";
import { ReservationModel } from "./reservation";

@Table({
  tableName: "goods",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: false,
})
export class CargoItemModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare reservationId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare description: string;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: true })
  declare estimatedValue: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare size: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare categoryId: string | null;

  @CreatedAt
  declare createdAt: Date;

  @BelongsTo(() => ReservationModel, { foreignKey: "reservationId", as: "reservation" })
  declare reservation?: ReservationModel;

  @BelongsTo(() => CategoryModel, { foreignKey: "categoryId", as: "category" })
  declare category?: CategoryModel | null;
}
