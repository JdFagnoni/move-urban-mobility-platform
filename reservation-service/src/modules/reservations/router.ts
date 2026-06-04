import { Router } from "express";
import { createHandler, getHandler, listHandler, cancelHandler, assignHandler } from "./controller";
import { authenticate, requireRole } from "../auth/middleware";

export const reservationsRouter = Router();

reservationsRouter.use(authenticate);

reservationsRouter.post("/", createHandler);
reservationsRouter.get("/", listHandler);
reservationsRouter.patch("/:id/assign", requireRole("operator", "admin"), assignHandler);
reservationsRouter.patch("/:id/cancel", cancelHandler);
reservationsRouter.get("/:id", getHandler);
