import type { UpdateUserDTO } from "@move/shared";
import { HttpError } from "@move/shared";

function getPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "A valid user payload is required", "invalid_user");
  }

  return value as Record<string, unknown>;
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`, "invalid_user");
  }

  return value;
}

function parseNullableOptionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`, "invalid_user");
  }

  return value;
}

export function parseUpdateUserDTO(input: unknown): Partial<UpdateUserDTO> {
  const payload = getPayload(input);
  const dto: Partial<UpdateUserDTO> = {};

  const name = parseOptionalString(payload["name"], "name");
  if (name !== undefined) {
    dto.name = name;
  }

  const role = parseOptionalString(payload["role"], "role");
  if (role !== undefined) {
    dto.role = role as NonNullable<UpdateUserDTO["role"]>;
  }

  const clientType = parseNullableOptionalString(payload["clientType"], "clientType");
  if (clientType !== undefined) {
    dto.clientType = clientType as Exclude<UpdateUserDTO["clientType"], undefined>;
  }

  const status = parseOptionalString(payload["status"], "status");
  if (status !== undefined) {
    dto.status = status as NonNullable<UpdateUserDTO["status"]>;
  }

  const phone = parseNullableOptionalString(payload["phone"], "phone");
  if (phone !== undefined) {
    dto.phone = phone;
  }

  const documentType = parseNullableOptionalString(payload["documentType"], "documentType");
  if (documentType !== undefined) {
    dto.documentType = documentType;
  }

  const documentNumber = parseNullableOptionalString(payload["documentNumber"], "documentNumber");
  if (documentNumber !== undefined) {
    dto.documentNumber = documentNumber;
  }

  const companyName = parseNullableOptionalString(payload["companyName"], "companyName");
  if (companyName !== undefined) {
    dto.companyName = companyName;
  }

  const taxId = parseNullableOptionalString(payload["taxId"], "taxId");
  if (taxId !== undefined) {
    dto.taxId = taxId;
  }

  return dto;
}
