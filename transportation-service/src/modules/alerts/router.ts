import { Router } from "express";
import { createHandler, listHandler, resolveHandler } from "./controller";

export const alertsRouter = Router();

alertsRouter.post("/", createHandler);
alertsRouter.get("/", listHandler);
alertsRouter.patch("/:id/resolve", resolveHandler);
