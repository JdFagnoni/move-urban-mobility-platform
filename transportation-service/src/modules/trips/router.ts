import { Router } from "express";
import { createHandler, listHandler, getHandler, startHandler, completeHandler } from "./controller";

export const tripsRouter = Router();

tripsRouter.post("/", createHandler);
tripsRouter.get("/", listHandler);
tripsRouter.get("/:id", getHandler);
tripsRouter.patch("/:id/start", startHandler);
tripsRouter.patch("/:id/complete", completeHandler);
