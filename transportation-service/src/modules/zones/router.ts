import { Router } from "express";
import { createAuthenticate, requireRole } from "@move/shared";
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler } from "./controller";

const authenticate = createAuthenticate();

export const zonesRouter = Router();

zonesRouter.get("/", listHandler);
zonesRouter.get("/:id", getHandler);
zonesRouter.post("/", authenticate, requireRole("admin"), createHandler);
zonesRouter.patch("/:id", authenticate, requireRole("admin"), updateHandler);
zonesRouter.delete("/:id", authenticate, requireRole("admin"), deleteHandler);
