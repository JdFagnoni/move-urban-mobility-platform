import { randomUUID } from "crypto";
import type {
  AuthProvider,
  ClientType,
  ListUsersQueryDTO,
  PaginatedResult,
  RequestContext,
  UpdateUserDTO,
  UserDTO,
  UserRole,
  UserStatus,
} from "@move/shared";
import { HttpError, query } from "@move/shared";
import { recordAuditLog } from "../auth/audit";
import { mapUserRow, type UserRow } from "./mapper";

const userRoles: readonly UserRole[] = ["admin", "operator", "client", "driver"];
const userStatuses: readonly UserStatus[] = ["active", "suspended", "disabled"];
const clientTypes: readonly ClientType[] = ["individual", "company"];

export interface CreateUserRecordInput {
  authSubject: string;
  email: string;
  name: string;
  role: UserRole;
  clientType: ClientType | null;
  phone?: string | null | undefined;
  documentType?: string | null | undefined;
  documentNumber?: string | null | undefined;
  companyName?: string | null | undefined;
  taxId?: string | null | undefined;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, `${field} is required`, "invalid_user");
  }
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
}

function parsePage(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function assertRole(value: string): asserts value is UserRole {
  if (!userRoles.includes(value as UserRole)) {
    throw new HttpError(400, "Invalid user role", "invalid_user_role");
  }
}

function assertStatus(value: string): asserts value is UserStatus {
  if (!userStatuses.includes(value as UserStatus)) {
    throw new HttpError(400, "Invalid user status", "invalid_user_status");
  }
}

function assertClientType(value: string): asserts value is ClientType {
  if (!clientTypes.includes(value as ClientType)) {
    throw new HttpError(400, "Invalid client type", "invalid_client_type");
  }
}

function validateRoleAndClientType(
  role: UserRole,
  clientType: ClientType | null
): ClientType | null {
  if (role === "client") {
    if (!clientType) {
      throw new HttpError(400, "Client type is required for client users", "invalid_client_type");
    }
    return clientType;
  }

  return null;
}

function requireCurrentUser(currentUser: UserDTO | undefined): UserDTO {
  if (!currentUser) {
    throw new HttpError(401, "Authentication required", "authentication_required");
  }

  return currentUser;
}

function isAdmin(user: UserDTO): boolean {
  return user.role === "admin";
}

function buildSelfUpdateDTO(body: Partial<UpdateUserDTO>): UpdateUserDTO {
  const dto: UpdateUserDTO = {};
  if (body.name !== undefined) {
    dto.name = body.name;
  }
  if (body.phone !== undefined) {
    dto.phone = body.phone;
  }
  if (body.documentType !== undefined) {
    dto.documentType = body.documentType;
  }
  if (body.documentNumber !== undefined) {
    dto.documentNumber = body.documentNumber;
  }
  if (body.companyName !== undefined) {
    dto.companyName = body.companyName;
  }
  if (body.taxId !== undefined) {
    dto.taxId = body.taxId;
  }
  return dto;
}

async function auditAccessDenied(
  context: RequestContext,
  currentUser: UserDTO | undefined,
  reason: string
): Promise<never> {
  await recordAuditLog({
    ...context,
    eventType: "access_denied",
    decision: "denied",
    statusCode: 403,
    userId: currentUser?.id,
    authSubject: currentUser?.authSubject,
    email: currentUser?.email,
    role: currentUser?.role,
    clientType: currentUser?.clientType,
    reason,
  });

  throw new HttpError(403, "Forbidden", "forbidden");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function createUserRecord(input: CreateUserRecordInput): Promise<UserDTO> {
  const email = normalizeEmail(input.email);
  const name = normalizeText(input.name, "name");
  const clientType = validateRoleAndClientType(input.role, input.clientType);

  try {
    const result = await query<UserRow>(
      `
        INSERT INTO users (
          id,
          auth_provider,
          auth_subject,
          email,
          name,
          role,
          client_type,
          status,
          phone,
          document_type,
          document_number,
          company_name,
          tax_id
        )
        VALUES ($1, 'auth0', $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        randomUUID(),
        normalizeText(input.authSubject, "authSubject"),
        email,
        name,
        input.role,
        clientType,
        normalizeOptionalText(input.phone),
        normalizeOptionalText(input.documentType),
        normalizeOptionalText(input.documentNumber),
        normalizeOptionalText(input.companyName),
        normalizeOptionalText(input.taxId),
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new HttpError(500, "User creation failed", "user_create_failed");
    }
    return mapUserRow(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "User already exists", "user_exists");
    }
    throw error;
  }
}

export async function getUser(id: string): Promise<UserDTO | null> {
  const result = await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function getUserByAuthSubject(
  authSubject: string,
  authProvider: AuthProvider = "auth0"
): Promise<UserDTO | null> {
  const result = await query<UserRow>(
    "SELECT * FROM users WHERE auth_provider = $1 AND auth_subject = $2",
    [authProvider, authSubject]
  );
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function getUserByEmail(email: string): Promise<UserDTO | null> {
  const result = await query<UserRow>("SELECT * FROM users WHERE lower(email) = $1", [
    normalizeEmail(email),
  ]);
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function listUsers(
  filters: ListUsersQueryDTO = {}
): Promise<PaginatedResult<UserDTO>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.role) {
    assertRole(filters.role);
    params.push(filters.role);
    clauses.push(`role = $${params.length}`);
  }

  if (filters.status) {
    assertStatus(filters.status);
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }

  if (filters.clientType) {
    assertClientType(filters.clientType);
    params.push(filters.clientType);
    clauses.push(`client_type = $${params.length}`);
  }

  if (filters.email) {
    params.push(`%${normalizeEmail(filters.email)}%`);
    clauses.push(`lower(email) LIKE $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countResult = await query<{ total: string }>(
    `SELECT count(*) AS total FROM users ${where}`,
    params
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  params.push(pageSize, offset);
  const result = await query<UserRow>(
    `
      SELECT *
      FROM users
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return {
    data: result.rows.map(mapUserRow),
    total,
    page,
    pageSize,
  };
}

export interface ListUsersInput {
  role?: unknown;
  status?: unknown;
  clientType?: unknown;
  email?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export async function listUsersForHttp(
  input: ListUsersInput = {}
): Promise<PaginatedResult<UserDTO>> {
  const filters: ListUsersQueryDTO = {};

  if (typeof input.role === "string") {
    filters.role = input.role as UserRole;
  }
  if (typeof input.status === "string") {
    filters.status = input.status as UserStatus;
  }
  if (typeof input.clientType === "string") {
    filters.clientType = input.clientType as ClientType;
  }
  if (typeof input.email === "string") {
    filters.email = input.email;
  }

  const page = parsePage(input.page);
  if (page !== undefined) {
    filters.page = page;
  }

  const pageSize = parsePage(input.pageSize);
  if (pageSize !== undefined) {
    filters.pageSize = pageSize;
  }

  return listUsers(filters);
}

export async function updateUser(id: string, dto: UpdateUserDTO): Promise<UserDTO | null> {
  const current = await getUser(id);
  if (!current) {
    return null;
  }

  const nextRole = dto.role ?? current.role;
  assertRole(nextRole);

  const requestedClientType =
    dto.clientType === undefined ? (current.clientType ?? null) : dto.clientType;
  if (requestedClientType) {
    assertClientType(requestedClientType);
  }

  const nextStatus = dto.status ?? current.status;
  assertStatus(nextStatus);

  const nextClientType = validateRoleAndClientType(nextRole, requestedClientType);
  const result = await query<UserRow>(
    `
      UPDATE users
      SET
        name = $2,
        role = $3,
        client_type = $4,
        status = $5,
        phone = $6,
        document_type = $7,
        document_number = $8,
        company_name = $9,
        tax_id = $10,
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      dto.name === undefined ? current.name : normalizeText(dto.name, "name"),
      nextRole,
      nextClientType,
      nextStatus,
      dto.phone === undefined ? (current.phone ?? null) : normalizeOptionalText(dto.phone),
      dto.documentType === undefined
        ? (current.documentType ?? null)
        : normalizeOptionalText(dto.documentType),
      dto.documentNumber === undefined
        ? (current.documentNumber ?? null)
        : normalizeOptionalText(dto.documentNumber),
      dto.companyName === undefined
        ? (current.companyName ?? null)
        : normalizeOptionalText(dto.companyName),
      dto.taxId === undefined ? (current.taxId ?? null) : normalizeOptionalText(dto.taxId),
    ]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function updateUserStatus(id: string, status: UserStatus): Promise<UserDTO | null> {
  assertStatus(status);
  return updateUser(id, { status });
}

export async function touchLastLogin(id: string): Promise<void> {
  await query("UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1", [id]);
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await updateUserStatus(id, "disabled");
  return Boolean(result);
}

async function requireUser(id: string): Promise<UserDTO> {
  const user = await getUser(id);
  if (!user) {
    throw new HttpError(404, "User not found", "user_not_found");
  }

  return user;
}

export interface GetUserProfileInput {
  id: string;
  currentUser: UserDTO | undefined;
  context: RequestContext;
}

export async function getUserProfile(input: GetUserProfileInput): Promise<UserDTO> {
  const currentUser = requireCurrentUser(input.currentUser);
  if (!isAdmin(currentUser) && currentUser.id !== input.id) {
    return auditAccessDenied(input.context, currentUser, "Users can only read their own profile");
  }

  return requireUser(input.id);
}

export interface UpdateUserProfileInput {
  id: string;
  dto: Partial<UpdateUserDTO>;
  currentUser: UserDTO | undefined;
  context: RequestContext;
}

export async function updateUserProfile(input: UpdateUserProfileInput): Promise<UserDTO> {
  const currentUser = requireCurrentUser(input.currentUser);
  if (!isAdmin(currentUser) && currentUser.id !== input.id) {
    return auditAccessDenied(input.context, currentUser, "Users can only update their own profile");
  }

  const dto = isAdmin(currentUser) ? input.dto : buildSelfUpdateDTO(input.dto);
  const result = await updateUser(input.id, dto);
  if (!result) {
    throw new HttpError(404, "User not found", "user_not_found");
  }

  await recordAuditLog({
    ...input.context,
    eventType: "profile_updated",
    decision: "success",
    statusCode: 200,
    userId: result.id,
    authSubject: result.authSubject,
    email: result.email,
    role: result.role,
    clientType: result.clientType,
    metadata: { changedBy: currentUser.id },
  });

  return result;
}

export interface UpdateUserStatusInput {
  id: string;
  status?: unknown;
  context: RequestContext;
}

export async function updateUserStatusForHttp(input: UpdateUserStatusInput): Promise<UserDTO> {
  if (typeof input.status !== "string" || !input.status) {
    throw new HttpError(400, "status is required", "invalid_user_status");
  }

  const result = await updateUserStatus(input.id, input.status as UserStatus);
  if (!result) {
    throw new HttpError(404, "User not found", "user_not_found");
  }

  await recordAuditLog({
    ...input.context,
    eventType: "status_changed",
    decision: "success",
    statusCode: 200,
    userId: result.id,
    authSubject: result.authSubject,
    email: result.email,
    role: result.role,
    clientType: result.clientType,
    metadata: { status: result.status },
  });

  return result;
}

export async function deleteUserForHttp(id: string, context: RequestContext): Promise<void> {
  const disabled = await deleteUser(id);
  if (!disabled) {
    throw new HttpError(404, "User not found", "user_not_found");
  }

  await recordAuditLog({
    ...context,
    eventType: "status_changed",
    decision: "success",
    statusCode: 204,
    userId: id,
    metadata: { status: "disabled" },
  });
}
