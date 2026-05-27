import type {
  AuthAuditEventType,
  AuthAuditLogDTO,
  ClientType,
  ListAuthAuditLogsQueryDTO,
  PaginatedResult,
  RegisterClientDTO,
  RequestContext,
  UserDTO,
} from "@move/shared";
import { HttpError } from "@move/shared";
import { createAuth0User } from "./auth0-provider";
import { listAuditLogs, recordAuditLog } from "./audit";
import { createUserRecord, getUserByEmail } from "../users/service";

const clientTypes: readonly ClientType[] = ["individual", "company"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NormalizedRegisterClientInput extends RegisterClientDTO {
  email: string;
  password: string;
  name: string;
  clientType: ClientType;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  companyName: string | null;
  taxId: string | null;
}

export interface ListAuditLogsInput {
  eventType?: unknown;
  email?: unknown;
  userId?: unknown;
  from?: unknown;
  to?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export async function registerClient(
  input: unknown,
  context: RequestContext
): Promise<UserDTO> {
  let email: string | undefined;
  let clientType: ClientType | undefined;

  try {
    const dto = normalizeRegisterClientInput(input);
    email = dto.email;
    clientType = dto.clientType;

    const existing = await getUserByEmail(email);
    if (existing) {
      throw new HttpError(409, "User already exists", "user_exists");
    }

    const authSubject = await createAuth0User(dto);
    const user = await createUserRecord({
      authSubject,
      email,
      name: dto.name,
      role: "client",
      clientType,
      phone: dto.phone,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      companyName: dto.companyName,
      taxId: dto.taxId,
    });

    await recordAuditLog({
      ...context,
      eventType: "registration_success",
      decision: "success",
      statusCode: 201,
      userId: user.id,
      authSubject: user.authSubject,
      email: user.email,
      role: user.role,
      clientType: user.clientType,
    });

    return user;
  } catch (error) {
    await recordAuditLog({
      ...context,
      eventType: "registration_failure",
      decision: "failed",
      statusCode: error instanceof HttpError ? error.statusCode : 500,
      email,
      clientType,
      reason: error instanceof Error ? error.message : "Registration failed",
    });
    throw error;
  }
}

export async function getAuthenticatedProfile(
  user: UserDTO | undefined
): Promise<{ user: UserDTO }> {
  if (!user) {
    throw new HttpError(401, "Authentication required", "authentication_required");
  }

  return { user };
}

export async function listAuthAuditLogsForHttp(
  input: ListAuditLogsInput
): Promise<PaginatedResult<AuthAuditLogDTO>> {
  const filters: ListAuthAuditLogsQueryDTO = {};

  if (typeof input.eventType === "string") {
    filters.eventType = input.eventType as AuthAuditEventType;
  }
  if (typeof input.email === "string") {
    filters.email = input.email;
  }
  if (typeof input.userId === "string") {
    filters.userId = input.userId;
  }
  if (typeof input.from === "string") {
    filters.from = input.from;
  }
  if (typeof input.to === "string") {
    filters.to = input.to;
  }

  const page = parsePage(input.page);
  if (page !== undefined) {
    filters.page = page;
  }

  const pageSize = parsePage(input.pageSize);
  if (pageSize !== undefined) {
    filters.pageSize = pageSize;
  }

  return listAuditLogs(filters);
}

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

function normalizeName(name: unknown): string {
  return normalizeRequiredString(name, "Name");
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

function normalizeRegisterClientInput(input: unknown): NormalizedRegisterClientInput {
  const payload = getPayload(input);

  return {
    email: normalizeEmail(payload["email"]),
    password: normalizePassword(payload["password"]),
    name: normalizeName(payload["name"]),
    clientType: normalizeClientType(payload["clientType"]),
    phone: normalizeOptionalText(payload["phone"], "phone"),
    documentType: normalizeOptionalText(payload["documentType"], "documentType"),
    documentNumber: normalizeOptionalText(payload["documentNumber"], "documentNumber"),
    companyName: normalizeOptionalText(payload["companyName"], "companyName"),
    taxId: normalizeOptionalText(payload["taxId"], "taxId"),
  };
}

function parsePage(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}


