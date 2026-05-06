import { Router } from "express";
import { listHandler, getHandler, updateHandler, deleteHandler } from "./controller";

export const usersRouter = Router();

usersRouter.get("/", listHandler);
usersRouter.get("/:id", getHandler);
usersRouter.patch("/:id", updateHandler);
usersRouter.delete("/:id", deleteHandler);
