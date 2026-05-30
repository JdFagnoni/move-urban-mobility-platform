import { randomUUID } from "crypto";
import type {
  ConfirmReservationPaymentDTO,
  ConfirmReservationPaymentResultDTO,
  PaymentDTO,
  UserDTO,
} from "@move/shared";
import { HttpError } from "@move/shared";
import { Transaction } from "sequelize";
import { sequelize } from "../../db/sequelize";
import { PaymentModel, ReservationModel } from "../../db/models";
import { paymentProvider } from "./runtime";
import {
  loadReservationWithRelations,
  mapPaymentModelToDTO,
} from "../reservations/service";

export async function confirmReservationPayment(
  reservationId: string,
  dto: ConfirmReservationPaymentDTO,
  clientUser: UserDTO
): Promise<ConfirmReservationPaymentResultDTO> {
  if (clientUser.role !== "client") {
    throw new HttpError(403, "Only clients can confirm payments", "forbidden");
  }

  if (typeof dto.paymentMethodId !== "string" || !dto.paymentMethodId.trim()) {
    throw new HttpError(400, "paymentMethodId is required", "invalid_payment_request");
  }

  const reservation = await loadReservationWithRelations(reservationId);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  if (reservation.clientId !== clientUser.id) {
    throw new HttpError(403, "Access denied", "forbidden");
  }

  if (reservation.status !== "pending_confirmation") {
    throw new HttpError(
      409,
      `Cannot confirm payment for a reservation with status '${reservation.status}'`,
      "invalid_status_transition"
    );
  }

  if (reservation.quotedPrice === null) {
    throw new HttpError(409, "Reservation does not have a quoted price", "missing_quote");
  }

  const latestPayment = await findLatestPaymentForReservation(reservation.id);

  if (latestPayment?.status === "pending") {
    throw new HttpError(409, "Reservation already has a pending payment", "pending_payment_exists");
  }

  if (latestPayment?.status === "accepted") {
    throw new HttpError(409, "Reservation has already been paid", "payment_already_accepted");
  }

  const idempotencyKey = dto.idempotencyKey?.trim() || undefined;
  const initiatedPayment = await paymentProvider.initiatePayment({
    amount: parseFloat(reservation.quotedPrice),
    currency: "uyu",
    paymentMethodId: dto.paymentMethodId.trim(),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    metadata: {
      reservation_id: reservation.id,
      client_id: clientUser.id,
    },
  });

  const paymentId = randomUUID();
  await sequelize.transaction(async (transaction) => {
    await PaymentModel.create(
      {
        id: paymentId,
        reservationId: reservation.id,
        provider: initiatedPayment.provider,
        providerPaymentIntentId: initiatedPayment.providerPaymentIntentId,
        amount: reservation.quotedPrice,
        currency: "UYU",
        status: "pending",
        providerResponseCode: initiatedPayment.providerResponseCode,
        requestedByUserId: clientUser.id,
        paymentMethodType: initiatedPayment.paymentMethodType,
      },
      { transaction }
    );
  });

  const createdPayment = await PaymentModel.findByPk(paymentId);
  if (!createdPayment) {
    throw new HttpError(500, "Payment confirmation failed", "payment_confirmation_failed");
  }

  return {
    reservationId: reservation.id,
    payment: mapPaymentModelToDTO(createdPayment),
  };
}

export async function listReservationPayments(
  reservationId: string,
  clientUser: UserDTO
): Promise<PaymentDTO[]> {
  const reservation = await loadReservationWithRelations(reservationId);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  if (clientUser.role === "client" && reservation.clientId !== clientUser.id) {
    throw new HttpError(403, "Access denied", "forbidden");
  }

  const payments = await PaymentModel.findAll({
    where: { reservationId: reservation.id },
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
  });

  return payments.map(mapPaymentModelToDTO);
}

export async function handleStripeWebhook(
  payload: string,
  signature: string | null
): Promise<{ processed: boolean; payment: PaymentDTO | null }> {
  const event = paymentProvider.parseWebhook(payload, signature);
  if (!event) {
    return { processed: false, payment: null };
  }

  const duplicateEvent = await PaymentModel.findOne({
    where: { providerEventId: event.eventId },
  });
  if (duplicateEvent) {
    return { processed: true, payment: mapPaymentModelToDTO(duplicateEvent) };
  }

  const payment = await PaymentModel.findOne({
    where: {
      provider: event.provider,
      providerPaymentIntentId: event.providerPaymentIntentId,
    },
  });

  if (!payment) {
    throw new HttpError(
      503,
      "Payment webhook could not be matched to a reservation yet",
      "payment_webhook_not_ready"
    );
  }

  await sequelize.transaction(async (transaction) => {
    payment.status = event.status;
    payment.failureReason = event.failureReason;
    payment.providerResponseCode = event.providerResponseCode;
    payment.providerEventId = event.eventId;
    payment.paymentMethodType = event.paymentMethodType ?? payment.paymentMethodType;
    await payment.save({ transaction });

    const reservation = await ReservationModel.findByPk(payment.reservationId, { transaction });
    if (!reservation) {
      return;
    }

    const latestPayment = await findLatestPaymentForReservation(payment.reservationId, transaction);
    if (!latestPayment || latestPayment.id !== payment.id) {
      return;
    }

    if (event.status === "accepted") {
      reservation.status = "confirmed";
      await reservation.save({ transaction });
      return;
    }

    if (event.status === "rejected" && reservation.status !== "pending_confirmation") {
      reservation.status = "pending_confirmation";
      await reservation.save({ transaction });
    }
  });

  const updatedPayment = await PaymentModel.findByPk(payment.id);
  return {
    processed: true,
    payment: updatedPayment ? mapPaymentModelToDTO(updatedPayment) : null,
  };
}

async function findLatestPaymentForReservation(
  reservationId: string,
  transaction?: Transaction
): Promise<PaymentModel | null> {
  return PaymentModel.findOne({
    where: { reservationId },
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
    ...(transaction ? { transaction } : {}),
  });
}
