import type { AuthProvider, ClientType, UserDTO, UserRole, UserStatus } from "@move/shared";

export interface UserRow {
  id: string;
  auth_provider: AuthProvider;
  auth_subject: string;
  email: string;
  name: string;
  role: UserRole;
  client_type: ClientType | null;
  status: UserStatus;
  phone: string | null;
  document_type: string | null;
  document_number: string | null;
  company_name: string | null;
  tax_id: string | null;
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return toIsoString(value);
}

export function mapUserRow(row: UserRow): UserDTO {
  return {
    id: row.id,
    authProvider: row.auth_provider,
    authSubject: row.auth_subject,
    email: row.email,
    name: row.name,
    role: row.role,
    clientType: row.client_type,
    status: row.status,
    phone: row.phone,
    documentType: row.document_type,
    documentNumber: row.document_number,
    companyName: row.company_name,
    taxId: row.tax_id,
    lastLoginAt: toNullableIsoString(row.last_login_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}
