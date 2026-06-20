import type { GeoPoint, TripStatus, VehicleDTO } from "@move/shared";
import { HttpError, query, redisClient } from "@move/shared";
import type { TripDTO } from "@move/shared";
import { VehicleModel } from "../../db/models";
import { resolveUserByAuthSubject } from "../../clients/reservation-service";

export interface ActiveTripFilters {
  vehicleId?: string;
  driverId?: string;
  categoryId?: string;
  hasActiveAlerts?: boolean;
}

export interface ActiveTripDTO {
  id: string;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  status: TripStatus;
  vehicle: {
    id: string;
    plate: string;
    type: string;
    capacity: number;
    status: string;
  };
  driver: {
    id: string;
    name: string;
    email: string;
  };
  hasActiveAlerts: boolean;
}

interface ActiveTripRow {
  id: string;
  status: string;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_type: string;
  vehicle_capacity: number;
  vehicle_status: string;
  driver_id: string;
  driver_name: string | null;
  driver_email: string | null;
  has_active_alerts: boolean;
}

function rowToActiveDTO(row: ActiveTripRow): ActiveTripDTO {
  return {
    id: row.id,
    origin: row.origin,
    destination: row.destination,
    status: row.status as TripStatus,
    vehicle: {
      id: row.vehicle_id,
      plate: row.vehicle_plate,
      type: row.vehicle_type,
      capacity: row.vehicle_capacity,
      status: row.vehicle_status,
    },
    driver: {
      id: row.driver_id,
      name: row.driver_name ?? "",
      email: row.driver_email ?? "",
    },
    hasActiveAlerts: row.has_active_alerts,
  };
}

const ACTIVE_TRIPS_TTL_SECONDS = 3;

function activeTripsCacheKey(filters: ActiveTripFilters): string {
  const hasAlertsPart =
    filters.hasActiveAlerts === undefined ? "-" : String(filters.hasActiveAlerts);
  return [
    "trips:active",
    filters.vehicleId ?? "-",
    filters.driverId ?? "-",
    filters.categoryId ?? "-",
    hasAlertsPart,
  ].join(":");
}

// F18 – panel del operador: traslados en curso (no finalizados)
export async function getActiveTrips(
  callerAuthSubject: string,
  filters: ActiveTripFilters
): Promise<ActiveTripDTO[]> {
  const caller = await resolveUserByAuthSubject(callerAuthSubject);
  if (!caller || caller.role !== "operator") {
    throw new HttpError(403, "Caller is not a registered operator", "caller_not_operator");
  }

  const cacheKey = activeTripsCacheKey(filters);
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached) as ActiveTripDTO[];
  } catch (err) {
    console.error("[operator] redis read error:", err);
  }

  // Todos los datos del traslado (origin/destination/conductor/categorias) estan
  // desnormalizados en la tabla trips, por lo que esta consulta solo toca tablas
  // propias de transportation-service (trips, vehicles, alerts).
  const conditions: string[] = ["t.status NOT IN ('completed', 'cancelled')"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.vehicleId !== undefined) {
    conditions.push(`t.vehicle_id = $${paramIdx++}`);
    params.push(filters.vehicleId);
  }

  if (filters.driverId !== undefined) {
    conditions.push(`t.driver_id = $${paramIdx++}`);
    params.push(filters.driverId);
  }

  if (filters.categoryId !== undefined) {
    conditions.push(`$${paramIdx++} = ANY(t.category_ids)`);
    params.push(filters.categoryId);
  }

  if (filters.hasActiveAlerts === true) {
    conditions.push(
      `EXISTS (SELECT 1 FROM alerts a WHERE a.trip_id = t.id AND a.resolved_at IS NULL)`
    );
  } else if (filters.hasActiveAlerts === false) {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM alerts a WHERE a.trip_id = t.id AND a.resolved_at IS NULL)`
    );
  }

  const whereClause = conditions.join(" AND ");

  const result = await query<ActiveTripRow>(
    `SELECT
       t.id,
       t.status,
       t.origin,
       t.destination,
       v.id          AS vehicle_id,
       v.plate       AS vehicle_plate,
       v.type        AS vehicle_type,
       v.capacity    AS vehicle_capacity,
       v.status      AS vehicle_status,
       t.driver_id   AS driver_id,
       t.driver_name AS driver_name,
       t.driver_email AS driver_email,
       EXISTS (
         SELECT 1 FROM alerts a
         WHERE a.trip_id = t.id AND a.resolved_at IS NULL
       ) AS has_active_alerts
     FROM trips t
     JOIN vehicles v ON v.id = t.vehicle_id
     WHERE ${whereClause}
     ORDER BY t.created_at DESC`,
    params
  );

  const data = result.rows.map(rowToActiveDTO);

  redisClient
    .set(cacheKey, JSON.stringify(data), "EX", ACTIVE_TRIPS_TTL_SECONDS)
    .catch((err: unknown) => {
      console.error("[operator] redis write error:", err);
    });

  return data;
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
  const vehicles = await VehicleModel.findAll({ where: { status: "available" } });
  return vehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    type: v.type,
    capacity: v.capacity,
    status: v.status,
    customFeatures: v.customFeatures,
  }));
}
