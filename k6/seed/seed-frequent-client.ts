// Script de seed (una sola corrida) para construir el historial real que el
// ranking de clientes frecuentes (top 20) necesita para activarse.
//
// reservation-service no tiene un endpoint de seed/reset: el ranking se
// recalcula con una consulta SQL sobre reservas reales de los ultimos 7 dias
// y se sincroniza a Redis solo al levantar el servicio y luego cada 10
// minutos (ver fast-path-cache.ts). Este script crea esas reservas reales
// via el propio POST /reservations publico; para que el ranking las tome en
// cuenta de inmediato hay que reiniciar el contenedor "reservations" despues
// de correrlo (eso dispara el refresh inicial que corre al arrancar):
//
//   k6 run k6/seed/seed-frequent-client.ts
//   docker compose -f docker-compose.dev.yml restart reservations
//
// Recien despues de eso tiene sentido correr k6/r1-reservation-performance.ts
// y k6/r8-stress-test.ts con resultados representativos del fast-path Redis.

import http from "k6/http";
import { sleep } from "k6";
import {
  FREQUENT_COMPANY_EMAIL,
  FREQUENT_COMPANY_PASSWORD,
  NONFREQUENT_COMPANY_EMAIL,
  NONFREQUENT_COMPANY_PASSWORD,
  BASE_URL,
} from "../helpers/config";
import { registerAndLogin } from "../helpers/auth";
import { ensureCompanyProduct } from "../helpers/companies";
import { companyReservationPayload } from "../helpers/payloads";

// Umbral real: "top 20 por cantidad de reservas en los ultimos 7 dias". En
// una base de pruebas sin mucha otra actividad, 30 reservas alcanzan
// sobradamente para entrar al top 20; la empresa "no frecuente" recibe pocas
// a proposito para quedar afuera del ranking.
const FREQUENT_RESERVATIONS = Number(__ENV["FREQUENT_RESERVATIONS"] ?? 30);
const NONFREQUENT_RESERVATIONS = Number(__ENV["NONFREQUENT_RESERVATIONS"] ?? 3);

export const options = {
  scenarios: {
    seed: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "5m",
    },
  },
};

function seedCompany(
  email: string,
  password: string,
  label: string,
  reservationCount: number
): void {
  const token = registerAndLogin(email, password, `Seed ${label}`, "company", {
    companyName: `Seed ${label} SA`,
    taxId: `RUT-SEED-${label}`,
  });

  const companyProductId = ensureCompanyProduct(token, label);

  let created = 0;
  for (let i = 0; i < reservationCount; i++) {
    const res = http.post(
      `${BASE_URL}/reservations/reservations`,
      companyReservationPayload(companyProductId, i),
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    if (res.status === 201) {
      created++;
    }
    sleep(0.05);
  }

  console.log(`[seed] ${label}: ${created}/${reservationCount} reservas creadas (${email})`);
}

export default function (): void {
  seedCompany(FREQUENT_COMPANY_EMAIL, FREQUENT_COMPANY_PASSWORD, "frequent", FREQUENT_RESERVATIONS);
  seedCompany(
    NONFREQUENT_COMPANY_EMAIL,
    NONFREQUENT_COMPANY_PASSWORD,
    "nonfrequent",
    NONFREQUENT_RESERVATIONS
  );

  console.log(
    "[seed] Listo. Reiniciar el contenedor reservations para forzar el refresh del ranking: " +
      "docker compose -f docker-compose.dev.yml restart reservations"
  );
}
