import { Router } from "express";
import { createAuthenticate, requireRole } from "@move/shared";
import { createHandler, deleteHandler, getHandler, listHandler, updateHandler } from "./controller";

const authenticate = createAuthenticate();

export const vehiclesRouter = Router();

vehiclesRouter.get("/", listHandler);
vehiclesRouter.get("/:id", getHandler);
vehiclesRouter.post("/", authenticate, requireRole("admin"), createHandler);
vehiclesRouter.patch("/:id", authenticate, requireRole("admin"), updateHandler);
vehiclesRouter.delete("/:id", authenticate, requireRole("admin"), deleteHandler);
