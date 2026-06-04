import { query } from "@move/shared";
import type { GpsSignalDTO, GeoPoint } from "@move/shared";
import { detectAndAlert } from "../alerts/service";

interface GpsRow {
  vehicle_id: string;
  location: GeoPoint;
  speed: number;
  heading: number;
  timestamp: string;
}

export function validateSignalRange(signal: GpsSignalDTO): boolean {
  const [lon, lat] = signal.location.coordinates;
  return (
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    signal.speed >= 0 &&
    signal.speed <= 300
  );
}

async function vehicleExists(vehicleId: string): Promise<boolean> {
  const result = await query<{ id: string }>("SELECT id FROM vehicles WHERE id = $1", [vehicleId]);
  return (result.rowCount ?? 0) > 0;
}

export async function ingestSignal(signal: GpsSignalDTO): Promise<void> {
  if (!validateSignalRange(signal)) {
    throw new Error(`Invalid GPS signal values for vehicle ${signal.vehicleId}`);
  }

  const exists = await vehicleExists(signal.vehicleId);
  if (!exists) {
    throw new Error(`Unknown vehicle: ${signal.vehicleId}`);
  }

  await query(
    `INSERT INTO gps_signals (vehicle_id, location, speed, heading, timestamp)
     VALUES ($1, $2::jsonb, $3, $4, $5)`,
    [
      signal.vehicleId,
      JSON.stringify(signal.location),
      signal.speed,
      signal.heading,
      signal.timestamp,
    ]
  );

  // Non-blocking: detect geofence and stop situations after persisting
  detectAndAlert(signal).catch((err: unknown) => {
    console.error("[gps] alert detection error:", err);
  });
}

export async function getLatestSignal(vehicleId: string): Promise<GpsSignalDTO | null> {
  const result = await query<GpsRow>(
    `SELECT vehicle_id, location, speed, heading, timestamp
     FROM gps_signals
     WHERE vehicle_id = $1
     ORDER BY timestamp DESC
     LIMIT 1`,
    [vehicleId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    vehicleId: row.vehicle_id,
    location: row.location,
    speed: row.speed,
    heading: row.heading,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : new Date(row.timestamp).toISOString(),
  };
}

export async function getRecentSignals(vehicleId: string, limit = 5): Promise<GpsSignalDTO[]> {
  const result = await query<GpsRow>(
    `SELECT vehicle_id, location, speed, heading, timestamp
     FROM gps_signals
     WHERE vehicle_id = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [vehicleId, limit]
  );
  return result.rows.map((row) => ({
    vehicleId: row.vehicle_id,
    location: row.location,
    speed: row.speed,
    heading: row.heading,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : new Date(row.timestamp).toISOString(),
  }));
}
