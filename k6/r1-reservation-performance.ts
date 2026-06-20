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
} from "./helpers/config";
import { registerAndLogin } from "./helpers/auth";
import { ensureCompanyProduct } from "./helpers/companies";
import { companyReservationPayload, individualReservationPayload } from "./helpers/payloads";

interface SetupData {
  frequentToken: string;
  frequentProductId: string;
  nonfrequentToken: string;
  nonfrequentProductId: string;
  individualToken: string;
}

export const options = {
  scenarios: {
    empresa_frecuente: {
      executor: "constant-vus",
      vus: Number(__ENV["FREQUENT_VUS"] ?? 25),
      duration: __ENV["DURATION"] ?? "1m",
      exec: "empresaFrecuente",
    },
    empresa_no_frecuente: {
      executor: "constant-vus",
      vus: Number(__ENV["NONFREQUENT_VUS"] ?? 18),
      duration: __ENV["DURATION"] ?? "1m",
      exec: "empresaNoFrecuente",
    },
    particular: {
      executor: "constant-vus",
      vus: Number(__ENV["PARTICULAR_VUS"] ?? 8),
      duration: __ENV["DURATION"] ?? "1m",
      exec: "particular",
    },
  },
  thresholds: {
    "http_req_duration{scenario:empresa_frecuente}": ["p(95)<600"],
    "http_req_duration{scenario:empresa_no_frecuente}": ["p(95)<1000"],
    "http_req_duration{scenario:particular}": ["p(95)<10000"],
    http_req_failed: ["rate<0.01"],
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

  return { frequentToken, frequentProductId, nonfrequentToken, nonfrequentProductId, individualToken };
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
