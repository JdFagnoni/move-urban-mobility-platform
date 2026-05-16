import type { GeoPoint } from "./zone";

export type VehicleStatus = "available" | "busy" | "maintenance" | "inactive";

export interface VehicleDTO {
  id: string;
  plate: string;
  model: string;
  capacity: number;
  status: VehicleStatus;
  currentLocation?: GeoPoint;
}
