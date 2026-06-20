import { recordExternalCall } from "@move/shared";

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
