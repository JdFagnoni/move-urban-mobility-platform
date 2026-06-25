---
name: external-service-adapter
description: >
  Use this skill whenever you need to integrate a Node.js/TypeScript backend with an external
  service — payment gateways, authentication providers, geolocation APIs, AI/LLM APIs, email
  services, or any third-party HTTP dependency. This skill applies the Adapter pattern to
  encapsulate the external dependency behind a typed interface, keeping domain logic decoupled
  from infrastructure concerns. Trigger this skill when the user mentions: wrapping an API,
  integrating a payment provider, calling an external service, handling service failures
  gracefully, implementing fallback behavior when a dependency is unavailable, or adding retry
  logic. Also applies when the user says things like "the payment provider can change" or
  "what happens if the service is down".
---

# External Service Adapter

## Purpose

External services are a primary source of architectural risk: they fail, they change, and they
slow down. This skill helps you contain that risk by building a clean boundary between your
domain logic and any external dependency.

The core idea is simple: **your domain never imports an HTTP client or SDK directly**. Instead,
it talks to an interface you own, and a concrete adapter handles the real communication. This
means you can swap providers and implement fallbacks without touching business logic.

---

## When to apply this pattern

Apply this whenever:
- The system integrates with a third-party API (payments, auth, maps, AI, email, SMS)
- The provider might change in the future
- You need graceful degradation when the service is unavailable
- Response time or reliability of the external service is uncertain

---

## Core artifacts

For each external service, produce two artifacts:

- **Port** — the TypeScript interface that the domain depends on
- **Adapter** — the concrete class that implements the Port and handles all communication with the real API

If the project has multiple implementations of the same Port (e.g., two payment providers that
can be swapped), consider adding a factory function that encapsulates which implementation to
instantiate. This is optional — if there is only one implementation, instantiate it directly
where needed.

The domain layer imports only from the Port, never from the Adapter directly.

---

## Step-by-step generation guide

### 1. Define the Port (interface)

The Port is the contract. It should reflect what the domain *needs*, not what the API *offers*.
Keep it minimal — only the methods the application actually calls.

```typescript
// PaymentPort.ts
export interface PaymentResult {
  transactionId: string;
  status: 'accepted' | 'rejected' | 'pending';
  amount: number;
  currency: string;
  timestamp: Date;
}

export interface PaymentPort {
  processPayment(amount: number, currency: string, token: string): Promise<PaymentResult>;
  getPaymentStatus(transactionId: string): Promise<PaymentResult>;
}
```

Design principles for the Port:
- Use domain language, not vendor language (e.g., `processPayment`, not `createCharge`)
- Return your own types, not the vendor's response objects
- Keep error types in the interface if they're meaningful to the domain
- Avoid exposing vendor-specific configuration here

---

### 2. Implement the Adapter

The Adapter translates between your Port and the external API. All vendor-specific logic
(headers, auth, retry, response mapping) lives here.

```typescript
// PaymentAdapter.ts
import axios, { AxiosInstance } from 'axios';
import { PaymentPort, PaymentResult } from './PaymentPort';

export class ExternalServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

export class PaymentAdapter implements PaymentPort {
  private client: AxiosInstance;
  private readonly TIMEOUT_MS = 5000;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.PAYMENT_API_URL,
      timeout: this.TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async processPayment(amount: number, currency: string, token: string): Promise<PaymentResult> {
    try {
      const response = await this.client.post('/charges', { amount, currency, token });
      return this.mapToPaymentResult(response.data);
    } catch (error) {
      throw this.wrapError(error, 'processPayment');
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
    try {
      const response = await this.client.get(`/charges/${transactionId}`);
      return this.mapToPaymentResult(response.data);
    } catch (error) {
      throw this.wrapError(error, 'getPaymentStatus');
    }
  }

  private mapToPaymentResult(data: any): PaymentResult {
    return {
      transactionId: data.id,
      status: this.mapStatus(data.status),
      amount: data.amount,
      currency: data.currency,
      timestamp: new Date(data.created_at),
    };
  }

  private mapStatus(vendorStatus: string): 'accepted' | 'rejected' | 'pending' {
    const statusMap: Record<string, 'accepted' | 'rejected' | 'pending'> = {
      succeeded: 'accepted',
      failed: 'rejected',
      pending: 'pending',
    };
    return statusMap[vendorStatus] ?? 'pending';
  }

  private wrapError(error: unknown, operation: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message ?? error.message;
      return new ExternalServiceError(
        `Payment service error in ${operation}: [${status}] ${message}`
      );
    }
    return new ExternalServiceError(`Unexpected error in ${operation}: ${String(error)}`);
  }
}
```

