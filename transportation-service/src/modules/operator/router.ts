import { Router } from "express";
import { activeTripsHandler, availableVehiclesHandler, reassignHandler } from "./controller";

export const operatorRouter = Router();

operatorRouter.get("/trips/active", activeTripsHandler);
operatorRouter.get("/vehicles/available", availableVehiclesHandler);
operatorRouter.patch("/trips/:tripId/reassign", reassignHandler);
