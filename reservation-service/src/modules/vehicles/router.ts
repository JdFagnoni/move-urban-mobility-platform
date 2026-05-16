import { Router } from "express";
import { listHandler, getHandler, createHandler, updateHandler } from "./controller";

export const vehiclesRouter = Router();

vehiclesRouter.get("/", listHandler);
vehiclesRouter.get("/:id", getHandler);
vehiclesRouter.post("/", createHandler);
vehiclesRouter.patch("/:id", updateHandler);