Key decisions in the Adapter:
- Timeout is always set explicitly — never rely on the default (it's usually infinite)
- Config comes from environment variables, never hardcoded
- Errors are caught and re-thrown as your own error type
- Response mapping is isolated in a private method so it's easy to update when the API changes

---

### 3. Use the Port in the domain

```typescript
// BookingService.ts
import { PaymentPort } from './PaymentPort';

export class BookingService {
  constructor(private readonly paymentService: PaymentPort) {}

  async confirmBooking(bookingId: string, amount: number) {
    const result = await this.paymentService.processPayment(amount, 'USD', bookingId);
    if (result.status === 'rejected') {
      throw new Error('Payment was rejected');
    }
    // rest of domain logic
  }
}
```

`BookingService` imports only `PaymentPort` — zero knowledge of Axios, the vendor name, or
HTTP details.

---

## Retry with exponential backoff

For services where transient failures are common, adding retry logic inside the Adapter
protects the caller without changing the Port contract.

Because the backoff logic is generic and reusable across multiple adapters, implement it as a
shared utility rather than duplicating it in each adapter:

```typescript
// retry.ts
import axios from 'axios';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  operationName: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === options.maxAttempts) break;

      // Exponential backoff: 200ms → 400ms → 800ms... capped at maxDelayMs
      const delay = Math.min(options.baseDelayMs * 2 ** (attempt - 1), options.maxDelayMs);
      console.warn(`[${operationName}] Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    // Retry on network errors and 5xx; never on 4xx (client error — retrying won't help)
    return !error.response || error.response.status >= 500;
  }
  return false;
}
```

Usage inside an Adapter:

```typescript
// Safe to retry — reading status is idempotent
async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
  return withRetry(
    () => this.client.get(`/charges/${transactionId}`).then(r => this.mapToPaymentResult(r.data)),
    { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 2000 },
    'getPaymentStatus'
  );
}

// NOT retried — charging twice would be a serious bug
async processPayment(amount: number, currency: string, token: string): Promise<PaymentResult> {
  try {
    const response = await this.client.post('/charges', { amount, currency, token });
    return this.mapToPaymentResult(response.data);
  } catch (error) {
    throw this.wrapError(error, 'processPayment');
  }
}
```

Use retry only for **idempotent operations** — reads and operations that are safe to repeat.
Never auto-retry a write that could be applied twice.

---

## Fallback and degraded mode

When a service is non-critical (e.g., email notifications), wrap the adapter call so the
application keeps running even if the service is down:

```typescript
async send(to: string, subject: string, body: string): Promise<void> {
  try {
    await new EmailAdapter().send(to, subject, body);
  } catch (error) {
    // Degraded: log locally and continue — notification is not blocking
    console.warn(`[Notification] Failed to send to ${to}. Degraded mode.`, error);
  }
}
```

For critical services (payments, auth), propagate the error — don't silently ignore it.
Reserve silent fallbacks for non-blocking side effects.

---

## Environment variables checklist

Every adapter must read its config from env vars. Document them in `.env.example`:

```
PAYMENT_API_URL=https://api.payment-provider.com
PAYMENT_API_KEY=your-api-key-here
```

Never commit real credentials. Never hardcode URLs or keys in source files.

---

## Common mistakes to avoid

**Calling the external API from a service or controller directly:**
```typescript
// ❌ Wrong — domain is coupled to vendor SDK
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_KEY!);
const charge = await stripe.charges.create({ amount, currency, source: token });
```

**Swallowing errors silently in critical adapters:**
```typescript
// ❌ Wrong — payment failure becomes invisible
try {
  return await this.client.post('/charges', body);
} catch {
  return null;
}
```

**Putting business logic inside the adapter:**
```typescript
// ❌ Wrong — adapter is doing domain work
if (charge.status === 'failed' && charge.amount > 1000) {
  await this.notifyFraudTeam(); // this belongs in a service, not here
}
```

**Retrying a non-idempotent operation:**
```typescript
// ❌ Wrong — could charge the user twice
async processPayment(...) {
  return withRetry(() => this.client.post('/charges', body), { maxAttempts: 3, ... });
}
```

---

## Quick reference

| Situation | Approach |
|---|---|
| Non-critical service unavailable at runtime | Wrap call — log and continue |
| Critical service unavailable at runtime | Propagate error — let the caller decide |
| Transient failures on safe read operations | Retry with exponential backoff |
| Write operations that could be applied twice | No retry — propagate the error |
| Multiple providers that can be swapped | Add a factory function to encapsulate the choice |
