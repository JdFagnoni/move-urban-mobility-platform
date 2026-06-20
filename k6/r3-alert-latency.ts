// R3 - Las alertas deben procesarse en menos de 5 segundos desde su deteccion.
//
// Usa el filtro "geofence" (transportation-service/src/modules/alerts):
// entrar a una zona type="red" genera una alerta geofence_exit de forma
// asincrona (GPS -> RabbitMQ gps.detection -> Pipes & Filters -> alerts).
// Es el disparador mas determinista de los cuatro filtros: una sola señal
// dentro del poligono alcanza (a diferencia de prolonged-stop/breakdown, que
// necesitan minutos de detencion sostenida).
//
// Por cada muestra: crea un vehiculo nuevo (el lock de deduplicacion de
// alertas por vehiculo dura 24h, asi que reusar un vehiculo entre muestras
// ocultaria la deteccion real detras del lock), manda una señal afuera de la
// zona roja y despues una adentro (t0), y hace polling sobre
// GET /transportations/alerts?vehicleId=...&resolved=false (publico, sin
// auth) hasta ver la alerta geofence_exit. El delta se registra en el Trend
// "alert_detection_latency" con threshold p95 < 5000ms.

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { BASE_URL, TRANSPORTATIONS_BASE_URL } from "./helpers/config";
import { getAdminToken } from "./helpers/auth";
import { createVehicle, createRedZone } from "./helpers/fleet";
import { gpsSignalPayload, type Point } from "./helpers/payloads";

interface SetupData {
  vehicleIds: string[];
}

interface AlertDTO {
  id: string;
  vehicleId: string;
  type: string;
}

const SAMPLES = Number(__ENV["R3_SAMPLES"] ?? 10);
const POLL_INTERVAL_S = 0.2;
const POLL_TIMEOUT_MS = 6000;

const POINT_OUTSIDE_RED_ZONE: Point = [-56.16, -34.89];
const POINT_INSIDE_RED_ZONE: Point = [-56.17, -34.905];
const RED_ZONE_COORDINATES: number[][][] = [
  [
    [-56.172, -34.904],
    [-56.168, -34.904],
    [-56.168, -34.906],
    [-56.172, -34.906],
    [-56.172, -34.904],
  ],
];

export const alertDetectionLatency = new Trend("alert_detection_latency", true);

export const options = {
  setupTimeout: "1m",
  scenarios: {
    alert_latency: {
      executor: "per-vu-iterations",
      vus: SAMPLES,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    alert_detection_latency: ["p(95)<5000"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup(): SetupData {
  const adminToken = getAdminToken();
  const runSuffix = `${Date.now()}`;

  createRedZone(adminToken, `R3 Zona Roja ${runSuffix}`, RED_ZONE_COORDINATES);

  const vehicleIds: string[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    vehicleIds.push(createVehicle(adminToken, `R3-VEHICLE-${i}-${runSuffix}`));
  }

  console.log(`[r3 setup] zona roja creada, ${vehicleIds.length} vehiculos listos para medir`);
  return { vehicleIds };
}

function sendSignal(vehicleId: string, point: Point): void {
  http.post(`${TRANSPORTATIONS_BASE_URL}/gps/signal`, gpsSignalPayload(vehicleId, point, 30, 0), {
    headers: { "Content-Type": "application/json" },
  });
}

function hasGeofenceAlert(vehicleId: string): boolean {
  const res = http.get(`${BASE_URL}/transportations/alerts?vehicleId=${vehicleId}&resolved=false`);

  if (res.status !== 200) {
    return false;
  }

  const alerts = (res.json() as { data: AlertDTO[] }).data;
  return alerts.some((alert) => alert.type === "geofence_exit");
}

export default function (data: SetupData): void {
  const vehicleId = data.vehicleIds[__VU - 1];

  // Simula al vehiculo acercandose desde afuera antes de cruzar hacia
  // adentro de la zona roja; la señal que dispara la alerta es la segunda.
  sendSignal(vehicleId, POINT_OUTSIDE_RED_ZONE);
  sleep(0.3);

  const t0 = Date.now();
  sendSignal(vehicleId, POINT_INSIDE_RED_ZONE);

  let detected = false;
  while (Date.now() - t0 < POLL_TIMEOUT_MS) {
    if (hasGeofenceAlert(vehicleId)) {
      detected = true;
      break;
    }
    sleep(POLL_INTERVAL_S);
  }

  alertDetectionLatency.add(Date.now() - t0);

  check(detected, { "alerta geofence_exit detectada antes del timeout": () => detected });
}
