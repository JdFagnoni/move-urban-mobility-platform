import { recordExternalCall } from "@move/shared";
import type { CategoryBehaviorConfig, CategoryDTO } from "@move/shared";

function getBaseUrl(): string {
  const url = process.env["RESERVATIONS_URL"]?.trim().replace(/\/+$/u, "");
  if (!url) {
    throw new Error("RESERVATIONS_URL is not configured");
  }
  return url;
}

function getInternalGatewaySecret(): string {
  const secret = process.env["INTERNAL_GATEWAY_SECRET"]?.trim();
  if (!secret) {
    throw new Error("INTERNAL_GATEWAY_SECRET is not configured");
  }
  return secret;
}

async function callInternal<T>(path: string): Promise<T> {
  const start = Date.now();
  let response: Response;

  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      headers: { "x-internal-gateway-secret": getInternalGatewaySecret() },
    });
  } catch (error) {
    recordExternalCall("reservation-service", "error", Date.now() - start);
    throw new Error(
      `Failed to reach reservation-service: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  recordExternalCall("reservation-service", response.ok ? "success" : "error", Date.now() - start);

  if (!response.ok) {
    throw new Error(`reservation-service responded with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getActiveReservationCount(vehicleId: string): Promise<number> {
  const body = await callInternal<{ success: boolean; data: { count: number } }>(
    `/internal/vehicles/${encodeURIComponent(vehicleId)}/active-reservation-count`
  );
  return body.data.count;
}

export interface ResolvedUser {
  id: string;
  role: string;
  status: string;
}

export async function resolveUserByAuthSubject(authSubject: string): Promise<ResolvedUser | null> {
  const body = await callInternal<{ success: boolean; data: ResolvedUser | null }>(
    `/internal/users/by-auth-subject/${encodeURIComponent(authSubject)}`
  );
  return body.data;
}

// ─── Categorias (dato de referencia) ─────────────────────────────────────────
// El comportamiento de categorias (generatesAlerts) pertenece al dominio de
// reservation-service y se lee por HTTP desde `GET /categories` (mismo endpoint
// publico que consume el categorizer). La ruta de deteccion de alertas se
// ejecuta por cada señal GPS, por lo que el resultado se cachea en memoria con
// un TTL corto para no llamar a reservation-service en cada señal.

const CATEGORIES_TIMEOUT_MS = 5_000;
const CATEGORIES_CACHE_TTL_MS = 60_000;

let categoriesCache: { value: Map<string, CategoryBehaviorConfig>; expiresAt: number } | null =
  null;

export async function getCategoryBehaviors(): Promise<Map<string, CategoryBehaviorConfig>> {
  if (categoriesCache && categoriesCache.expiresAt > Date.now()) {
    return categoriesCache.value;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATEGORIES_TIMEOUT_MS);
  const start = Date.now();
  let response: Response;

  try {
    response = await fetch(`${getBaseUrl()}/categories`, { signal: controller.signal });
  } catch (error) {
    recordExternalCall("reservation-service", "error", Date.now() - start);
    throw new Error(
      `Failed to reach reservation-service: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timer);
  }

  recordExternalCall("reservation-service", response.ok ? "success" : "error", Date.now() - start);

  if (!response.ok) {
    throw new Error(`reservation-service responded with HTTP ${response.status}`);
  }

  const body = (await response.json()) as { success: boolean; data: CategoryDTO[] };
  const behaviors = new Map<string, CategoryBehaviorConfig>();
  for (const category of body.data) {
    behaviors.set(category.id, category.behavior);
  }

  categoriesCache = { value: behaviors, expiresAt: Date.now() + CATEGORIES_CACHE_TTL_MS };
  return behaviors;
}
