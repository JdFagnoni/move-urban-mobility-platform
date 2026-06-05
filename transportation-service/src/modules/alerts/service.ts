import { query } from "@move/shared";
import type { AlertDTO, AlertType, AlertSeverity, GeoPoint, GpsSignalDTO } from "@move/shared";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AlertRow {
  id: string;
  trip_id: string | null;
  vehicle_id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  location: GeoPoint | null;
  created_at: string;
  resolved_at: string | null;
}

interface ZoneRow {
  id: string;
  name: string;
  type: string;
  polygon: { type: "Polygon"; coordinates: number[][][] };
}

// ─── Geometry ────────────────────────────────────────────────────────────────

// Ray-casting point-in-polygon (exterior ring only)
function pointInPolygon(point: [number, number], ring: number[][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Trip lookup (stub — connects once trips table exists) ───────────────────

async function getActiveTripId(vehicleId: string): Promise<string | null> {
  try {
    const result = await query<{ id: string }>(
      "SELECT id FROM trips WHERE vehicle_id = $1 AND status = 'in_progress' LIMIT 1",
      [vehicleId]
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

async function hasActiveAlert(vehicleId: string, type: AlertType): Promise<boolean> {
  const result = await query<{ id: string }>(
    `SELECT id FROM alerts
     WHERE vehicle_id = $1 AND type = $2 AND resolved_at IS NULL`,
    [vehicleId, type]
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Core persistence ─────────────────────────────────────────────────────────

export async function createAlert(params: {
  vehicleId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  location?: GeoPoint;
}): Promise<AlertDTO> {
  const tripId = await getActiveTripId(params.vehicleId);

  const result = await query<AlertRow>(
    `INSERT INTO alerts (trip_id, vehicle_id, type, severity, message, location)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [
      tripId,
      params.vehicleId,
      params.type,
      params.severity,
      params.message,
      params.location ? JSON.stringify(params.location) : null,
    ]
  );

  const row = result.rows[0]!;
  return mapAlert(row);
}

// ─── Detection logic (F15) ────────────────────────────────────────────────────

async function checkGeofence(signal: GpsSignalDTO): Promise<void> {
  const zones = await query<ZoneRow>(
    "SELECT id, name, type, polygon FROM zones WHERE type = 'red' AND active = true"
  );

  for (const zone of zones.rows) {
    const ring = zone.polygon.coordinates[0];
    if (!ring) continue;
    const inside = pointInPolygon(signal.location.coordinates, ring);
    if (inside) {
      const alreadyAlerted = await hasActiveAlert(signal.vehicleId, "geofence_exit");
      if (!alreadyAlerted) {
        await createAlert({
          vehicleId: signal.vehicleId,
          type: "geofence_exit",
          severity: "critical",
          message: `Vehicle entered red zone "${zone.name}"`,
          location: signal.location,
        });
        console.warn(
          `[alerts] geofence alert for vehicle ${signal.vehicleId} in zone "${zone.name}"`
        );
      }
      return;
    }
  }
}

const STOP_THRESHOLD_MS = 60_000; // 60 seconds stopped = alert

async function checkProlongedStop(signal: GpsSignalDTO): Promise<void> {
  if (signal.speed > 0) return;

  const result = await query<{ speed: number; timestamp: string }>(
    `SELECT speed, timestamp FROM gps_signals
     WHERE vehicle_id = $1
     ORDER BY timestamp DESC
     LIMIT 2`,
    [signal.vehicleId]
  );

  if (result.rows.length < 2) return;

  const [latest, previous] = result.rows;
  if (!latest || !previous || latest.speed > 0 || previous.speed > 0) return;

  const elapsed = new Date(signal.timestamp).getTime() - new Date(previous.timestamp).getTime();
  if (elapsed >= STOP_THRESHOLD_MS) {
    const alreadyAlerted = await hasActiveAlert(signal.vehicleId, "delay");
    if (!alreadyAlerted) {
      await createAlert({
        vehicleId: signal.vehicleId,
        type: "delay",
        severity: "warning",
        message: `Vehicle has been stopped for over ${Math.round(elapsed / 1000)}s`,
        location: signal.location,
      });
      console.warn(`[alerts] stop alert for vehicle ${signal.vehicleId}`);
    }
  }
}

export async function detectAndAlert(signal: GpsSignalDTO): Promise<void> {
  await Promise.all([checkGeofence(signal), checkProlongedStop(signal)]);
}

// ─── Queries (F16) ────────────────────────────────────────────────────────────

export interface ListAlertsFilters {
  tripId?: string;
  vehicleId?: string;
  resolved?: boolean;
}

export async function listAlerts(filters: ListAlertsFilters = {}): Promise<AlertDTO[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.tripId !== undefined) {
    conditions.push(`trip_id = $${idx++}`);
    params.push(filters.tripId);
  }
  if (filters.vehicleId !== undefined) {
    conditions.push(`vehicle_id = $${idx++}`);
    params.push(filters.vehicleId);
  }
  if (filters.resolved === false) {
    conditions.push("resolved_at IS NULL");
  } else if (filters.resolved === true) {
    conditions.push("resolved_at IS NOT NULL");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query<AlertRow>(
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC`,
    params
  );
  return result.rows.map(mapAlert);
}

export async function resolveAlert(id: string): Promise<AlertDTO | null> {
  const result = await query<AlertRow>(
    `UPDATE alerts SET resolved_at = NOW() WHERE id = $1 AND resolved_at IS NULL RETURNING *`,
    [id]
  );
  const row = result.rows[0];
  return row ? mapAlert(row) : null;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapAlert(row: AlertRow): AlertDTO {
  const dto: AlertDTO = {
    id: row.id,
    tripId: row.trip_id ?? "",
    vehicleId: row.vehicle_id,
    type: row.type,
    severity: row.severity,
    message: row.message,
    createdAt:
      typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
  };
  if (row.location) dto.location = row.location;
  if (row.resolved_at) {
    dto.resolvedAt =
      typeof row.resolved_at === "string"
        ? row.resolved_at
        : new Date(row.resolved_at).toISOString();
  }
  return dto;
}
