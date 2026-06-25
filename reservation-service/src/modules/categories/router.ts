import { Router } from "express";
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler } from "./controller";
import { authenticate, requireRole } from "../auth/middleware";

export const categoriesRouter = Router();

categoriesRouter.get("/", listHandler);
categoriesRouter.get("/:id", getHandler);
categoriesRouter.post("/", authenticate, requireRole("admin"), createHandler);
categoriesRouter.patch("/:id", authenticate, requireRole("admin"), updateHandler);
categoriesRouter.delete("/:id", authenticate, requireRole("admin"), deleteHandler);
