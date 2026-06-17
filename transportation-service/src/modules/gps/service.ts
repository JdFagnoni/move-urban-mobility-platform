import { query, redisClient } from "@move/shared";
import type { GpsSignalDTO, GeoPoint } from "@move/shared";
import { detectAndAlert } from "../alerts/service";

interface GpsRow {
  vehicle_id: string;
  location: GeoPoint;
  speed: number;
  heading: number;
  timestamp: string;
}

const GPS_LATEST_TTL_SECONDS = 6 * 60 * 60;
const GPS_RECENT_TTL_SECONDS = 60 * 60;
const GPS_RECENT_MAX_ENTRIES = 5;

function latestKey(vehicleId: string): string {
  return `gps:latest:${vehicleId}`;
}

function recentKey(vehicleId: string): string {
  return `gps:recent:${vehicleId}`;
}

async function cacheSignal(signal: GpsSignalDTO): Promise<void> {
  const [lon, lat] = signal.location.coordinates;
  await Promise.all([
    redisClient
      .multi()
      .hset(latestKey(signal.vehicleId), {
        lon: String(lon),
        lat: String(lat),
        speed: String(signal.speed),
        heading: String(signal.heading),
        timestamp: signal.timestamp,
      })
      .expire(latestKey(signal.vehicleId), GPS_LATEST_TTL_SECONDS)
      .exec(),
    redisClient
      .multi()
      .lpush(recentKey(signal.vehicleId), JSON.stringify(signal))
      .ltrim(recentKey(signal.vehicleId), 0, GPS_RECENT_MAX_ENTRIES - 1)
      .expire(recentKey(signal.vehicleId), GPS_RECENT_TTL_SECONDS)
      .exec(),
  ]);
}

async function getLatestSignalFromCache(vehicleId: string): Promise<GpsSignalDTO | null> {
  const data = await redisClient.hgetall(latestKey(vehicleId));
  if (!data["timestamp"]) return null;
  return {
    vehicleId,
    location: { type: "Point", coordinates: [Number(data["lon"]), Number(data["lat"])] },
    speed: Number(data["speed"]),
    heading: Number(data["heading"]),
    timestamp: data["timestamp"],
  };
}

export function validateSignalRange(signal: GpsSignalDTO): boolean {
  const [lon, lat] = signal.location.coordinates;
  return (
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && signal.speed >= 0 && signal.speed <= 300
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

  // Awaited (but best-effort) so detection below sees this signal already cached.
  // Postgres already guarantees durability, so a Redis failure here is non-fatal (R7).
  try {
    await cacheSignal(signal);
  } catch (err) {
    console.error("[gps] redis cache error:", err);
  }

  // Non-blocking: detect geofence and stop situations after persisting
  detectAndAlert(signal).catch((err: unknown) => {
    console.error("[gps] alert detection error:", err);
  });
}

export async function getLatestSignal(vehicleId: string): Promise<GpsSignalDTO | null> {
  try {
    const cached = await getLatestSignalFromCache(vehicleId);
    if (cached) return cached;
  } catch (err) {
    console.error("[gps] redis read error:", err);
  }

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
    timestamp:
      typeof row.timestamp === "string" ? row.timestamp : new Date(row.timestamp).toISOString(),
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
    timestamp:
      typeof row.timestamp === "string" ? row.timestamp : new Date(row.timestamp).toISOString(),
  }));
}
