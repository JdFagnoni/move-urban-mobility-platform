import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import {
  AuthAuditLogModel,
  CargoItemModel,
  CategoryModel,
  CompanyLocationModel,
  CompanyProductModel,
  NotificationModel,
  OutboxEventModel,
  PaymentModel,
  ReservationModel,
  UserModel,
  ZoneModel,
  VehicleModel,
} from "./models";

const connectionString =
  process.env["DATABASE_URL"] ?? "postgres://move:move_secret@localhost:5432/move_platform";

export const sequelize = new Sequelize(connectionString, {
  dialect: "postgres",
  models: [
    UserModel,
    AuthAuditLogModel,
    CategoryModel,
    ReservationModel,
    NotificationModel,
    PaymentModel,
    CargoItemModel,
    CompanyProductModel,
    CompanyLocationModel,
    ZoneModel,
    VehicleModel,
    OutboxEventModel,
  ],
  logging: false,
});

export async function initializeDatabase(): Promise<void> {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
}
