import type { AlertDTO, AlertType, AlertSeverity, GeoPoint } from "@move/shared";

// F15 – generar alerta
export async function createAlert(params: {
  tripId: string;
  vehicleId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  location?: GeoPoint;
}): Promise<AlertDTO> {
  return {
    id: crypto.randomUUID(),
    ...params,
    createdAt: new Date().toISOString(),
  };
}

// F16 – listar alertas activas
export async function listActiveAlerts(tripId?: string): Promise<AlertDTO[]> {
  void tripId;
  return [];
}

// F16 – resolver alerta
export async function resolveAlert(id: string): Promise<AlertDTO | null> {
  void id;
  return null;
}
