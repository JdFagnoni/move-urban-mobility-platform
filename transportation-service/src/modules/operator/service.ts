import type { TripDTO, VehicleDTO } from "@move/shared";

// F18 – panel del operador: traslados activos
export async function getActiveTrips(): Promise<TripDTO[]> {
  return [];
}

// F19 – reasignar vehículo en traslado activo
export async function reassignVehicle(
  tripId: string,
  newVehicleId: string
): Promise<TripDTO | null> {
  void tripId;
  void newVehicleId;
  return null;
}

// F19 – vehículos disponibles para reasignación
export async function getAvailableVehicles(): Promise<VehicleDTO[]> {
  return [];
}
