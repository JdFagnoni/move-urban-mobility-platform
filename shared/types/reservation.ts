import type { GeoPoint } from "./zone";

export type ReservationStatus =
  | "pending_classification"
  | "pending_quote"
  | "pending_confirmation"
  | "confirmed"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "pending_classification",
  "pending_quote",
  "pending_confirmation",
  "confirmed",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
];

export interface CargoItemDTO {
  id: string;
  reservationId: string;
  description: string;
  estimatedValue?: number | null;
  size?: string | null;
  categoryId?: string | null;
}

export interface CreateCargoItemDTO {
  description: string;
  estimatedValue?: number;
  size?: string;
  productName?: string;
  companyProductId?: string;
}

export interface ReservationDTO {
  id: string;
  clientId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  scheduledAt: string;
  status: ReservationStatus;
  cargoItems: CargoItemDTO[];
  quotedPrice?: number | null;
  vehicleId?: string | null;
  driverId?: string | null;
  paymentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationDTO {
  scheduledAt: string;
  origin?: GeoPoint;
  destination?: GeoPoint;
  originLocationId?: string;
  destinationLocationId?: string;
  cargoItems: CreateCargoItemDTO[];
}

export interface ListReservationsQueryDTO {
  scheduledFrom?: string;
  scheduledTo?: string;
  status?: ReservationStatus;
  page?: number;
  pageSize?: number;
}

export interface AssignReservationDTO {
  vehicleId: string;
  driverId: string;
}
