import { randomUUID } from "crypto";
import type {
  CompanyLocationDTO,
  CompanyProductDTO,
  CreateCompanyLocationDTO,
  CreateCompanyProductDTO,
  RequestContext,
  UpdateCompanyLocationDTO,
  UpdateCompanyProductDTO,
  UserDTO,
} from "@move/shared";
import { HttpError } from "@move/shared";
import { Op, UniqueConstraintError } from "sequelize";
import {
  CategoryModel,
  CompanyLocationModel,
  CompanyProductModel,
} from "../../db/models";
import { recordAuditLog } from "../auth/audit";
import { mapCompanyLocation, mapCompanyProduct } from "./mapper";

interface CompanyScopedInput {
  currentUser: UserDTO | undefined;
  context: RequestContext;
}

interface CreateCompanyProductInput extends CompanyScopedInput {
  dto: CreateCompanyProductDTO;
}

interface UpdateCompanyProductInput extends CompanyScopedInput {
  id: string;
  dto: UpdateCompanyProductDTO;
}

interface CompanyProductTargetInput extends CompanyScopedInput {
  id: string;
}

interface CreateCompanyLocationInput extends CompanyScopedInput {
  dto: CreateCompanyLocationDTO;
}

interface UpdateCompanyLocationInput extends CompanyScopedInput {
  id: string;
  dto: UpdateCompanyLocationDTO;
}

interface CompanyLocationTargetInput extends CompanyScopedInput {
  id: string;
}

export async function listCompanyProductsForHttp(
  input: CompanyScopedInput
): Promise<CompanyProductDTO[]> {
  const currentUser = await requireCompanyClient(input.currentUser, input.context);
  const rows = await CompanyProductModel.findAll({
    where: { clientId: currentUser.id },
    order: [["productName", "ASC"]],
  });

  return rows.map(mapCompanyProduct);
}

export async function createCompanyProductForHttp(
  input: CreateCompanyProductInput
): Promise<CompanyProductDTO> {
  const currentUser = await requireCompanyClient(input.currentUser, input.context);
  const productName = normalizeRequiredText(input.dto.productName, "productName", "invalid_company_product");
  await ensureActiveCategory(input.dto.categoryId);
  await ensureUniqueProductName(currentUser.id, productName);

  try {
    const row = await CompanyProductModel.create({
      id: randomUUID(),
      clientId: currentUser.id,
      productName,
      categoryId: input.dto.categoryId.trim(),
    });

    return mapCompanyProduct(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "Product already exists", "company_product_exists");
    }
    throw error;
  }
}

export async function updateCompanyProductForHttp(
  input: UpdateCompanyProductInput
): Promise<CompanyProductDTO> {
  const currentUser = await requireCompanyClient(input.currentUser, input.context);
  const row = await requireCompanyProduct(input.id, currentUser.id);

  if (input.dto.productName !== undefined) {
    const productName = normalizeRequiredText(
      input.dto.productName,
      "productName",
      "invalid_company_product"
    );
    await ensureUniqueProductName(currentUser.id, productName, row.id);
    row.productName = productName;
  }

  if (input.dto.categoryId !== undefined) {
    const categoryId = normalizeRequiredText(
      input.dto.categoryId,
      "categoryId",
      "invalid_company_product"
    );
    await ensureActiveCategory(categoryId);
    row.categoryId = categoryId;
  }

  try {
    await row.save();
    return mapCompanyProduct(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "Product already exists", "company_product_exists");
    }
    throw error;
  }
}

export async function deleteCompanyProductForHttp(
  input: CompanyProductTargetInput
): Promise<void> {
  const currentUser = await requireCompanyClient(input.currentUser, input.context);
  const row = await requireCompanyProduct(input.id, currentUser.id);
  await row.destroy();
}

export async function listCompanyLocationsForHttp(
  input: CompanyScopedInput
): Promise<CompanyLocationDTO[]> {
  const currentUser = await requireCompanyClient(input.currentUser, input.context);
  const rows = await CompanyLocationModel.findAll({
    where: { clientId: currentUser.id },
    order: [["label", "ASC"]],
  });

  return rows.map(mapCompanyLocation);
}

export async function createCompanyLocationForHttp(
  input: CreateCompanyLocationInput
): Promise<CompanyLocationDTO> {
  const currentUser = await requireCompanyClient(input.currentUser, input.context);
  const label = normalizeRequiredText(input.dto.label, "label", "invalid_company_location");
  await ensureUniqueLocationLabel(currentUser.id, label);

  try {
    const row = await CompanyLocationModel.create({
      id: randomUUID(),
      clientId: currentUser.id,
      label,
      kind: input.dto.kind,
      location: input.dto.location,
    });

    return mapCompanyLocation(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "Location already exists", "company_location_exists");
    }
    throw error;
  }
}

