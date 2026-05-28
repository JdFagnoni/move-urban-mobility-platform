import type { CompanyLocationDTO, CompanyProductDTO } from "@move/shared";
import type { CompanyLocationModel, CompanyProductModel } from "../../db/models";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function mapCompanyProduct(row: CompanyProductModel): CompanyProductDTO {
  return {
    id: row.id,
    clientId: row.clientId,
    productName: row.productName,
    categoryId: row.categoryId,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function mapCompanyLocation(row: CompanyLocationModel): CompanyLocationDTO {
  return {
    id: row.id,
    clientId: row.clientId,
    label: row.label,
    kind: row.kind,
    location: row.location,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
