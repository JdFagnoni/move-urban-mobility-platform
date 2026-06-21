export const OUTBOX_EVENT_TYPES = {
  reservationAssigned: "ReservationAssigned",
  reservationUnsupported: "ReservationUnsupported",
  classificationRequested: "ClassificationRequested",
} as const;

export const EMAIL_TYPES = {
  unsupportedReservation: "unsupported_reservation",
} as const;
