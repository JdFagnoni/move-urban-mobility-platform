import type { GeoPoint, TripStatus, VehicleDTO } from "@move/shared";
import { HttpError, query } from "@move/shared";
import type { TripDTO } from "@move/shared";

export interface ActiveTripFilters {
  vehicleId?: string;
  driverId?: string;
  categoryId?: string;
  hasActiveAlerts?: boolean;
}

export interface ActiveTripDTO {
  id: string;
  origin: GeoPoint;
  destination: GeoPoint;
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
  origin: GeoPoint;
  destination: GeoPoint;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_type: string;
  vehicle_capacity: number;
  vehicle_status: string;
  driver_id: string;
  driver_name: string;
  driver_email: string;
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
      name: row.driver_name,
      email: row.driver_email,
    },
    hasActiveAlerts: row.has_active_alerts,
  };
}

// F18 – panel del operador: traslados en curso (no finalizados)
export async function getActiveTrips(
  callerAuthSubject: string,
  filters: ActiveTripFilters
): Promise<ActiveTripDTO[]> {
  const userResult = await query<{ id: string }>(
    "SELECT id FROM users WHERE auth_subject = $1 AND role = 'operator'",
    [callerAuthSubject]
  );
  if (userResult.rows[0] === undefined) {
    throw new HttpError(403, "Caller is not a registered operator", "caller_not_operator");
  }

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
    conditions.push(
      `EXISTS (SELECT 1 FROM goods g WHERE g.reservation_id = t.reservation_id AND g.category_id = $${paramIdx++})`
    );
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
       r.origin,
       r.destination,
       v.id       AS vehicle_id,
       v.plate    AS vehicle_plate,
       v.type     AS vehicle_type,
       v.capacity AS vehicle_capacity,
       v.status   AS vehicle_status,
       u.id       AS driver_id,
       u.name     AS driver_name,
       u.email    AS driver_email,
       EXISTS (
         SELECT 1 FROM alerts a
         WHERE a.trip_id = t.id AND a.resolved_at IS NULL
       ) AS has_active_alerts
     FROM trips t
     JOIN reservations r ON r.id = t.reservation_id
     JOIN vehicles     v ON v.id = t.vehicle_id
     JOIN users        u ON u.id = t.driver_id
     WHERE ${whereClause}
     ORDER BY t.created_at DESC`,
    params
  );

  return result.rows.map(rowToActiveDTO);
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
