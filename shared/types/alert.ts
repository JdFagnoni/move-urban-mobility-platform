import type { GeoPoint } from "./zone";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType = "geofence_exit" | "speeding" | "breakdown" | "delay";

export interface AlertDTO {
  id: string;
  tripId: string;
  vehicleId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  location?: GeoPoint;
  createdAt: string;
  resolvedAt?: string;
}
