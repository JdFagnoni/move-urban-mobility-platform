import { Router } from "express";
import { ingestHandler, latestHandler, allLatestHandler } from "./controller";

export const gpsRouter = Router();

gpsRouter.post("/signal", ingestHandler);
gpsRouter.get("/latest-positions", allLatestHandler);
gpsRouter.get("/vehicle/:vehicleId/latest", latestHandler);
