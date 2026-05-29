import type { UserDTO } from "@move/shared";
import type { UserModel } from "../../db/models";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return toIsoString(value);
}

export function mapUser(row: UserModel): UserDTO {
  return {
    id: row.id,
    authProvider: row.authProvider,
    authSubject: row.authSubject,
    email: row.email,
    name: row.name,
    role: row.role,
    clientType: row.clientType,
    status: row.status,
    phone: row.phone,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    companyName: row.companyName,
    taxId: row.taxId,
    lastLoginAt: toNullableIsoString(row.lastLoginAt),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}
