import { Router } from "express";
import { authenticate, requireRole } from "../auth/middleware";
import {
  deleteHandler,
  getHandler,
  listHandler,
  updateHandler,
  updateStatusHandler,
} from "./controller";

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get("/", requireRole("admin"), listHandler);
usersRouter.get("/:id", getHandler);
usersRouter.patch("/:id", updateHandler);
usersRouter.patch("/:id/status", requireRole("admin"), updateStatusHandler);
usersRouter.delete("/:id", requireRole("admin"), deleteHandler);
