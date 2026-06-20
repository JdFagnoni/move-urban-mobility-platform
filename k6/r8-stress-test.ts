// R8 - Escalabilidad hasta 50x la carga base.
//
// Valores baseline definidos por el equipo para esta letra (no son un
// requisito del sistema, son el punto de partida elegido para medir el
// escalamiento):
//   BASELINE_VUS = 10   VUs concurrentes en operacion normal
//   BASELINE_RPS = 4    requests/segundo en operacion normal
//
// El endpoint monitoreado es el mas critico segun R1: crear reserva de
// empresa frecuente (POST /reservations, fast-path Redis, SLA p95<600ms).
// El objetivo no es que el sistema aguante 50x sin degradarse -- es
// documentar en que escalon empieza a hacerlo (error rate > 1% o p95 > 600ms).
// Requiere haber corrido antes el seed de cliente frecuente (ver
// k6/seed/seed-frequent-client.ts) y reiniciado reservation-service, igual
// que r1-reservation-performance.ts.
//
// HALLAZGO (confirmado con smoke test) que motiva BASELINE_RPS=4: api-gateway
// aplica un rate limiter global de 300 req/min (=5 req/s) por IP sobre TODAS
// sus rutas (api-gateway/src/middleware/rate-limit.ts, valor fijo, sin
// variable de entorno). Eligiendo el baseline apenas por debajo de ese techo,
// el escalon 1x corre limpio y la degradacion aparece de forma clara en 5x
// (20 req/s, ya por encima del limite) en vez de ensuciar el propio baseline.
// Si se sube BASELINE_RPS por encima de 5, el "techo" que se va a medir es el
// del rate limiter del gateway, no la capacidad real de reservation-service.
//
// k6 no soporta thresholds por escalon, asi que cada request se etiqueta con
// el escalon nominal vigente (tags.stage) para poder filtrar el resultado
// (k6 run ... --out json=result.json) por escalon y ver en cual aparece la
// degradacion.

import http from "k6/http";
import { check } from "k6";
import { BASE_URL, FREQUENT_COMPANY_EMAIL, FREQUENT_COMPANY_PASSWORD } from "./helpers/config.ts";
import { registerAndLogin } from "./helpers/auth.ts";
import { ensureCompanyProduct } from "./helpers/companies.ts";
import { companyReservationPayload } from "./helpers/payloads.ts";

const BASELINE_VUS = 10; // referencia documental, ver comentario de cabecera
const BASELINE_RPS = Number(__ENV["BASELINE_RPS"] ?? 4);
const MULTIPLIERS = [1, 5, 10, 25, 50];
const RAMP_TIME_S = Number(__ENV["RAMP_TIME_S"] ?? 10);
const STAGE_HOLD_S = Number(__ENV["STAGE_HOLD_S"] ?? 30);

interface K6Stage {
  target: number;
  duration: string;
}

interface StageWindow {
  label: string;
  startMs: number;
  endMs: number;
}

function buildStagesAndWindows(): { stages: K6Stage[]; windows: StageWindow[] } {
  const stages: K6Stage[] = [];
  const windows: StageWindow[] = [];
  let cursorMs = 0;

  MULTIPLIERS.forEach((multiplier, index) => {
    const rps = BASELINE_RPS * multiplier;
    const label = `${multiplier}x`;

    if (index > 0) {
      stages.push({ target: rps, duration: `${RAMP_TIME_S}s` });
      windows.push({
        label: `${label}-ramp`,
        startMs: cursorMs,
        endMs: cursorMs + RAMP_TIME_S * 1000,
      });
      cursorMs += RAMP_TIME_S * 1000;
    }

    stages.push({ target: rps, duration: `${STAGE_HOLD_S}s` });
    windows.push({ label, startMs: cursorMs, endMs: cursorMs + STAGE_HOLD_S * 1000 });
    cursorMs += STAGE_HOLD_S * 1000;
  });

  // Bajada final de vuelta al baseline.
  stages.push({ target: BASELINE_RPS, duration: `${RAMP_TIME_S}s` });
  windows.push({ label: "bajada", startMs: cursorMs, endMs: cursorMs + RAMP_TIME_S * 1000 });

  return { stages, windows };
}

const { stages: STAGES, windows: STAGE_WINDOWS } = buildStagesAndWindows();

function stageLabelAt(elapsedMs: number): string {
  const window = STAGE_WINDOWS.find((w) => elapsedMs >= w.startMs && elapsedMs < w.endMs);
  return window?.label ?? "unknown";
}

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-arrival-rate",
      startRate: BASELINE_RPS,
      timeUnit: "1s",
      preAllocatedVUs: Number(__ENV["PRE_ALLOCATED_VUS"] ?? 100),
      maxVUs: Number(__ENV["MAX_VUS"] ?? 1000),
      stages: STAGES,
    },
  },
  thresholds: {
    // SLA de R1 para este mismo endpoint (empresa frecuente). Se espera que
    // falle en algun escalon alto: eso es justamente lo que R8 pide documentar.
    // Acotado por scenario para no contar el registro del cliente en setup().
    "http_req_duration{scenario:stress}": ["p(95)<600"],
    "http_req_failed{scenario:stress}": ["rate<0.01"],
  },
};

interface SetupData {
  token: string;
  productId: string;
  testStartMs: number;
}

export function setup(): SetupData {
  const token = registerAndLogin(
    FREQUENT_COMPANY_EMAIL,
    FREQUENT_COMPANY_PASSWORD,
    "Empresa Frecuente",
    "company",
    { companyName: "Empresa Frecuente SA", taxId: "RUT-FRECUENTE" }
  );
  const productId = ensureCompanyProduct(token, "frequent-r8");

  // Aproximacion: el primer request real arranca un instante despues de que
  // setup() termina, no justo en este timestamp. Para ventanas de 10-30s el
  // desvio es despreciable a los fines de etiquetar el escalon.
  return { token, productId, testStartMs: Date.now() };
}

export default function (data: SetupData): void {
  const stage = stageLabelAt(Date.now() - data.testStartMs);

  const res = http.post(
    `${BASE_URL}/reservations/reservations`,
    companyReservationPayload(data.productId, __ITER),
    {
      headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
      tags: { stage },
    }
  );

  check(res, { "reserva creada (201)": (r) => r.status === 201 });
}
