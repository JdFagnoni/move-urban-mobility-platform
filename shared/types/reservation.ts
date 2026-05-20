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

export interface GoodDTO {
  id: string;
  reservationId: string;
  description: string;
  estimatedValue?: number | null;
  size?: string | null;
  categoryId?: string | null;
}

export interface CreateGoodDTO {
  description: string;
  estimatedValue?: number;
  size?: string;
  productName?: string;
}

export interface ReservationDTO {
  id: string;
  clientId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  scheduledAt: string;
  status: ReservationStatus;
  goods: GoodDTO[];
  quotedPrice?: number | null;
  vehicleId?: string | null;
  driverId?: string | null;
  paymentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationDTO {
  scheduledAt: string;
  origin: GeoPoint;
  destination: GeoPoint;
  goods: CreateGoodDTO[];
}

export interface ListReservationsQueryDTO {
  scheduledFrom?: string;
  scheduledTo?: string;
  status?: ReservationStatus;
  page?: number;
  pageSize?: number;
}
