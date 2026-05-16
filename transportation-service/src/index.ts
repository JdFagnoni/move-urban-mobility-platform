import "dotenv/config";
import express from "express";
import { tripsRouter } from "./modules/trips/router";
import { gpsRouter } from "./modules/gps/router";
import { alertsRouter } from "./modules/alerts/router";
import { operatorRouter } from "./modules/operator/router";

const app = express();
const PORT = process.env["PORT"] ?? "3002";

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "traslados-service" });
});

app.use("/trips", tripsRouter);
app.use("/gps", gpsRouter);
app.use("/alerts", alertsRouter);
app.use("/operator", operatorRouter);

app.listen(Number(PORT), () => {
  console.log(`traslados-service running on port ${PORT}`);
});
