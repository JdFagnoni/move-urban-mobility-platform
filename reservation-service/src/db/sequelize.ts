import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import {
  AuthAuditLogModel,
  CategoryModel,
  GoodModel,
  ReservationModel,
  UserModel,
} from "./models";

const connectionString =
  process.env["DATABASE_URL"] ?? "postgres://move:move_secret@localhost:5432/move_platform";

export const sequelize = new Sequelize(connectionString, {
  dialect: "postgres",
  models: [UserModel, AuthAuditLogModel, CategoryModel, ReservationModel, GoodModel],
  logging: false,
});

export async function initializeDatabase(): Promise<void> {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
}
