// R2 - Consultas y listados bajo carga maxima combinada.
//
// La letra define la carga maxima como 100 reservas/minuto + 50 conductores
// transmitiendo GPS simultaneamente. Bajo esa carga combinada se miden:
//   - F7  consultar reservas              -> p95 < 300ms ("reportes")
//   - F18 consultar traslados en curso    -> p95 < 500ms ("listados")
//
// Cuatro scenarios corren en paralelo (k6 los arranca todos al mismo tiempo
// salvo que se indique startTime):
//   - reservas:            ~100/min sobre POST /reservations (empresa frecuente)
//   - gps:                 50 VUs, cada uno manda una señal GPS cada ~10s
//   - consultas_reservas:  mide F7 (gateway)
//   - consultas_traslados: mide F18 (gateway)
//
// Solo se crean ~15 traslados "en curso" reales (ACTIVE_TRIPS_COUNT) en vez
// de 50: cada traslado activo necesita su propio conductor registrado,
// promovido y logueado contra Auth0, y la latencia de F18 depende de la
// presion de escritura concurrente (las otras 3 scenarios), no del numero
// exacto de filas de traslados. Los vehiculos restantes (hasta
// GPS_VEHICLE_COUNT=50) solo emiten GPS, sin traslado asociado -- mandar GPS
// no requiere conductor ni token (ver helpers/fleet.ts).

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, FREQUENT_COMPANY_EMAIL, FREQUENT_COMPANY_PASSWORD, TRANSPORTATIONS_BASE_URL } from "./helpers/config";
import { getAdminToken, registerAndLogin, ensurePromotedUser } from "./helpers/auth";
import { ensureCompanyProduct } from "./helpers/companies";
import { createVehicle, createTrip, startTrip } from "./helpers/fleet";
import { companyReservationPayload, gpsSignalPayload, montevideoPoint } from "./helpers/payloads";

interface SetupData {
  operatorToken: string;
  frequentToken: string;
  frequentProductId: string;
  vehicleIds: string[];
}

const ACTIVE_TRIPS_COUNT = Number(__ENV["ACTIVE_TRIPS_COUNT"] ?? 15);
const GPS_VEHICLE_COUNT = Number(__ENV["GPS_VEHICLE_COUNT"] ?? 50);
const DURATION = __ENV["DURATION"] ?? "2m";

export const options = {
  setupTimeout: "3m",
  scenarios: {
    reservas: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV["RESERVAS_PER_MIN"] ?? 100),
      timeUnit: "1m",
      duration: DURATION,
      preAllocatedVUs: 10,
      maxVUs: 30,
      exec: "crearReserva",
    },
    gps: {
      executor: "constant-vus",
      vus: GPS_VEHICLE_COUNT,
      duration: DURATION,
      exec: "enviarGps",
    },
    consultas_reservas: {
      executor: "constant-vus",
      vus: 10,
      duration: DURATION,
      exec: "consultarReservas",
    },
    consultas_traslados: {
      executor: "constant-vus",
      vus: 10,
      duration: DURATION,
      exec: "consultarTraslados",
    },
  },
  thresholds: {
    "http_req_duration{scenario:consultas_reservas}": ["p(95)<300"],
    "http_req_duration{scenario:consultas_traslados}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup(): SetupData {
  const runSuffix = `${Date.now()}`;
  const adminToken = getAdminToken();

  const frequentToken = registerAndLogin(
    FREQUENT_COMPANY_EMAIL,
    FREQUENT_COMPANY_PASSWORD,
    "Empresa Frecuente",
    "company",
    { companyName: "Empresa Frecuente SA", taxId: "RUT-FRECUENTE" }
  );
  const frequentProductId = ensureCompanyProduct(frequentToken, "frequent-r2");

  const operator = ensurePromotedUser(
    adminToken,
    "operator-r2@move.local",
    "Operator123!",
    "Operator R2",
    "operator"
  );

  const vehicleIds: string[] = [];

  for (let i = 0; i < ACTIVE_TRIPS_COUNT; i++) {
    const vehicleId = createVehicle(adminToken, `R2-TRIP-${i}-${runSuffix}`);
    const driver = ensurePromotedUser(
      adminToken,
      `driver-r2-${i}-${runSuffix}@move.local`,
      "Driver123!",
      `Driver R2 ${i}`,
      "driver"
    );

    const reservationRes = http.post(
      `${BASE_URL}/reservations/reservations`,
      companyReservationPayload(frequentProductId, i),
      { headers: { Authorization: `Bearer ${frequentToken}`, "Content-Type": "application/json" } }
    );
    if (reservationRes.status !== 201) {
      throw new Error(
        `Setup: could not create reservation ${i}: ${reservationRes.status} ${reservationRes.body}`
      );
    }
    const reservationId = (reservationRes.json() as { data: { id: string } }).data.id;

    const tripId = createTrip(adminToken, reservationId, vehicleId, driver.id);
    startTrip(driver.token, tripId);

    vehicleIds.push(vehicleId);
  }

  for (let i = ACTIVE_TRIPS_COUNT; i < GPS_VEHICLE_COUNT; i++) {
    vehicleIds.push(createVehicle(adminToken, `R2-GPS-${i}-${runSuffix}`));
  }

  console.log(
    `[r2 setup] ${ACTIVE_TRIPS_COUNT} traslados activos creados, ${vehicleIds.length} vehiculos en total`
  );

  return { operatorToken: operator.token, frequentToken, frequentProductId, vehicleIds };
}

export function crearReserva(data: SetupData): void {
  const res = http.post(
    `${BASE_URL}/reservations/reservations`,
    companyReservationPayload(data.frequentProductId, __ITER),
    { headers: { Authorization: `Bearer ${data.frequentToken}`, "Content-Type": "application/json" } }
  );

  check(res, { "reserva creada (201)": (r) => r.status === 201 });
}

export function enviarGps(data: SetupData): void {
  const vehicleId = data.vehicleIds[(__VU - 1) % data.vehicleIds.length];
  const res = http.post(
    `${TRANSPORTATIONS_BASE_URL}/gps/signal`,
    gpsSignalPayload(vehicleId, montevideoPoint(__VU + __ITER)),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, { "señal GPS aceptada (202)": (r) => r.status === 202 });
  sleep(10);
}

export function consultarReservas(data: SetupData): void {
  const res = http.get(`${BASE_URL}/reservations/reservations?pageSize=20`, {
    headers: { Authorization: `Bearer ${data.frequentToken}` },
  });

  check(res, { "F7 consultar reservas 200": (r) => r.status === 200 });
  sleep(1);
}

export function consultarTraslados(data: SetupData): void {
  const res = http.get(`${BASE_URL}/transportations/operator/trips/active`, {
    headers: { Authorization: `Bearer ${data.operatorToken}` },
  });

  check(res, { "F18 consultar traslados en curso 200": (r) => r.status === 200 });
  sleep(1);
}
