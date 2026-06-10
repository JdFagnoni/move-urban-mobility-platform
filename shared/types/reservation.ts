import type { GeoPoint } from "./zone";

export type ReservationStatus =
  | "pending_classification"
  | "pending_quote"
  | "pending_confirmation"
  | "confirmed"
  | "assigned"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled";

export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "pending_classification",
  "pending_quote",
  "pending_confirmation",
  "confirmed",
  "assigned",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
];

export type NotificationType = "classification_required";

export const NOTIFICATION_TYPES: readonly NotificationType[] = ["classification_required"];

export type NotificationStatus = "pending" | "acknowledged";

export const NOTIFICATION_STATUSES: readonly NotificationStatus[] = ["pending", "acknowledged"];

export interface CargoItemDTO {
  id: string;
  reservationId: string;
  description: string;
  estimatedValue?: number | null;
  size?: string | null;
  categoryId?: string | null;
  category?: string | null;
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
  rejectedAt?: string | null;
  rejectedByUserId?: string | null;
  rejectionReason?: string | null;
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

export interface ManualReservationClassificationItemDTO {
  cargoItemId: string;
  categoryId: string;
}

export interface ManualReservationClassificationDTO {
  cargoItems: ManualReservationClassificationItemDTO[];
}

export interface RejectReservationDTO {
  reason: string;
}

export interface NotificationDTO {
  id: string;
  reservationId: string;
  type: NotificationType;
  status: NotificationStatus;
  acknowledgedAt?: string | null;
  acknowledgedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}
