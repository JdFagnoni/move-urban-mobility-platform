export type PaymentProvider = "stripe";

export const PAYMENT_PROVIDERS: readonly PaymentProvider[] = ["stripe"];

export type PaymentStatus = "pending" | "accepted" | "rejected";

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["pending", "accepted", "rejected"];

export interface PaymentDTO {
  id: string;
  reservationId: string;
  provider: PaymentProvider;
  providerPaymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  failureReason?: string | null;
  providerResponseCode?: string | null;
  providerEventId?: string | null;
  requestedByUserId?: string | null;
  paymentMethodType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmReservationPaymentDTO {
  paymentMethodId: string;
  idempotencyKey?: string;
}

export interface ConfirmReservationPaymentResultDTO {
  reservationId: string;
  payment: PaymentDTO;
}
