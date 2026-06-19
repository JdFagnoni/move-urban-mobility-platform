import {
  EXCHANGES,
  ROUTING_KEYS,
  describeError,
  logMessaging,
  publish,
  query,
  redisClient,
} from "@move/shared";
import { VehicleModel } from "../../db/models";
import type { GpsSignalDTO, GeoPoint } from "@move/shared";

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
  const vehicle = await VehicleModel.findByPk(vehicleId, { attributes: ["id"] });
  return vehicle !== null;
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

  // Awaited (but best-effort) so the consumer that picks up the message below
  // sees this signal already cached. Postgres already guarantees durability,
  // so a Redis failure here is non-fatal (R7).
  try {
    await cacheSignal(signal);
  } catch (err) {
    console.error("[gps] redis cache error:", err);
  }

  publishSignalForDetection(signal);
}

function publishSignalForDetection(signal: GpsSignalDTO): void {
  publish(EXCHANGES.gps, ROUTING_KEYS.gpsSignalIngested, signal).catch((error: unknown) => {
    logMessaging("error", "gps_signal_publish_failed", {
      vehicleId: signal.vehicleId,
      error: describeError(error),
    });
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

export async function getAllLatestSignals(): Promise<GpsSignalDTO[]> {
  try {
    const keys = await redisClient.keys("gps:latest:*");
    if (keys.length > 0) {
      const results = await Promise.all(
        keys.map(async (key) => {
          const vehicleId = key.replace("gps:latest:", "");
          return getLatestSignalFromCache(vehicleId);
        })
      );
      const signals = results.filter((s): s is GpsSignalDTO => s !== null);
      if (signals.length > 0) return signals;
    }
  } catch (err) {
    console.error("[gps] redis batch read error:", err);
  }

  const result = await query<GpsRow>(
    `SELECT DISTINCT ON (vehicle_id) vehicle_id, location, speed, heading, timestamp
     FROM gps_signals
     ORDER BY vehicle_id, timestamp DESC`
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
