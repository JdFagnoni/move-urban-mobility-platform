import type { GpsSignalDTO } from "@move/shared";

// F14 – recibir y validar señales GPS
export function validateSignal(signal: GpsSignalDTO): boolean {
  const { coordinates } = signal.location;
  const [lon, lat] = coordinates;
  return (
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && signal.speed >= 0 && signal.speed <= 300
  );
}

export async function ingestSignal(signal: GpsSignalDTO): Promise<void> {
  if (!validateSignal(signal)) {
    throw new Error(`Invalid GPS signal for vehicle ${signal.vehicleId}`);
  }
  // TODO: persist to time-series store and broadcast via WebSocket
}

export async function getLatestSignal(vehicleId: string): Promise<GpsSignalDTO | null> {
  void vehicleId;
  return null;
}
