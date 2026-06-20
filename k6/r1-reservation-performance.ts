// R1 - Performance de clasificacion de reservas (F4.1 particular / F4.2 empresa).
//
// Tres scenarios independientes, cada uno con el SLA de la letra:
//   - empresa_frecuente:    p95 < 600ms  (top 20, fast-path Redis)
//   - empresa_no_frecuente: SLA real 700-1000ms; k6 solo puede validar un
//                            limite superior duro, por eso el threshold usa
//                            <1000ms (el piso de 700ms queda documentado acá
//                            y se revisa a ojo en el resumen de p95 real).
//   - particular:           SLA real 5000-10000ms (clasificacion via IA /
//                            semantic search); mismo motivo, threshold <10000ms.
//
// IMPORTANTE: para que "empresa_frecuente" ejercite el fast-path de Redis
// (y no caiga en el mismo camino que "empresa_no_frecuente") hay que correr
// antes el seed y reiniciar reservation-service:
//
//   k6 run k6/seed/seed-frequent-client.ts
//   docker compose -f docker-compose.dev.yml restart reservations
//   k6 run k6/r1-reservation-performance.ts
//
// Sin ese paso previo el script igual corre (registra los 3 clientes on the
// fly), pero "empresa_frecuente" no estara realmente en el top 20.
//
// HALLAZGO (confirmado con smoke test contra el stack real): api-gateway
// aplica un rate limiter global de 300 req/min por IP sobre TODAS sus rutas
// (api-gateway/src/middleware/rate-limit.ts, valor fijo, sin variable de
// entorno). Para no contaminar la medicion de latencia con 429s rapidos que
// se confundirian con exito, los tres scenarios usan constant-arrival-rate
// con una tasa baja y fija (no "20-50 VUs" sueltos), de forma que la suma de
// los tres se mantenga muy por debajo de 5 req/s.

import http from "k6/http";
import { check } from "k6";
import {
  FREQUENT_COMPANY_EMAIL,
  FREQUENT_COMPANY_PASSWORD,
  NONFREQUENT_COMPANY_EMAIL,
  NONFREQUENT_COMPANY_PASSWORD,
  INDIVIDUAL_CLIENT_EMAIL,
  INDIVIDUAL_CLIENT_PASSWORD,
  BASE_URL,
} from "./helpers/config.ts";
import { registerAndLogin } from "./helpers/auth.ts";
import { ensureCompanyProduct } from "./helpers/companies.ts";
import { companyReservationPayload, individualReservationPayload } from "./helpers/payloads.ts";

interface SetupData {
  frequentToken: string;
  frequentProductId: string;
  nonfrequentToken: string;
  nonfrequentProductId: string;
  individualToken: string;
}

const DURATION = __ENV["DURATION"] ?? "1m";

export const options = {
  scenarios: {
    empresa_frecuente: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV["FREQUENT_RATE"] ?? 2),
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 5,
      maxVUs: 15,
      exec: "empresaFrecuente",
    },
    empresa_no_frecuente: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV["NONFREQUENT_RATE"] ?? 1),
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 5,
      maxVUs: 15,
      exec: "empresaNoFrecuente",
    },
    particular: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV["PARTICULAR_RATE"] ?? 1),
      timeUnit: "4s",
      duration: DURATION,
      preAllocatedVUs: 5,
      maxVUs: 10,
      exec: "particular",
    },
  },
  thresholds: {
    "http_req_duration{scenario:empresa_frecuente}": ["p(95)<600"],
    "http_req_duration{scenario:empresa_no_frecuente}": ["p(95)<1000"],
    "http_req_duration{scenario:particular}": ["p(95)<10000"],
    // Acotado por scenario: las llamadas de setup() (registro de clientes,
    // que tolera 409 si el usuario ya existe de una corrida anterior) no
    // tienen tag de scenario y no deben contarse contra este threshold.
    "http_req_failed{scenario:empresa_frecuente}": ["rate<0.01"],
    "http_req_failed{scenario:empresa_no_frecuente}": ["rate<0.01"],
    "http_req_failed{scenario:particular}": ["rate<0.01"],
  },
};

export function setup(): SetupData {
  const frequentToken = registerAndLogin(
    FREQUENT_COMPANY_EMAIL,
    FREQUENT_COMPANY_PASSWORD,
    "Empresa Frecuente",
    "company",
    { companyName: "Empresa Frecuente SA", taxId: "RUT-FRECUENTE" }
  );
  const frequentProductId = ensureCompanyProduct(frequentToken, "frequent-r1");

  const nonfrequentToken = registerAndLogin(
    NONFREQUENT_COMPANY_EMAIL,
    NONFREQUENT_COMPANY_PASSWORD,
    "Empresa No Frecuente",
    "company",
    { companyName: "Empresa No Frecuente SA", taxId: "RUT-NOFRECUENTE" }
  );
  const nonfrequentProductId = ensureCompanyProduct(nonfrequentToken, "nonfrequent-r1");

  const individualToken = registerAndLogin(
    INDIVIDUAL_CLIENT_EMAIL,
    INDIVIDUAL_CLIENT_PASSWORD,
    "Cliente Particular",
    "individual"
  );

  return {
    frequentToken,
    frequentProductId,
    nonfrequentToken,
    nonfrequentProductId,
    individualToken,
  };
}

function createReservation(token: string, payload: string): void {
  const res = http.post(`${BASE_URL}/reservations/reservations`, payload, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  check(res, { "reserva creada (201)": (r) => r.status === 201 });
}

export function empresaFrecuente(data: SetupData): void {
  createReservation(data.frequentToken, companyReservationPayload(data.frequentProductId, __ITER));
}

export function empresaNoFrecuente(data: SetupData): void {
  createReservation(
    data.nonfrequentToken,
    companyReservationPayload(data.nonfrequentProductId, __ITER)
  );
}

export function particular(data: SetupData): void {
  createReservation(data.individualToken, individualReservationPayload(__ITER));
}
