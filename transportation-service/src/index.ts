import "dotenv/config";
import express from "express";
import { tripsRouter } from "./modules/trips/router";
import { gpsRouter } from "./modules/gps/router";
import { alertsRouter } from "./modules/alerts/router";
import { operatorRouter } from "./modules/operator/router";
import { initDb } from "./db/init";

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

initDb()
  .then(() => {
    app.listen(Number(PORT), () => {
      console.log(`transportations running on port ${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  });
