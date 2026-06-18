import { Router } from "express";
import { createAuthenticate, requireRole } from "@move/shared";
import { createHandler, deleteHandler, getHandler, listHandler, updateHandler } from "./controller";

const authenticate = createAuthenticate();

export const vehiclesRouter = Router();

vehiclesRouter.use(authenticate);

vehiclesRouter.get("/", listHandler);
vehiclesRouter.get("/:id", getHandler);
vehiclesRouter.post("/", requireRole("admin"), createHandler);
vehiclesRouter.patch("/:id", requireRole("admin"), updateHandler);
vehiclesRouter.delete("/:id", requireRole("admin"), deleteHandler);
