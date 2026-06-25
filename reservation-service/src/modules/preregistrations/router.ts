import { Router } from "express";
import { authenticate, requireRole } from "../auth/middleware";
import {
  createLocationHandler,
  createProductHandler,
  deleteLocationHandler,
  deleteProductHandler,
  listLocationsHandler,
  listProductsHandler,
  updateLocationHandler,
  updateProductHandler,
} from "./controller";

export const preregistrationsRouter = Router();

preregistrationsRouter.use(authenticate, requireRole("client"));

preregistrationsRouter.get("/products", listProductsHandler);
preregistrationsRouter.post("/products", createProductHandler);
preregistrationsRouter.patch("/products/:id", updateProductHandler);
preregistrationsRouter.delete("/products/:id", deleteProductHandler);

preregistrationsRouter.get("/locations", listLocationsHandler);
preregistrationsRouter.post("/locations", createLocationHandler);
preregistrationsRouter.patch("/locations/:id", updateLocationHandler);
preregistrationsRouter.delete("/locations/:id", deleteLocationHandler);
