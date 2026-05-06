import { Router } from "express";
import {
  createHandler,
  getHandler,
  listByPassengerHandler,
  confirmHandler,
  cancelHandler,
} from "./controller";

export const reservationsRouter = Router();

reservationsRouter.post("/", createHandler);
reservationsRouter.get("/:id", getHandler);
reservationsRouter.get("/passenger/:passengerId", listByPassengerHandler);
reservationsRouter.patch("/:id/confirm", confirmHandler);
reservationsRouter.patch("/:id/cancel", cancelHandler);
