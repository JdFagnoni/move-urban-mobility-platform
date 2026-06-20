import type {
  CreateTripDTO,
  GeoPoint,
  PaginatedResult,
  ReservationAssignedEvent,
  TripDTO,
  TripStatus,
} from "@move/shared";
import { HttpError, query } from "@move/shared";

interface TripRow {
  id: string;
  reservation_id: string;
  vehicle_id: string;
  driver_id: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  route: GeoPoint[];
  created_at: Date;
  updated_at: Date;
}

function rowToDTO(row: TripRow): TripDTO {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    status: row.status as TripStatus,
    route: row.route,
    ...(row.started_at !== null ? { startedAt: row.started_at.toISOString() } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at.toISOString() } : {}),
  };
}

export async function createTrip(dto: CreateTripDTO): Promise<TripDTO> {
  const result = await query<TripRow>(
    `INSERT INTO trips (reservation_id, vehicle_id, driver_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [dto.reservationId, dto.vehicleId, dto.driverId]
  );
  return rowToDTO(result.rows[0]!);
}

export async function ensureTripForReservation(event: ReservationAssignedEvent): Promise<void> {
  await query(
    `INSERT INTO trips
       (reservation_id, vehicle_id, driver_id, origin, destination, driver_name, driver_email, category_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (reservation_id) DO NOTHING`,
    [
      event.reservationId,
      event.vehicleId,
      event.driverId,
      event.origin ? JSON.stringify(event.origin) : null,
      event.destination ? JSON.stringify(event.destination) : null,
      event.driverName ?? null,
      event.driverEmail ?? null,
      event.categoryIds ?? null,
    ]
  );
}

export async function listTrips(page: number, pageSize: number): Promise<PaginatedResult<TripDTO>> {
  return { data: [], total: 0, page, pageSize };
}

export async function getTrip(id: string): Promise<TripDTO | null> {
  const result = await query<TripRow>("SELECT * FROM trips WHERE id = $1", [id]);
  const row = result.rows[0];
  return row !== undefined ? rowToDTO(row) : null;
}

export async function startTrip(id: string, callerAuthSubject: string): Promise<TripDTO> {
  const tripResult = await query<TripRow>("SELECT * FROM trips WHERE id = $1", [id]);
  const trip = tripResult.rows[0];
  if (trip === undefined) {
    throw new HttpError(404, "Trip not found", "trip_not_found");
  }

  if (trip.status !== "assigned") {
    throw new HttpError(
      409,
      `Trip cannot be started from status '${trip.status}'`,
      "invalid_trip_status"
    );
  }

  const userResult = await query<{ id: string }>(
    "SELECT id FROM users WHERE auth_subject = $1 AND role = 'driver'",
    [callerAuthSubject]
  );
  const callerUser = userResult.rows[0];
  if (callerUser === undefined) {
    throw new HttpError(403, "Caller is not a registered driver", "caller_not_driver");
  }

  if (callerUser.id !== trip.driver_id) {
    throw new HttpError(403, "You are not the assigned driver for this trip", "driver_mismatch");
  }

  const vehicleConflict = await query<{ id: string }>(
    "SELECT id FROM trips WHERE vehicle_id = $1 AND status = 'in_progress' AND id != $2",
    [trip.vehicle_id, id]
  );
  if (vehicleConflict.rows.length > 0) {
    throw new HttpError(409, "Vehicle is already on an active trip", "vehicle_conflict");
  }

  const driverConflict = await query<{ id: string }>(
    "SELECT id FROM trips WHERE driver_id = $1 AND status = 'in_progress' AND id != $2",
    [trip.driver_id, id]
  );
  if (driverConflict.rows.length > 0) {
    throw new HttpError(409, "Driver is already on an active trip", "driver_conflict");
  }

  const updated = await query<TripRow>(
    `UPDATE trips
     SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rowToDTO(updated.rows[0]!);
}

export async function completeTrip(id: string, callerAuthSubject: string): Promise<TripDTO> {
  const tripResult = await query<TripRow>("SELECT * FROM trips WHERE id = $1", [id]);
  const trip = tripResult.rows[0];
  if (trip === undefined) {
    throw new HttpError(404, "Trip not found", "trip_not_found");
  }

  if (trip.status !== "in_progress") {
    throw new HttpError(
      409,
      `Trip cannot be completed from status '${trip.status}'`,
      "invalid_trip_status"
    );
  }

  const userResult = await query<{ id: string }>(
    "SELECT id FROM users WHERE auth_subject = $1 AND role = 'driver'",
    [callerAuthSubject]
  );
  const callerUser = userResult.rows[0];
  if (callerUser === undefined) {
    throw new HttpError(403, "Caller is not a registered driver", "caller_not_driver");
  }

  if (callerUser.id !== trip.driver_id) {
    throw new HttpError(403, "You are not the assigned driver for this trip", "driver_mismatch");
  }

  const updated = await query<TripRow>(
    `UPDATE trips
     SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rowToDTO(updated.rows[0]!);
}
