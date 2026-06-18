import type { VehicleDTO, VehicleStatus } from "@move/shared";
import { HttpError, query } from "@move/shared";
import { UniqueConstraintError } from "sequelize";
import { VehicleModel } from "../../db/models";

export interface ListVehiclesFilters {
  status?: VehicleStatus;
  type?: string;
}

function mapVehicle(vehicle: VehicleModel): VehicleDTO {
  const dto: VehicleDTO = {
    id: vehicle.id,
    plate: vehicle.plate,
    type: vehicle.type,
    capacity: vehicle.capacity,
    status: vehicle.status,
    customFeatures: vehicle.customFeatures,
  };
  if (vehicle.gpsDeviceId !== null) {
    dto.gpsDeviceId = vehicle.gpsDeviceId;
  }
  return dto;
}

export async function listVehicles(filters: ListVehiclesFilters = {}): Promise<VehicleDTO[]> {
  const where: Record<string, unknown> = {};
  if (filters.status) {
    where["status"] = filters.status;
  }
  if (filters.type) {
    where["type"] = filters.type;
  }
  const vehicles = await VehicleModel.findAll({ where, order: [["plate", "ASC"]] });
  return vehicles.map(mapVehicle);
}

export async function getVehicle(id: string): Promise<VehicleDTO | null> {
  const vehicle = await VehicleModel.findByPk(id);
  return vehicle ? mapVehicle(vehicle) : null;
}

export async function getVehicleForHttp(id: string): Promise<VehicleDTO> {
  const vehicle = await getVehicle(id);
  if (!vehicle) {
    throw new HttpError(404, "Vehicle not found", "vehicle_not_found");
  }
  return vehicle;
}

export async function createVehicle(dto: Omit<VehicleDTO, "id">): Promise<VehicleDTO> {
  if (!dto.plate?.trim()) {
    throw new HttpError(400, "Plate is required", "invalid_vehicle");
  }
  if (!dto.type?.trim()) {
    throw new HttpError(400, "Type is required", "invalid_vehicle");
  }
  if (!dto.capacity || dto.capacity <= 0) {
    throw new HttpError(400, "Capacity must be a positive number", "invalid_vehicle");
  }

  try {
    const vehicle = await VehicleModel.create({
      id: crypto.randomUUID(),
      plate: dto.plate.trim().toUpperCase(),
      type: dto.type.trim().toUpperCase(),
      capacity: dto.capacity,
      status: dto.status ?? "available",
      gpsDeviceId: dto.gpsDeviceId ?? null,
      customFeatures: dto.customFeatures ?? {},
    });
    return mapVehicle(vehicle);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new HttpError(409, "A vehicle with this plate already exists", "plate_already_exists");
    }
    throw error;
  }
}

export async function updateVehicle(
  id: string,
  dto: Partial<Omit<VehicleDTO, "id">>
): Promise<VehicleDTO> {
  const vehicle = await VehicleModel.findByPk(id);
  if (!vehicle) {
    throw new HttpError(404, "Vehicle not found", "vehicle_not_found");
  }

  if (dto.plate !== undefined) {
    vehicle.plate = dto.plate.trim().toUpperCase();
  }
  if (dto.type !== undefined) {
    vehicle.type = dto.type.trim().toUpperCase();
  }
  if (dto.capacity !== undefined) {
    if (dto.capacity <= 0) {
      throw new HttpError(400, "Capacity must be a positive number", "invalid_vehicle");
    }
    vehicle.capacity = dto.capacity;
  }
  if (dto.status !== undefined) {
    vehicle.status = dto.status;
  }
  if (dto.gpsDeviceId !== undefined) {
    vehicle.gpsDeviceId = dto.gpsDeviceId ?? null;
  }
  if (dto.customFeatures !== undefined) {
    vehicle.customFeatures = dto.customFeatures;
  }

  try {
    await vehicle.save();
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new HttpError(409, "A vehicle with this plate already exists", "plate_already_exists");
    }
    throw error;
  }

  return mapVehicle(vehicle);
}

export async function deleteVehicle(id: string): Promise<void> {
  const vehicle = await VehicleModel.findByPk(id);
  if (!vehicle) {
    throw new HttpError(404, "Vehicle not found", "vehicle_not_found");
  }

  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM reservations
     WHERE vehicle_id = $1 AND status NOT IN ('completed', 'cancelled')`,
    [id]
  );

  const activeCount = parseInt(result.rows[0]?.count ?? "0", 10);
  if (activeCount > 0) {
    throw new HttpError(
      409,
      "Vehicle cannot be deleted because it has active reservations",
      "vehicle_in_use"
    );
  }

  await vehicle.destroy();
}