export async function updateCompanyLocationForHttp(
  input: UpdateCompanyLocationInput
): Promise<CompanyLocationDTO> {
  const currentUser = await requireCompanyClient(input.currentUser, input.context);
  const row = await requireCompanyLocation(input.id, currentUser.id);

  if (input.dto.label !== undefined) {
    const label = normalizeRequiredText(input.dto.label, "label", "invalid_company_location");
    await ensureUniqueLocationLabel(currentUser.id, label, row.id);
    row.label = label;
  }

  if (input.dto.kind !== undefined) {
    row.kind = input.dto.kind;
  }

  if (input.dto.location !== undefined) {
    row.location = input.dto.location;
  }

  try {
    await row.save();
    return mapCompanyLocation(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "Location already exists", "company_location_exists");
    }
    throw error;
  }
}

export async function deleteCompanyLocationForHttp(
  input: CompanyLocationTargetInput
): Promise<void> {
  const currentUser = await requireCompanyClient(input.currentUser, input.context);
  const row = await requireCompanyLocation(input.id, currentUser.id);
  await row.destroy();
}

function normalizeRequiredText(value: string, field: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, `${field} is required`, code);
  }

  return normalized;
}

async function ensureActiveCategory(categoryId: string): Promise<void> {
  const normalizedCategoryId = normalizeRequiredText(
    categoryId,
    "categoryId",
    "invalid_company_product"
  );
  if (!isUuid(normalizedCategoryId)) {
    throw new HttpError(400, "categoryId must be a valid UUID", "invalid_company_product");
  }

  const category = await CategoryModel.findOne({
    where: { id: normalizedCategoryId, active: true },
  });

  if (!category) {
    throw new HttpError(404, "Category not found", "category_not_found");
  }
}

async function ensureUniqueProductName(
  clientId: string,
  productName: string,
  currentId?: string
): Promise<void> {
  const duplicate = await CompanyProductModel.findOne({
    where: {
      clientId,
      productName: { [Op.iLike]: productName },
      ...(currentId ? { id: { [Op.ne]: currentId } } : {}),
    },
  });

  if (duplicate) {
    throw new HttpError(409, "Product already exists", "company_product_exists");
  }
}

async function ensureUniqueLocationLabel(
  clientId: string,
  label: string,
  currentId?: string
): Promise<void> {
  const duplicate = await CompanyLocationModel.findOne({
    where: {
      clientId,
      label: { [Op.iLike]: label },
      ...(currentId ? { id: { [Op.ne]: currentId } } : {}),
    },
  });

  if (duplicate) {
    throw new HttpError(409, "Location already exists", "company_location_exists");
  }
}

async function requireCompanyProduct(id: string, clientId: string): Promise<CompanyProductModel> {
  const row = await CompanyProductModel.findOne({
    where: { id, clientId },
  });

  if (!row) {
    throw new HttpError(404, "Company product not found", "company_product_not_found");
  }

  return row;
}

async function requireCompanyLocation(
  id: string,
  clientId: string
): Promise<CompanyLocationModel> {
  const row = await CompanyLocationModel.findOne({
    where: { id, clientId },
  });

  if (!row) {
    throw new HttpError(404, "Company location not found", "company_location_not_found");
  }

  return row;
}

async function requireCompanyClient(
  currentUser: UserDTO | undefined,
  context: RequestContext
): Promise<UserDTO> {
  const user = requireCurrentUser(currentUser);
  if (user.role !== "client" || user.clientType !== "company") {
    return auditAccessDenied(context, user, "Only company clients can manage preregistrations");
  }

  return user;
}

function requireCurrentUser(currentUser: UserDTO | undefined): UserDTO {
  if (!currentUser) {
    throw new HttpError(401, "Authentication required", "authentication_required");
  }

  return currentUser;
}

async function auditAccessDenied(
  context: RequestContext,
  currentUser: UserDTO,
  reason: string
): Promise<never> {
  await recordAuditLog({
    ...context,
    eventType: "access_denied",
    decision: "denied",
    statusCode: 403,
    userId: currentUser.id,
    authSubject: currentUser.authSubject,
    email: currentUser.email,
    role: currentUser.role,
    clientType: currentUser.clientType,
    reason,
  });

  throw new HttpError(403, "Forbidden", "forbidden");
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof UniqueConstraintError;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
