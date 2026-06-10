export interface UnsupportedReservationEmailInput {
  reservationId: string;
  recipientEmail: string;
  recipientName: string;
  rejectionReason: string;
}

export interface ReservationEmailPort {
  sendUnsupportedReservationEmail(input: UnsupportedReservationEmailInput): Promise<void>;
}
