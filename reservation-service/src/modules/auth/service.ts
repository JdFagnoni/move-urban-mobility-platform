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
import { parseRegisterClientDTO } from "./parser";
import { createAuth0User } from "./auth0-provider";
import { listAuditLogs, recordAuditLog } from "./audit";
import { createUserRecord, getUserByEmail } from "../users/service";

export interface ListAuditLogsInput {
  eventType?: unknown;
  email?: unknown;
  userId?: unknown;
  from?: unknown;
  to?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export async function registerClientForHttp(
  input: unknown,
  context: RequestContext
): Promise<UserDTO> {
  try {
    const dto = parseRegisterClientDTO(input);
    return await registerClient(dto, context);
  } catch (error) {
    if (isRegistrationParserError(error)) {
      const auditFields = getRegistrationAuditFields(input);
      await recordAuditLog({
        ...context,
        eventType: "registration_failure",
        decision: "failed",
        statusCode: error.statusCode,
        email: auditFields.email,
        clientType: auditFields.clientType,
        reason: error.message,
      });
    }

    throw error;
  }
}

export async function registerClient(
  dto: RegisterClientDTO,
  context: RequestContext
): Promise<UserDTO> {
  const email = dto.email;
  const clientType = dto.clientType ?? "individual";

  try {
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

function parsePage(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isRegistrationParserError(error: unknown): error is HttpError {
  return (
    error instanceof HttpError &&
    (error.code === "invalid_registration" || error.code === "invalid_client_type")
  );
}

function getRegistrationAuditFields(
  input: unknown
): { email?: string; clientType?: ClientType } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const payload = input as Record<string, unknown>;
  const email = typeof payload["email"] === "string" ? payload["email"].trim().toLowerCase() : undefined;
  const clientType = payload["clientType"];
  const auditFields: { email?: string; clientType?: ClientType } = {};

  if (email) {
    auditFields.email = email;
  }

  if (clientType === "individual" || clientType === "company") {
    auditFields.clientType = clientType;
  }

  return auditFields;
}
