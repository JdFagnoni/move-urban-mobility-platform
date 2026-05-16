import { Router } from "express";
import { ingestHandler, latestHandler } from "./controller";

export const gpsRouter = Router();

gpsRouter.post("/signal", ingestHandler);
gpsRouter.get("/vehicle/:vehicleId/latest", latestHandler);
