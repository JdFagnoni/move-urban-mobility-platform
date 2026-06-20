// Helpers para preparar datos de clientes empresa (categoria + companyProduct),
// requeridos por F4.2 antes de poder crear una reserva de empresa. Reutilizado
// por el seed de clientes frecuentes y por los scripts de R1/R2/R8.

import http from "k6/http";
import { BASE_URL } from "./config.ts";

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

function findExistingProductId(token: string, productName: string): string | null {
  const res = http.get(`${BASE_URL}/reservations/preregistrations/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 200) {
    throw new Error(`Could not list company products: ${res.status} ${res.body}`);
  }

  const products = (res.json() as { data: Array<{ id: string; productName: string }> }).data;
  return products.find((p) => p.productName === productName)?.id ?? null;
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

// productName tiene que ser unico por cliente (POST devuelve 409 si ya
// existe), y como estos scripts usan emails fijos entre corridas, el
// producto de una corrida anterior sigue ahi: hay que reutilizarlo en vez de
// asumir que siempre se puede crear uno nuevo.
export function ensureCompanyProduct(token: string, label: string): string {
  const productName = `Seed Product ${label}`;
  const existingId = findExistingProductId(token, productName);
  if (existingId !== null) {
    return existingId;
  }

  const categoryId = firstCategoryId(token);
  return createCompanyProduct(token, categoryId, label);
}
