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
import { HttpError } from "@move/shared";
import { Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { UserModel } from "../../db/models";
import { recordAuditLog } from "../auth/audit";
import { mapUser } from "./mapper";

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
  return error instanceof UniqueConstraintError;
}

export async function createUserRecord(input: CreateUserRecordInput): Promise<UserDTO> {
  const email = normalizeEmail(input.email);
  const name = normalizeText(input.name, "name");
  const clientType = validateRoleAndClientType(input.role, input.clientType);

  try {
    const user = await UserModel.create({
      id: randomUUID(),
      authProvider: "auth0",
      authSubject: normalizeText(input.authSubject, "authSubject"),
      email,
      name,
      role: input.role,
      clientType,
      status: "active",
      phone: normalizeOptionalText(input.phone),
      documentType: normalizeOptionalText(input.documentType),
      documentNumber: normalizeOptionalText(input.documentNumber),
      companyName: normalizeOptionalText(input.companyName),
      taxId: normalizeOptionalText(input.taxId),
    });

    return mapUser(user);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "User already exists", "user_exists");
    }
    throw error;
  }
}

export async function getUser(id: string): Promise<UserDTO | null> {
  const user = await UserModel.findByPk(id);
  return user ? mapUser(user) : null;
}

export async function getUserByAuthSubject(
  authSubject: string,
  authProvider: AuthProvider = "auth0"
): Promise<UserDTO | null> {
  const user = await UserModel.findOne({
    where: { authProvider, authSubject },
  });
  return user ? mapUser(user) : null;
}

export async function getUserByEmail(email: string): Promise<UserDTO | null> {
  const user = await UserModel.findOne({
    where: { email: normalizeEmail(email) },
  });
  return user ? mapUser(user) : null;
}

export async function listUsers(
  filters: ListUsersQueryDTO = {}
): Promise<PaginatedResult<UserDTO>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const where: WhereOptions<UserModel> = {};

  if (filters.role) {
    assertRole(filters.role);
    where.role = filters.role;
  }

  if (filters.status) {
    assertStatus(filters.status);
    where.status = filters.status;
  }

  if (filters.clientType) {
    assertClientType(filters.clientType);
    where.clientType = filters.clientType;
  }

  if (filters.email) {
    where.email = { [Op.iLike]: `%${normalizeEmail(filters.email)}%` };
  }

  const result = await UserModel.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: pageSize,
    offset,
  });

  return {
    data: result.rows.map(mapUser),
    total: result.count,
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
  const current = await UserModel.findByPk(id);
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
  current.name = dto.name === undefined ? current.name : normalizeText(dto.name, "name");
  current.role = nextRole;
  current.clientType = nextClientType;
  current.status = nextStatus;
  current.phone = dto.phone === undefined ? (current.phone ?? null) : normalizeOptionalText(dto.phone);
  current.documentType =
    dto.documentType === undefined
      ? (current.documentType ?? null)
      : normalizeOptionalText(dto.documentType);
  current.documentNumber =
    dto.documentNumber === undefined
      ? (current.documentNumber ?? null)
      : normalizeOptionalText(dto.documentNumber);
  current.companyName =
    dto.companyName === undefined
      ? (current.companyName ?? null)
      : normalizeOptionalText(dto.companyName);
  current.taxId = dto.taxId === undefined ? (current.taxId ?? null) : normalizeOptionalText(dto.taxId);

  await current.save();
  return mapUser(current);
}

export async function updateUserStatus(id: string, status: UserStatus): Promise<UserDTO | null> {
  assertStatus(status);
  return updateUser(id, { status });
}

export async function touchLastLogin(id: string): Promise<void> {
  await UserModel.update({ lastLoginAt: new Date() }, { where: { id } });
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
