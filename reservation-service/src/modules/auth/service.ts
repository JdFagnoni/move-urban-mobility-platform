import type {
  AuthAuditEventType,
  AuthAuditLogDTO,
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

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new HttpError(400, "A valid email is required", "invalid_registration");
  }
  return normalized;
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new HttpError(400, "Name is required", "invalid_registration");
  }
  return normalized;
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new HttpError(400, "Password must have at least 8 characters", "invalid_registration");
  }
}

function parsePage(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
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
  dto: RegisterClientDTO,
  context: RequestContext
): Promise<UserDTO> {
  const email = normalizeEmail(dto.email);
  const name = normalizeName(dto.name);
  validatePassword(dto.password);
  const clientType = dto.clientType ?? "individual";

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      throw new HttpError(409, "User already exists", "user_exists");
    }

    const authSubject = await createAuth0User({ ...dto, email, name, clientType });
    const user = await createUserRecord({
      authSubject,
      email,
      name,
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
