import type { GeoPoint } from "./zone";

export type CompanyLocationKind = "origin" | "destination" | "both";

export const COMPANY_LOCATION_KINDS: readonly CompanyLocationKind[] = [
  "origin",
  "destination",
  "both",
];

export interface CompanyProductDTO {
  id: string;
  clientId: string;
  productName: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyProductDTO {
  productName: string;
  categoryId: string;
}

export interface UpdateCompanyProductDTO {
  productName?: string;
  categoryId?: string;
}

export interface CompanyLocationDTO {
  id: string;
  clientId: string;
  label: string;
  kind: CompanyLocationKind;
  location: GeoPoint;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyLocationDTO {
  label: string;
  kind: CompanyLocationKind;
  location: GeoPoint;
}

export interface UpdateCompanyLocationDTO {
  label?: string;
  kind?: CompanyLocationKind;
  location?: GeoPoint;
}
