import { recordExternalCall } from "@move/shared";
import type { VehicleStatus } from "@move/shared";

const TRANSPORTATION_TIMEOUT_MS = 5_000;

export interface VehicleSummary {
  id: string;
  status: VehicleStatus;
  capacity: number;
}

function getBaseUrl(): string {
  const url = process.env["TRANSPORTATIONS_URL"]?.trim().replace(/\/+$/u, "");
  if (!url) {
    throw new Error("TRANSPORTATIONS_URL is not configured");
  }
  return url;
}

// Lee el vehiculo desde transportation-service (dueño del dominio de vehiculos)
// en lugar de consultar la tabla `vehicles` directamente. Un 404 del servicio
// se traduce a `null` para preservar el manejo de "vehiculo no encontrado" del
// caller; cualquier otro fallo se propaga.
export async function getVehicleById(id: string): Promise<VehicleSummary | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSPORTATION_TIMEOUT_MS);
  const start = Date.now();
  let response: Response;

  try {
    response = await fetch(`${getBaseUrl()}/vehicles/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    });
  } catch (error) {
    recordExternalCall("transportation-service", "error", Date.now() - start);
    throw new Error(
      `Failed to reach transportation-service: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    recordExternalCall("transportation-service", "success", Date.now() - start);
    return null;
  }

  recordExternalCall(
    "transportation-service",
    response.ok ? "success" : "error",
    Date.now() - start
  );

  if (!response.ok) {
    throw new Error(`transportation-service responded with HTTP ${response.status}`);
  }

  const body = (await response.json()) as { success: boolean; data?: VehicleSummary };
  return body.data ?? null;
}
