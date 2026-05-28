import type {
  CompanyLocationKind,
  CreateCompanyLocationDTO,
  CreateCompanyProductDTO,
  GeoPoint,
  UpdateCompanyLocationDTO,
  UpdateCompanyProductDTO,
} from "@move/shared";
import { COMPANY_LOCATION_KINDS, HttpError } from "@move/shared";

function getPayload(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "A valid preregistration payload is required", code);
  }

  return value as Record<string, unknown>;
}

function parseOptionalString(value: unknown, field: string, code: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`, code);
  }

  return value;
}

function parseRequiredString(value: unknown, field: string, code: string): string {
  const parsed = parseOptionalString(value, field, code);
  if (parsed === undefined) {
    throw new HttpError(400, `${field} is required`, code);
  }

  return parsed;
}

function parseLocationKind(
  value: unknown,
  field: string,
  code: string
): CompanyLocationKind | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !COMPANY_LOCATION_KINDS.includes(value as CompanyLocationKind)) {
    throw new HttpError(400, `${field} must be a valid location kind`, code);
  }

  return value as CompanyLocationKind;
}

function parseGeoPoint(value: unknown, field: string, code: string): GeoPoint | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an object`, code);
  }

  const payload = value as Record<string, unknown>;
  if (payload["type"] !== "Point") {
    throw new HttpError(400, `${field}.type must be 'Point'`, code);
  }

  const coordinates = payload["coordinates"];
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new HttpError(400, `${field}.coordinates must contain longitude and latitude`, code);
  }

  const longitude = coordinates[0];
  const latitude = coordinates[1];
  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude)
  ) {
    throw new HttpError(400, `${field}.coordinates must contain valid numbers`, code);
  }

  return {
    type: "Point",
    coordinates: [longitude, latitude],
  };
}

export function parseCreateCompanyProductDTO(input: unknown): CreateCompanyProductDTO {
  const payload = getPayload(input, "invalid_company_product");
  return {
    productName: parseRequiredString(payload["productName"], "productName", "invalid_company_product"),
    categoryId: parseRequiredString(payload["categoryId"], "categoryId", "invalid_company_product"),
  };
}

export function parseUpdateCompanyProductDTO(input: unknown): UpdateCompanyProductDTO {
  const payload = getPayload(input, "invalid_company_product");
  const dto: UpdateCompanyProductDTO = {};

  const productName = parseOptionalString(
    payload["productName"],
    "productName",
    "invalid_company_product"
  );
  if (productName !== undefined) {
    dto.productName = productName;
  }

  const categoryId = parseOptionalString(
    payload["categoryId"],
    "categoryId",
    "invalid_company_product"
  );
  if (categoryId !== undefined) {
    dto.categoryId = categoryId;
  }

  return dto;
}

export function parseCreateCompanyLocationDTO(input: unknown): CreateCompanyLocationDTO {
  const payload = getPayload(input, "invalid_company_location");
  const kind = parseLocationKind(payload["kind"], "kind", "invalid_company_location");
  const location = parseGeoPoint(payload["location"], "location", "invalid_company_location");
  if (!kind) {
    throw new HttpError(400, "kind is required", "invalid_company_location");
  }
  if (!location) {
    throw new HttpError(400, "location is required", "invalid_company_location");
  }

  return {
    label: parseRequiredString(payload["label"], "label", "invalid_company_location"),
    kind,
    location,
  };
}

export function parseUpdateCompanyLocationDTO(input: unknown): UpdateCompanyLocationDTO {
  const payload = getPayload(input, "invalid_company_location");
  const dto: UpdateCompanyLocationDTO = {};

  const label = parseOptionalString(payload["label"], "label", "invalid_company_location");
  if (label !== undefined) {
    dto.label = label;
  }

  const kind = parseLocationKind(payload["kind"], "kind", "invalid_company_location");
  if (kind !== undefined) {
    dto.kind = kind;
  }

  const location = parseGeoPoint(payload["location"], "location", "invalid_company_location");
  if (location !== undefined) {
    dto.location = location;
  }

  return dto;
}
