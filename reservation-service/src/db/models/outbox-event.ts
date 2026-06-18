import { Column, CreatedAt, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";
import { OUTBOX_EVENT_STATUSES, type OutboxEventStatus } from "../constants";

@Table({
  tableName: "outbox_events",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: false,
})
export class OutboxEventModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare aggregateId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare type: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare routingKey: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare payload: Record<string, unknown>;

  @Column({
    type: DataType.ENUM(...OUTBOX_EVENT_STATUSES),
    allowNull: false,
    defaultValue: "pending",
  })
  declare status: OutboxEventStatus;

  @CreatedAt
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare publishedAt: Date | null;
}
