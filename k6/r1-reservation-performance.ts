// R1 - Performance de creacion de reservas (F4.1 particular / F4.2 empresa).
//
// Tres scenarios independientes, cada uno con el SLA de la letra:
//   - empresa_frecuente:    p95 < 600ms  (top 20, fast-path Redis)
//   - empresa_no_frecuente: SLA real 700-1000ms; k6 solo puede validar un
//                            limite superior duro, por eso el threshold usa
//                            <1000ms (el piso de 700ms queda documentado acá
//                            y se revisa a ojo en el resumen de p95 real).
//   - particular:           p95 < 500ms. Mide el camino SINCRONICO: persistir
//                            la reserva en pending_classification y encolar el
//                            evento reservation.classification.requested a
//                            RabbitMQ. La clasificacion por IA (semantic search)
//                            ocurre de forma ASINCRONA en un consumer separado
//                            y no es medida por este test.
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
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
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

// Tiempo total desde el POST hasta que la reserva alcanza pending_confirmation.
const classificationE2eMs = new Trend("classification_e2e_ms", true);

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
      timeUnit: "10s",
      duration: DURATION,
      preAllocatedVUs: 5,
      maxVUs: 10,
      exec: "particular",
    },
  },
  thresholds: {
    "http_req_duration{scenario:empresa_frecuente}": ["p(95)<600"],
    "http_req_duration{scenario:empresa_no_frecuente}": ["p(95)<1000"],
    "http_req_duration{scenario:particular,type:create}": ["p(95)<500"],
    // Tiempo total (POST + clasificacion asincrona) hasta pending_confirmation.
    "classification_e2e_ms": ["p(95)<30000"],
    // Acotado por scenario y type: las llamadas de setup() y las de polling
    // no se cuentan contra el threshold de errores de creacion.
    "http_req_failed{scenario:empresa_frecuente}": ["rate<0.01"],
    "http_req_failed{scenario:empresa_no_frecuente}": ["rate<0.01"],
    "http_req_failed{scenario:particular,type:create}": ["rate<0.01"],
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

const CLASSIFICATION_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_S = 0.5;

function createReservation(token: string, payload: string): void {
  const res = http.post(`${BASE_URL}/reservations-service/reservations`, payload, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    tags: { type: "create" },
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
  const start = Date.now();

  const createRes = http.post(
    `${BASE_URL}/reservations-service/reservations`,
    individualReservationPayload(__ITER),
    {
      headers: {
        Authorization: `Bearer ${data.individualToken}`,
        "Content-Type": "application/json",
      },
      tags: { type: "create" },
    }
  );

  const created = check(createRes, { "reserva creada (201)": (r) => r.status === 201 });
  if (!created) return;

  const body = createRes.json() as { data: { id: string } };
  const reservationId = body.data.id;

  let classified = false;
  while (Date.now() - start < CLASSIFICATION_TIMEOUT_MS) {
    sleep(POLL_INTERVAL_S);

    const pollRes = http.get(
      `${BASE_URL}/reservations-service/reservations/${reservationId}`,
      {
        headers: { Authorization: `Bearer ${data.individualToken}` },
        tags: { type: "poll" },
      }
    );

    if (pollRes.status === 200) {
      const pollBody = pollRes.json() as { data: { status: string } };
      if (pollBody.data.status === "pending_confirmation") {
        classified = true;
        break;
      }
    }
  }

  classificationE2eMs.add(Date.now() - start);
  check(null, { "clasificado a tiempo": () => classified });
}
