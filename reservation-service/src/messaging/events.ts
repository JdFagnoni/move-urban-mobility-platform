export const OUTBOX_EVENT_TYPES = {
  reservationAssigned: "ReservationAssigned",
  reservationUnsupported: "ReservationUnsupported",
  categoryChanged: "CategoryChanged",
} as const;

export const EMAIL_TYPES = {
  unsupportedReservation: "unsupported_reservation",
} as const;
