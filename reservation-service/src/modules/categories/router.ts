import { Router } from "express";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
} from "./controller";

export const categoriesRouter = Router();

categoriesRouter.get("/", listHandler);
categoriesRouter.get("/:id", getHandler);
categoriesRouter.post("/", createHandler);
categoriesRouter.patch("/:id", updateHandler);
categoriesRouter.delete("/:id", deleteHandler);
