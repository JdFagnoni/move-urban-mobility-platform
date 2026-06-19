import { createHmac, timingSafeEqual } from "crypto";
import { HttpError, recordExternalCall } from "@move/shared";
import type {
  InitiatedPayment,
  InitiatePaymentInput,
  PaymentProviderPort,
  PaymentWebhookEvent,
} from "../ports/PaymentProviderPort";

interface StripePaymentIntent {
  id: string;
  status: string;
  payment_method_types?: string[];
  last_payment_error?: {
    code?: string;
    message?: string;
  } | null;
}

interface StripePaymentIntentResponseError {
  error?: {
    code?: string;
    message?: string;
    type?: string;
    payment_intent?: StripePaymentIntent;
  };
}

interface StripeWebhookEventEnvelope {
  id: string;
  type: string;
  data?: {
    object?: StripePaymentIntent;
  };
}

const STRIPE_API_BASE_URL = process.env["STRIPE_API_BASE_URL"] ?? "https://api.stripe.com/v1";
const STRIPE_TIMEOUT_MS = 5_000;

export class StripePaymentProviderAdapter implements PaymentProviderPort {
  public async initiatePayment(input: InitiatePaymentInput): Promise<InitiatedPayment> {
    const start = Date.now();
    try {
      const result = await this.doInitiatePayment(input);
      recordExternalCall("stripe", "success", Date.now() - start);
      return result;
    } catch (error) {
      const outcome =
        error instanceof HttpError && error.code === "payment_provider_timeout"
          ? "timeout"
          : "error";
      recordExternalCall("stripe", outcome, Date.now() - start);
      throw error;
    }
  }

  private async doInitiatePayment(input: InitiatePaymentInput): Promise<InitiatedPayment> {
    if (getSimulationMode() === "unavailable") {
      throw new HttpError(503, "Payment provider unavailable", "payment_provider_unavailable");
    }

    const secretKey = getRequiredEnv("STRIPE_SECRET_KEY", "Payment provider unavailable");
    const payload = new URLSearchParams({
      amount: String(toSmallestCurrencyUnit(input.amount)),
      currency: input.currency.toLowerCase(),
      confirm: "true",
      payment_method: input.paymentMethodId,
      confirmation_method: "automatic",
    });
    payload.append("payment_method_types[]", "card");

    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      payload.append(`metadata[${key}]`, value);
    }

    const response = await fetchWithTimeout(`${STRIPE_API_BASE_URL}/payment_intents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: payload.toString(),
    });

    const bodyText = await response.text();
    const parsed = bodyText
      ? (JSON.parse(bodyText) as StripePaymentIntent | StripePaymentIntentResponseError)
      : null;

    if (response.ok) {
      return mapInitiatedPayment(parsed as StripePaymentIntent);
    }

    const providerError = parsed as StripePaymentIntentResponseError | null;
    if (response.status >= 500 || response.status === 429) {
      throw new HttpError(503, "Payment provider unavailable", "payment_provider_unavailable");
    }

    const paymentIntent = providerError?.error?.payment_intent;
    if (paymentIntent) {
      return mapInitiatedPayment(paymentIntent);
    }

    if (providerError?.error?.type === "invalid_request_error") {
      throw new HttpError(
        400,
        providerError.error.message ?? "Invalid payment request",
        "invalid_payment_request"
      );
    }

    throw new HttpError(
      502,
      providerError?.error?.message ?? "Payment provider request failed",
      "payment_provider_request_failed"
    );
  }

  public parseWebhook(payload: string, signature: string | null): PaymentWebhookEvent | null {
    if (!signature) {
      throw new HttpError(400, "Missing Stripe signature", "invalid_webhook_signature");
    }

    const endpointSecret = getRequiredEnv(
      "STRIPE_WEBHOOK_SECRET",
      "Payment webhook is not configured"
    );
    verifyWebhookSignature(payload, signature, endpointSecret);
    const event = JSON.parse(payload) as StripeWebhookEventEnvelope;
    const paymentIntent = event.data?.object;
    if (!paymentIntent?.id) {
      return null;
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        return mapWebhookEvent(event.id, paymentIntent, "accepted");
      case "payment_intent.payment_failed":
        return mapWebhookEvent(event.id, paymentIntent, "rejected");
      case "payment_intent.processing":
        return mapWebhookEvent(event.id, paymentIntent, "pending");
      default:
        return null;
    }
  }
}

function mapInitiatedPayment(paymentIntent: StripePaymentIntent): InitiatedPayment {
  return {
    provider: "stripe",
    providerPaymentId: paymentIntent.id,
    providerResponseCode: paymentIntent.last_payment_error?.code ?? paymentIntent.status,
    paymentMethodType: paymentIntent.payment_method_types?.[0] ?? null,
    rawStatus: paymentIntent.status,
  };
}

function mapWebhookEvent(
  eventId: string,
  paymentIntent: StripePaymentIntent,
  status: PaymentWebhookEvent["status"]
): PaymentWebhookEvent {
  return {
    eventId,
    provider: "stripe",
    providerPaymentId: paymentIntent.id,
    providerResponseCode: paymentIntent.last_payment_error?.code ?? paymentIntent.status,
    paymentMethodType: paymentIntent.payment_method_types?.[0] ?? null,
    status,
    failureReason: paymentIntent.last_payment_error?.message ?? null,
  };
}

function toSmallestCurrencyUnit(amount: number): number {
  return Math.round(amount * 100);
}

function getRequiredEnv(name: string, message: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new HttpError(503, message, "payment_provider_not_configured");
  }
  return value;
}

function getSimulationMode(): string {
  return process.env["PAYMENT_SIMULATION_MODE"]?.trim().toLowerCase() ?? "none";
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new HttpError(503, "Payment provider unavailable", "payment_provider_timeout");
    }

    throw new HttpError(503, "Payment provider unavailable", "payment_provider_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function verifyWebhookSignature(payload: string, signature: string, secret: string): void {
  const elements = parseStripeSignatureHeader(signature);
  const timestamp = elements["t"];
  const expectedSignature = elements["v1"];

  if (!timestamp || !expectedSignature) {
    throw new HttpError(400, "Invalid Stripe signature", "invalid_webhook_signature");
  }

  const signedPayload = `${timestamp}.${payload}`;
  const digest = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const digestBuffer = Buffer.from(digest, "hex");
  const signatureBuffer = Buffer.from(expectedSignature, "hex");

  if (
    digestBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(digestBuffer, signatureBuffer)
  ) {
    throw new HttpError(400, "Invalid Stripe signature", "invalid_webhook_signature");
  }
}

function parseStripeSignatureHeader(signature: string): Record<string, string> {
  return signature.split(",").reduce<Record<string, string>>((accumulator, item) => {
    const [key, value] = item.split("=", 2);
    if (key && value) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}
