import type {
  ReservationEmailPort,
  UnsupportedReservationEmailInput,
} from "../ports/ReservationEmailPort";

export class LoggingReservationEmailAdapter implements ReservationEmailPort {
  async sendUnsupportedReservationEmail(
    input: UnsupportedReservationEmailInput
  ): Promise<void> {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "unsupported_reservation_email_skipped",
        reservationId: input.reservationId,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        rejectionReason: input.rejectionReason,
      })
    );
  }
}
