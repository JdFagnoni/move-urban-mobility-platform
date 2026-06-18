import { Router } from "express";
import { getMetricsHandler } from "./controller";

export const metricsRouter = Router();

metricsRouter.get("/", getMetricsHandler);
