import { Router } from "express";
import { createHandler, getHandler, listHandler, cancelHandler } from "./controller";
import { authenticate } from "../auth/middleware";

export const reservationsRouter = Router();

reservationsRouter.use(authenticate);

reservationsRouter.post("/", createHandler);
reservationsRouter.get("/", listHandler);
reservationsRouter.get("/:id", getHandler);
reservationsRouter.patch("/:id/cancel", cancelHandler);
