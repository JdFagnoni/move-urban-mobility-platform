import { query } from "@move/shared";
import type { AlertDTO, AlertType, AlertSeverity, GeoPoint, GpsSignalDTO } from "@move/shared";
import { signalPipeline } from "./pipeline/setup";

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

// ─── Trip lookup ─────────────────────────────────────────────────────────────

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

export async function hasActiveAlert(vehicleId: string, type: AlertType): Promise<boolean> {
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

// ─── Pipes & Filters pipeline (F15) ──────────────────────────────────────────

export async function detectAndAlert(signal: GpsSignalDTO): Promise<void> {
  await signalPipeline.execute(signal);
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
