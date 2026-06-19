import "dotenv/config";

process.on("uncaughtException", (err: Error) => {
  process.stderr.write(`[transportations] uncaughtException: ${err.message}\n${err.stack ?? ""}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  process.stderr.write(`[transportations] unhandledRejection: ${message}\n`);
});

import express from "express";
import { tripsRouter } from "./modules/trips/router";
import { gpsRouter } from "./modules/gps/router";
import { alertsRouter } from "./modules/alerts/router";
import { operatorRouter } from "./modules/operator/router";
import { vehiclesRouter } from "./modules/vehicles/router";
import { zonesRouter } from "./modules/zones/router";
import { initDb } from "./db/init";
import { initializeSequelize } from "./db/sequelize";
import { warmAlertCache } from "./modules/alerts/service";
import { startTransportationMessaging } from "./messaging";

const app = express();
const PORT = process.env["PORT"] ?? "3002";

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "transportations" });
});

app.use("/trips", tripsRouter);
app.use("/gps", gpsRouter);
app.use("/alerts", alertsRouter);
app.use("/operator", operatorRouter);
app.use("/vehicles", vehiclesRouter);
app.use("/zones", zonesRouter);

initializeSequelize()
  .then(() => initDb())
  .then(() => warmAlertCache())
  .then(() => {
    startTransportationMessaging();
    app.listen(Number(PORT), () => {
      console.log(`transportations running on port ${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  });
