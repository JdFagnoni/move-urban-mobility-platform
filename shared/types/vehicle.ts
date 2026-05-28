export type VehicleStatus = "available" | "busy" | "maintenance" | "inactive";

export interface VehicleDTO {
  id: string;
  plate: string;
  type: string;
  capacity: number;
  status: VehicleStatus;
  gpsDeviceId?: string;
  customFeatures?: Record<string, unknown>;
}
