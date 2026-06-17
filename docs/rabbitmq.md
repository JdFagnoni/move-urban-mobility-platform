# Mensajería con RabbitMQ

Resumen operativo de la integración de RabbitMQ en MOVE. El detalle de diseño y las
decisiones están en `ADRs/ADR-010` (adopción del broker), `ADRs/ADR-011` (transactional
outbox) y `ADRs/ADR-006` (enmienda de la detección de alertas).

## Topología

- Exchanges (`topic`, durables): `move.reservations`, `move.gps`, `move.dlx`.
- Colas de trabajo, cada una con su cola de reintento (`.retry`, con TTL) y su DLQ parqueada (`.dlq`):
  - `gps.detection` ← `move.gps` / `gps.signal.ingested`
  - `trip.creation` ← `move.reservations` / `reservation.assigned`
  - `notifications.email` ← `move.reservations` / `reservation.unsupported`

La topología se declara de forma idempotente al iniciar cada servicio
(`@move/shared/messaging`). Ningún módulo de dominio importa `amqplib`: todo pasa por
`@move/shared`.

## Patrones

- **Entrega at-least-once** con publisher confirms y consumidores idempotentes
  (trip por `reservation_id` único; email deduplicado por `(reservationId, type)`;
  detección GPS por `hasActiveAlert`).
- **Reintento con dead-letter + TTL**: ante fallo, el mensaje va a `X.retry`; tras el TTL
  vuelve a `X`. Superado `RABBITMQ_MAX_RETRIES`, se parquea en `X.dlq`.
- **Transactional outbox** para los eventos originados en transacciones de BD
  (`reservation.assigned`, `reservation.unsupported`): se insertan en `outbox_events`
  dentro de la transacción y un relay los publica.
- **Resiliencia de conexión**: reconexión con backoff exponencial; si el broker está
  caído, el outbox retiene los eventos y la ingesta GPS loguea y continúa.

## Variables de entorno

Ver `.env.example` (`RABBITMQ_URL`, `RABBITMQ_PREFETCH`, `RABBITMQ_MAX_RETRIES`,
`RABBITMQ_RETRY_TTL_MS`, credenciales y puertos).

## Tests

Desde `shared/`:

```bash
npm test                 # unitarios: conteo de reintentos por x-death, nombres de colas
npm run test:integration # integración end-to-end contra un broker real
```

El test de integración requiere un broker accesible y permite tunear el ciclo de retry:

```bash
RABBITMQ_URL=amqp://guest:guest@localhost:5672 \
RABBITMQ_MAX_RETRIES=2 RABBITMQ_RETRY_TTL_MS=800 \
  npm run test:integration
```

Cubre:

- **Camino feliz**: `publish` → `consume`, el handler recibe el evento.
- **Inyección de fallo + DLQ**: un handler que lanza error se reintenta y termina
  parqueado en `gps.detection.dlq`.

## Escenario de resiliencia (R7) — demo

1. Levantar el stack: `npm run dev`.
2. Apagar `transportations`: `docker compose -f docker-compose.dev.yml stop transportations`.
3. Asignar vehículo y conductor a una reserva (Postman `F12-AssignTrip`): la reserva queda
   `assigned` y el evento queda persistido en `outbox_events` (sin caída del request).
4. Levantar `transportations`: `docker compose -f docker-compose.dev.yml start transportations`.
   El relay publica el evento pendiente y el worker crea el trip automáticamente.

Análogamente, apagar `rabbitmq` no tira la asignación: los eventos quedan en el outbox y se
publican al recuperarse el broker.

## Carga (R8) — ráfaga GPS

Crear un vehículo (Postman GPS F14 Setup) y ejecutar:

```bash
k6 run k6/gps-burst.ts --env BASE_URL=http://localhost:3002 --env VEHICLE_ID=<uuid>
```

El endpoint de ingesta mantiene latencia acotada (p95 < 500 ms) mientras `gps.detection`
absorbe el backlog de detección.

## Observabilidad (R4)

- UI de management: `http://localhost:15672` (move/move_secret) — profundidad de colas,
  tasas de publicación/consumo, reintentos y DLQ.
- Colección Postman `postman/move-platform-rabbitmq-observability` para consultar la API de
  management (profundidad de colas, contenido de DLQ).
- Logs estructurados (JSON) en publicación y consumo con `messageId` y `routingKey`.
