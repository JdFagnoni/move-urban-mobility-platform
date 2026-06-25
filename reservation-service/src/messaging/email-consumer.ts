import type { ReservationUnsupportedEvent } from "@move/shared";
import { UniqueConstraintError } from "sequelize";
import { SentEmailModel } from "../db/models";
import { reservationEmailProvider } from "../modules/reservations/runtime";
import { EMAIL_TYPES } from "./events";

export async function sendUnsupportedReservationEmail(
  event: ReservationUnsupportedEvent
): Promise<void> {
  if (await alreadySent(event.reservationId)) {
    return;
  }

  await reservationEmailProvider.sendUnsupportedReservationEmail({
    reservationId: event.reservationId,
    recipientEmail: event.recipientEmail,
    recipientName: event.recipientName,
    rejectionReason: event.rejectionReason,
  });

  await markSent(event.reservationId);
}

async function alreadySent(reservationId: string): Promise<boolean> {
  const record = await SentEmailModel.findOne({
    where: { reservationId, type: EMAIL_TYPES.unsupportedReservation },
  });
  return record !== null;
}

async function markSent(reservationId: string): Promise<void> {
  try {
    await SentEmailModel.create({
      id: crypto.randomUUID(),
      reservationId,
      type: EMAIL_TYPES.unsupportedReservation,
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return;
    }
    throw error;
  }
}
