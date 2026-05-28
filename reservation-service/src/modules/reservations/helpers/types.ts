import type { GeoPoint, ReservationStatus } from "@move/shared";

export interface NormalizedCargoItemInput {
  description: string;
  estimatedValue: number | null;
  size: string | null;
  companyProductId?: string;
}

export interface PreparedCargoItemInput {
  description: string;
  estimatedValue: number | null;
  size: string | null;
  categoryId: string | null;
}

export interface PreparedReservationCreation {
  origin: GeoPoint;
  destination: GeoPoint;
  status: ReservationStatus;
  cargoItems: PreparedCargoItemInput[];
}
