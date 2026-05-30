import type { Request, Response } from "express";
import type { ConfirmReservationPaymentDTO } from "@move/shared";
import { handleServiceError } from "../../http/handler";
import {
  confirmReservationPayment,
  handleStripeWebhook,
  listReservationPayments,
} from "./service";

export async function confirmPaymentHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    confirmReservationPayment(id, req.body as ConfirmReservationPaymentDTO, clientUser)
  );
  if (!result.ok) {
    return;
  }

  res.status(202).json({ success: true, data: result.data });
}

export async function listReservationPaymentsHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => listReservationPayments(id, clientUser));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
  const signature =
    typeof req.headers["stripe-signature"] === "string" ? req.headers["stripe-signature"] : null;
  const result = await handleServiceError(res, () => handleStripeWebhook(rawBody, signature));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}
