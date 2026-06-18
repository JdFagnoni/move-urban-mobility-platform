import { Column, CreatedAt, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";

@Table({
  tableName: "sent_emails",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: false,
  indexes: [{ unique: true, fields: ["reservation_id", "type"] }],
})
export class SentEmailModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare reservationId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare type: string;

  @CreatedAt
  declare created_at: Date;
}
