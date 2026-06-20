// Helpers de transportation-service (vehiculos, zonas, trips) para el setup
// de R2 y R3. Pegan directo al servicio (TRANSPORTATIONS_BASE_URL) en vez de
// pasar por el gateway: transportation-service valida el JWT por su cuenta
// (createAuthenticate/requireRole de @move/shared, igual que el gateway), asi
// que el token de Auth0 alcanza sin depender de INTERNAL_GATEWAY_SECRET.

import http from "k6/http";
import { TRANSPORTATIONS_BASE_URL } from "./config";

export function createVehicle(adminToken: string, plate: string, capacity = 10): string {
  const res = http.post(
    `${TRANSPORTATIONS_BASE_URL}/vehicles`,
    JSON.stringify({ plate, type: "VAN", capacity, status: "available" }),
    { headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" } }
  );

  if (res.status !== 201) {
    throw new Error(`Could not create vehicle ${plate}: ${res.status} ${res.body}`);
  }

  return (res.json() as { data: { id: string } }).data.id;
}

export function createRedZone(adminToken: string, name: string, coordinates: number[][][]): string {
  const res = http.post(
    `${TRANSPORTATIONS_BASE_URL}/zones`,
    JSON.stringify({ name, type: "red", polygon: { type: "Polygon", coordinates } }),
    { headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" } }
  );

  if (res.status !== 201) {
    throw new Error(`Could not create red zone ${name}: ${res.status} ${res.body}`);
  }

  return (res.json() as { data: { id: string } }).data.id;
}

export function createTrip(
  adminToken: string,
  reservationId: string,
  vehicleId: string,
  driverId: string
): string {
  const res = http.post(
    `${TRANSPORTATIONS_BASE_URL}/trips`,
    JSON.stringify({ reservationId, vehicleId, driverId }),
    { headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" } }
  );

  if (res.status !== 201) {
    throw new Error(`Could not create trip for reservation ${reservationId}: ${res.status} ${res.body}`);
  }

  return (res.json() as { data: { id: string } }).data.id;
}

export function startTrip(driverToken: string, tripId: string): void {
  const res = http.patch(`${TRANSPORTATIONS_BASE_URL}/trips/${tripId}/start`, null, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });

  if (res.status !== 200) {
    throw new Error(`Could not start trip ${tripId}: ${res.status} ${res.body}`);
  }
}
