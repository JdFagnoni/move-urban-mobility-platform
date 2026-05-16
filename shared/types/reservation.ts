import type { GeoPoint } from "./zone";

export type ReservationStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

export interface ReservationDTO {
  id: string;
  clientId: string;
  vehicleId?: string;
  categoryId: string;
  originZoneId: string;
  destinationZoneId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  scheduledAt: string;
  status: ReservationStatus;
  createdAt: string;
}

export interface CreateReservationDTO {
  clientId: string;
  categoryId: string;
  originZoneId: string;
  destinationZoneId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  scheduledAt: string;
}
