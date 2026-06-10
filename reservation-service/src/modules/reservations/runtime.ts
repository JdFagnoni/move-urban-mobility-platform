import { LoggingReservationEmailAdapter } from "./adapters/LoggingReservationEmailAdapter";
import { SmtpReservationEmailAdapter } from "./adapters/SmtpReservationEmailAdapter";
import type { ReservationEmailPort } from "./ports/ReservationEmailPort";

export const reservationEmailProvider = createReservationEmailProvider();

function createReservationEmailProvider(): ReservationEmailPort {
  const host = process.env["SMTP_HOST"]?.trim();
  const fromEmail = process.env["SMTP_FROM_EMAIL"]?.trim();

  if (!host || !fromEmail) {
    return new LoggingReservationEmailAdapter();
  }

  const port = parsePort(process.env["SMTP_PORT"]);
  const secure = parseBoolean(process.env["SMTP_SECURE"]);
  const user = normalizeOptionalString(process.env["SMTP_USER"]);
  const pass = normalizeOptionalString(process.env["SMTP_PASS"]);
  const fromName = normalizeOptionalString(process.env["SMTP_FROM_NAME"]) ?? "MOVE";

  return new SmtpReservationEmailAdapter({
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
  });
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 587;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}
