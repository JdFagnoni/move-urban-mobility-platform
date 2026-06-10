import { Router } from "express";
import {
  acknowledgeClassificationNotificationHandler,
  cancelHandler,
  classifyReservationHandler,
  createHandler,
  getHandler,
  listClassificationNotificationsHandler,
  listHandler,
  listPendingClassificationHandler,
  rejectReservationHandler,
} from "./controller";
import { authenticate, requireRole } from "../auth/middleware";
import { confirmPaymentHandler, listReservationPaymentsHandler } from "../payments/controller";

export const reservationsRouter = Router();

reservationsRouter.use(authenticate);

reservationsRouter.post("/", createHandler);
reservationsRouter.get("/", listHandler);
reservationsRouter.get(
  "/pending-classification",
  requireRole("operator"),
  listPendingClassificationHandler
);
reservationsRouter.get(
  "/classification-notifications",
  requireRole("operator"),
  listClassificationNotificationsHandler
);
reservationsRouter.patch(
  "/classification-notifications/:notificationId/acknowledge",
  requireRole("operator"),
  acknowledgeClassificationNotificationHandler
);
reservationsRouter.patch("/:id/classification", requireRole("operator"), classifyReservationHandler);
reservationsRouter.patch("/:id/reject", requireRole("operator"), rejectReservationHandler);
reservationsRouter.get("/:id", getHandler);
reservationsRouter.get("/:id/payments", listReservationPaymentsHandler);
reservationsRouter.post("/:id/confirm-payment", confirmPaymentHandler);
reservationsRouter.patch("/:id/cancel", cancelHandler);
