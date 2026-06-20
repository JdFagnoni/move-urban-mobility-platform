// Helpers para preparar datos de clientes empresa (categoria + companyProduct),
// requeridos por F4.2 antes de poder crear una reserva de empresa. Reutilizado
// por el seed de clientes frecuentes y por los scripts de R1/R2/R8.

import http from "k6/http";
import { BASE_URL } from "./config";

export function firstCategoryId(token: string): string {
  const res = http.get(`${BASE_URL}/reservations/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 200) {
    throw new Error(`Could not list categories: ${res.status} ${res.body}`);
  }

  const categories = (res.json() as { data: Array<{ id: string; active?: boolean }> }).data;
  if (categories.length === 0) {
    throw new Error("No categories available to seed company products");
  }

  return (categories.find((c) => c.active !== false) ?? categories[0]).id;
}

export function createCompanyProduct(token: string, categoryId: string, label: string): string {
  const res = http.post(
    `${BASE_URL}/reservations/preregistrations/products`,
    JSON.stringify({ productName: `Seed Product ${label}`, categoryId }),
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );

  if (res.status !== 201) {
    throw new Error(`Could not create company product for ${label}: ${res.status} ${res.body}`);
  }

  return (res.json() as { data: { id: string } }).data.id;
}

export function ensureCompanyProduct(token: string, label: string): string {
  const categoryId = firstCategoryId(token);
  return createCompanyProduct(token, categoryId, label);
}
