// Helpers de transportation-service (vehiculos, zonas, trips) para el setup
// de R2 y R3.
//
// Van a traves del gateway (BASE_URL + prefijo /transportations), NO directo
// al servicio: transportation-service usa createAuthenticate() de
// @move/shared (shared/auth/middleware.ts), que no valida ningun JWT por su
// cuenta -- solo confia en los headers x-auth-subject / x-internal-gateway-secret
// que el gateway agrega al proxyear (forwardIdentityHeaders en
// api-gateway/src/routes/transportations.ts). Pegarle directo al servicio
// con un Bearer token en estas rutas devuelve 401 "Authentication required"
// sin importar cuan valido sea el token (confirmado con smoke test).
//
// El unico endpoint al que SI le pegamos directo es POST /gps/signal (ver
// r2-query-performance.ts y r3-alert-latency.ts), porque ese router no tiene
// ningun middleware de auth -- es publico tanto directo como a traves del
// gateway, pero ir directo evita el catch-all protegido del gateway.

import http from "k6/http";
import { BASE_URL } from "./config.ts";

export function createVehicle(adminToken: string, plate: string, capacity = 10): string {
  const res = http.post(
    `${BASE_URL}/transportations/vehicles`,
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
    `${BASE_URL}/transportations/zones`,
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
    `${BASE_URL}/transportations/trips`,
    JSON.stringify({ reservationId, vehicleId, driverId }),
    { headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" } }
  );

  if (res.status !== 201) {
    throw new Error(`Could not create trip for reservation ${reservationId}: ${res.status} ${res.body}`);
  }

  return (res.json() as { data: { id: string } }).data.id;
}

export function startTrip(driverToken: string, tripId: string): void {
  const res = http.patch(`${BASE_URL}/transportations/trips/${tripId}/start`, null, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });

  if (res.status !== 200) {
    throw new Error(`Could not start trip ${tripId}: ${res.status} ${res.body}`);
  }
}
