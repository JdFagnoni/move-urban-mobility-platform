import { Router } from "express";
import { listHandler, getHandler, createHandler, updateHandler, deleteHandler } from "./controller";

export const zonesRouter = Router();

zonesRouter.get("/", listHandler);
zonesRouter.get("/:id", getHandler);
zonesRouter.post("/", createHandler);
zonesRouter.patch("/:id", updateHandler);
zonesRouter.delete("/:id", deleteHandler);
