import { Router } from "express";
import { createHandler, getHandler, listHandler, cancelHandler } from "./controller";
import { authenticate } from "../auth/middleware";
import { confirmPaymentHandler, listReservationPaymentsHandler } from "../payments/controller";

export const reservationsRouter = Router();

reservationsRouter.use(authenticate);

reservationsRouter.post("/", createHandler);
reservationsRouter.get("/", listHandler);
reservationsRouter.get("/:id", getHandler);
reservationsRouter.get("/:id/payments", listReservationPaymentsHandler);
reservationsRouter.post("/:id/confirm-payment", confirmPaymentHandler);
reservationsRouter.patch("/:id/cancel", cancelHandler);
