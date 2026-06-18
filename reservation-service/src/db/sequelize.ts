import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import { AuthAuditLogModel } from "@move/shared";
import {
  CargoItemModel,
  CategoryModel,
  CompanyLocationModel,
  CompanyProductModel,
  NotificationModel,
  OutboxEventModel,
  PaymentModel,
  ReservationModel,
  SentEmailModel,
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
    SentEmailModel,
  ],
  logging: false,
});

export async function initializeDatabase(): Promise<void> {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
}
