import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import { AuthAuditLogModel } from "@move/shared";
import { VehicleModel, ZoneModel } from "./models";

const connectionString =
  process.env["DATABASE_URL"] ?? "postgres://move:move_secret@localhost:5432/move_platform";

export const sequelize = new Sequelize(connectionString, {
  dialect: "postgres",
  models: [AuthAuditLogModel, VehicleModel, ZoneModel],
  logging: false,
});

export async function initializeSequelize(): Promise<void> {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
}
