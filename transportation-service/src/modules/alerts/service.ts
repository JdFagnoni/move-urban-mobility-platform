import { query, redisClient } from "@move/shared";
import type {
  AlertDTO,
  AlertType,
  AlertSeverity,
  CategoryBehaviorConfig,
  GeoPoint,
  GpsSignalDTO,
} from "@move/shared";
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

interface ActiveTrip {
  id: string;
  categoryIds: string[] | null;
}

async function getActiveTrip(vehicleId: string): Promise<ActiveTrip | null> {
  try {
    const result = await query<{ id: string; category_ids: string[] | null }>(
      "SELECT id, category_ids FROM trips WHERE vehicle_id = $1 AND status = 'in_progress' LIMIT 1",
      [vehicleId]
    );
    const row = result.rows[0];
    return row ? { id: row.id, categoryIds: row.category_ids } : null;
  } catch {
    return null;
  }
}

// Una categoria sin reglas configuradas (o un vehiculo sin traslado activo)
// no debe bloquear la alerta: ante falta de informacion, se prefiere generar
// la alerta de mas que perderla silenciosamente (fail-open, R7).
async function resolveGeneratesAlerts(categoryIds: string[] | null): Promise<boolean> {
  if (!categoryIds || categoryIds.length === 0) {
    return true;
  }

  try {
    const result = await query<{ behavior: CategoryBehaviorConfig }>(
      "SELECT behavior FROM categories WHERE id = ANY($1::uuid[])",
      [categoryIds]
    );
    if (result.rows.length === 0) {
      return true;
    }
    return result.rows.some((row) => row.behavior?.generatesAlerts === true);
  } catch {
    return true;
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

const ALERT_LOCK_TTL_SECONDS = 24 * 60 * 60;

function alertLockKey(vehicleId: string, type: AlertType): string {
  return `alerts:active:${vehicleId}:${type}`;
}

export async function hasActiveAlert(vehicleId: string, type: AlertType): Promise<boolean> {
  const result = await query<{ id: string }>(
    `SELECT id FROM alerts
     WHERE vehicle_id = $1 AND type = $2 AND resolved_at IS NULL`,
    [vehicleId, type]
  );
  return (result.rowCount ?? 0) > 0;
}

// Atomically marks (vehicleId, type) as alerted. Returns true only when no alert
// was already active, which avoids the race between two instances both reading
// "no active alert" before either has inserted one.
export async function acquireAlertLock(vehicleId: string, type: AlertType): Promise<boolean> {
  try {
    const result = await redisClient.set(
      alertLockKey(vehicleId, type),
      "1",
      "EX",
      ALERT_LOCK_TTL_SECONDS,
      "NX"
    );
    return result === "OK";
  } catch (err) {
    console.error("[alerts] redis lock error:", err);
    const alreadyAlerted = await hasActiveAlert(vehicleId, type);
    return !alreadyAlerted;
  }
}

async function releaseAlertLock(vehicleId: string, type: AlertType): Promise<void> {
  try {
    await redisClient.del(alertLockKey(vehicleId, type));
  } catch (err) {
    console.error("[alerts] redis unlock error:", err);
  }
}

// Rebuilds Redis dedup locks from the currently unresolved alerts in Postgres.
// Called once on service startup so a Redis restart can't make the system forget
// alerts that are still active according to the source of truth.
export async function warmAlertCache(): Promise<void> {
  try {
    const result = await query<{ vehicle_id: string; type: AlertType }>(
      "SELECT vehicle_id, type FROM alerts WHERE resolved_at IS NULL"
    );
    await Promise.all(
      result.rows.map((row) =>
        redisClient.set(alertLockKey(row.vehicle_id, row.type), "1", "EX", ALERT_LOCK_TTL_SECONDS)
      )
    );
  } catch (err) {
    console.error("[alerts] redis warm-up error:", err);
  }
}

// ─── Core persistence ─────────────────────────────────────────────────────────

export async function createAlert(params: {
  vehicleId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  location?: GeoPoint;
}): Promise<AlertDTO | null> {
  const activeTrip = await getActiveTrip(params.vehicleId);
  const generatesAlerts = await resolveGeneratesAlerts(activeTrip?.categoryIds ?? null);
  if (!generatesAlerts) {
    return null;
  }

  const result = await query<AlertRow>(
    `INSERT INTO alerts (trip_id, vehicle_id, type, severity, message, location)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [
      activeTrip?.id ?? null,
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
  if (!row) return null;
  await releaseAlertLock(row.vehicle_id, row.type);
  return mapAlert(row);
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
