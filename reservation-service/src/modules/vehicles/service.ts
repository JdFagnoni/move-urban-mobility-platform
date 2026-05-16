import type { VehicleDTO, VehicleStatus } from "@move/shared";

// F10 – gestión de vehículos
export async function listVehicles(status?: VehicleStatus): Promise<VehicleDTO[]> {
  void status;
  return [];
}

export async function getVehicle(id: string): Promise<VehicleDTO | null> {
  void id;
  return null;
}

export async function createVehicle(dto: Omit<VehicleDTO, "id">): Promise<VehicleDTO> {
  return { id: crypto.randomUUID(), ...dto };
}

export async function updateVehicle(
  id: string,
  dto: Partial<Omit<VehicleDTO, "id">>
): Promise<VehicleDTO | null> {
  void id;
  void dto;
  return null;
}
