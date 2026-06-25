import { Router } from "express";
import { listHandler, resolveHandler } from "./controller";

export const alertsRouter = Router();

alertsRouter.get("/", listHandler);
alertsRouter.patch("/:id/resolve", resolveHandler);
