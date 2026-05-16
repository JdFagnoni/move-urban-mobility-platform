import { Router } from "express";
import {
  createHandler,
  getHandler,
  listByClientHandler,
  confirmHandler,
  cancelHandler,
} from "./controller";

export const reservationsRouter = Router();

reservationsRouter.post("/", createHandler);
reservationsRouter.get("/client/:clientId", listByClientHandler);
reservationsRouter.get("/:id", getHandler);
reservationsRouter.patch("/:id/confirm", confirmHandler);
reservationsRouter.patch("/:id/cancel", cancelHandler);
