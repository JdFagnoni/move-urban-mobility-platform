import type { GeoPoint } from "./zone";

export type TripStatus = "assigned" | "in_progress" | "completed" | "cancelled";

export interface TripDTO {
  id: string;
  reservationId: string;
  vehicleId: string;
  driverId: string;
  status: TripStatus;
  startedAt?: string;
  completedAt?: string;
  route: GeoPoint[];
}

export interface CreateTripDTO {
  reservationId: string;
  vehicleId: string;
  driverId: string;
}
