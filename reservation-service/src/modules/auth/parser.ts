import type { ClientType, RegisterClientDTO } from "@move/shared";
import { HttpError } from "@move/shared";

const clientTypes: readonly ClientType[] = ["individual", "company"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "A valid registration payload is required", "invalid_registration");
  }

  return value as Record<string, unknown>;
}

function normalizeRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required`, "invalid_registration");
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, `${field} is required`, "invalid_registration");
  }

  return normalized;
}

function normalizeEmail(email: unknown): string {
  const normalized = normalizeRequiredString(email, "Email").toLowerCase();
  if (!emailPattern.test(normalized)) {
    throw new HttpError(400, "A valid email is required", "invalid_registration");
  }
  return normalized;
}

function normalizeOptionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`, "invalid_registration");
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeClientType(clientType: unknown): ClientType {
  if (clientType === undefined) {
    return "individual";
  }

  if (typeof clientType !== "string" || !clientTypes.includes(clientType as ClientType)) {
    throw new HttpError(400, "Invalid client type", "invalid_client_type");
  }

  return clientType as ClientType;
}

function normalizePassword(password: unknown): string {
  if (typeof password !== "string") {
    throw new HttpError(400, "Password is required", "invalid_registration");
  }

  if (!password.trim()) {
    throw new HttpError(400, "Password is required", "invalid_registration");
  }

  if (password.length < 8) {
    throw new HttpError(400, "Password must have at least 8 characters", "invalid_registration");
  }

  return password;
}

export function parseRegisterClientDTO(input: unknown): RegisterClientDTO {
  const payload = getPayload(input);

  return {
    email: normalizeEmail(payload["email"]),
    password: normalizePassword(payload["password"]),
    name: normalizeRequiredString(payload["name"], "Name"),
    clientType: normalizeClientType(payload["clientType"]),
    phone: normalizeOptionalText(payload["phone"], "phone"),
    documentType: normalizeOptionalText(payload["documentType"], "documentType"),
    documentNumber: normalizeOptionalText(payload["documentNumber"], "documentNumber"),
    companyName: normalizeOptionalText(payload["companyName"], "companyName"),
    taxId: normalizeOptionalText(payload["taxId"], "taxId"),
  };
}
