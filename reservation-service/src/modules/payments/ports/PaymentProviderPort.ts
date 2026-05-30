import type { PaymentProvider } from "@move/shared";

export interface InitiatePaymentInput {
  amount: number;
  currency: string;
  paymentMethodId: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface InitiatedPayment {
  provider: PaymentProvider;
  providerPaymentIntentId: string;
  providerResponseCode: string | null;
  paymentMethodType: string | null;
  rawStatus: string;
}

export interface PaymentWebhookEvent {
  eventId: string;
  provider: PaymentProvider;
  providerPaymentIntentId: string;
  providerResponseCode: string | null;
  paymentMethodType: string | null;
  status: "pending" | "accepted" | "rejected";
  failureReason: string | null;
}

export interface PaymentProviderPort {
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatedPayment>;
  parseWebhook(payload: string, signature: string | null): PaymentWebhookEvent | null;
}
