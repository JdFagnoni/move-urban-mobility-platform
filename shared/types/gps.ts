import type { GeoPoint } from "./zone";

export interface GpsSignalDTO {
  vehicleId: string;
  location: GeoPoint;
  speed: number;
  heading: number;
  timestamp: string;
}
