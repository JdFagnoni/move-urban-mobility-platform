// k6 GPS burst — R8 (picos hasta 50x) + R3 (la cola absorbe el backlog de deteccion)
// La ingesta debe mantener latencia acotada bajo rafaga: el trabajo de deteccion
// se publica en gps.detection y se procesa de forma asincrona, sin frenar el endpoint.
//
// Por default pega al gateway (POST /gps/signal es publico tanto ahi como en
// transportation-service). Requiere un vehiculo existente. Crear uno (Postman
// F14 Setup) y pasar su id:
//   k6 run k6/gps-burst.ts --env VEHICLE_ID=<uuid>

import http from "k6/http";
import { check } from "k6";

const BASELINE_RATE = 25;
const PEAK_RATE = BASELINE_RATE * 50;

export const options = {
  scenarios: {
    gps_burst: {
      executor: "ramping-arrival-rate",
      startRate: BASELINE_RATE,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: "20s", target: BASELINE_RATE },
        { duration: "10s", target: PEAK_RATE },
        { duration: "30s", target: PEAK_RATE },
        { duration: "10s", target: BASELINE_RATE },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV["BASE_URL"] ?? "http://localhost:3000";
const VEHICLE_ID = __ENV["VEHICLE_ID"] ?? "";

export default function () {
  const payload = JSON.stringify({
    vehicleId: VEHICLE_ID,
    location: { type: "Point", coordinates: [-56.1712, -34.8941] },
    speed: 45.5,
    heading: 90.0,
    timestamp: new Date().toISOString(),
  });

  const res = http.post(`${BASE_URL}/transportations/gps/signal`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(res, {
    "status 202": (r) => r.status === 202,
  });
}
