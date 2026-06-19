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
  tableName: "frequent_client_rankings",
  timestamps: true,
  underscored: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    {
      unique: true,
      fields: ["client_id"],
    },
    {
      unique: true,
      fields: ["rank_position"],
    },
  ],
})
export class FrequentClientRankingModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false, field: "client_id" })
  declare clientId: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: "rank_position" })
  declare rankPosition: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: "reservation_count" })
  declare reservationCount: number;

  @Column({ type: DataType.DATE, allowNull: false, field: "last_reservation_at" })
  declare lastReservationAt: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: "window_start" })
  declare windowStart: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: "window_end" })
  declare windowEnd: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: "refreshed_at" })
  declare refreshedAt: Date;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
