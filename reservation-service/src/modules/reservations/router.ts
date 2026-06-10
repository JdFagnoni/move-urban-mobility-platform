import { Router } from "express";
import { createHandler, getHandler, listHandler, cancelHandler, assignHandler } from "./controller";
import { authenticate, requireRole } from "../auth/middleware";
import { confirmPaymentHandler, listReservationPaymentsHandler } from "../payments/controller";

export const reservationsRouter = Router();

reservationsRouter.use(authenticate);

reservationsRouter.post("/", createHandler);
reservationsRouter.get("/", listHandler);
reservationsRouter.patch("/:id/assign", requireRole("operator", "admin"), assignHandler);
reservationsRouter.patch("/:id/cancel", cancelHandler);
reservationsRouter.get("/:id/payments", listReservationPaymentsHandler);
reservationsRouter.post("/:id/confirm-payment", confirmPaymentHandler);
reservationsRouter.get("/:id", getHandler);
