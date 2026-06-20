# K6 - Pruebas de performance (R1, R2, R3, R8)

## Prerequisitos

- Stack levantado: `docker compose -f docker-compose.dev.yml up -d` (o `npm run dev` desde la raiz).
- k6 instalado (>= v0.50; corre los `.ts` directo, sin paso de build).
- Las credenciales del tenant de prueba de Auth0 y del admin bootstrap (`admin@move.local` / `Admin123`) ya estan como default en `k6/helpers/config.ts`, tomadas de `postman/`. Si tu entorno usa un tenant o admin distinto, pasalos por `--env`.

## Scripts existentes (sin tocar)

- `k6/load-test.ts`: throughput/latencia genericos sobre `/health` (R2/R5/R8).
- `k6/gps-burst.ts`: rafaga de GPS hasta 50x (R8/R3).

## Paso previo obligatorio para R1 (empresa frecuente) y R8

El ranking de clientes frecuentes (top 20) no tiene API de seed/reset: se
recalcula con una consulta SQL sobre reservas reales de los ultimos 7 dias y
se sincroniza a Redis solo al levantar `reservation-service` y despues cada
10 minutos (`fast-path-cache.ts`). Para que el fast-path este realmente
activo durante la medicion:

```bash
k6 run k6/seed/seed-frequent-client.ts
docker compose -f docker-compose.dev.yml restart reservations
```

Sin este paso, `r1-reservation-performance.ts` y `r8-stress-test.ts` igual
corren (registran los clientes al vuelo), pero "empresa frecuente" no estara
realmente en el top 20 y va a medir el mismo camino que "empresa no
frecuente".

## R1 - Performance de clasificacion de reservas

```bash
k6 run k6/r1-reservation-performance.ts --env BASE_URL=http://localhost:3000
```

Override de carga: `--env FREQUENT_VUS=30 --env NONFREQUENT_VUS=20 --env PARTICULAR_VUS=10 --env DURATION=2m`

## R2 - Consultas y listados bajo carga maxima

```bash
k6 run k6/r2-query-performance.ts --env BASE_URL=http://localhost:3000
```

Override: `--env ACTIVE_TRIPS_COUNT=15 --env GPS_VEHICLE_COUNT=50 --env RESERVAS_PER_MIN=100 --env DURATION=2m`

El `setup()` tarda uno o dos minutos: registra ~15 conductores y crea sus
vehiculos/reservas/traslados reales (incluye logins contra Auth0). El
`setupTimeout` ya esta configurado en 3 minutos.

## R3 - Latencia de procesamiento de alertas

```bash
k6 run k6/r3-alert-latency.ts
```

Override: `--env R3_SAMPLES=20` para tomar mas muestras (cada muestra crea un
vehiculo nuevo, para no chocar con el lock de deduplicacion de alertas de 24h).

## R8 - Escalabilidad hasta 50x

Requiere el mismo seed + restart que R1 (usa el mismo cliente "frecuente").

```bash
k6 run k6/r8-stress-test.ts
```

Override: `--env BASELINE_RPS=20 --env RAMP_TIME_S=10 --env STAGE_HOLD_S=30 --env MAX_VUS=1000`

Para ver en que escalon empieza la degradacion, correr con
`k6 run k6/r8-stress-test.ts --out json=r8-result.json` y filtrar los puntos
`http_req_duration`/`http_req_failed` por `tags.stage` (k6 no soporta
thresholds por escalon dentro de una misma corrida).

## Variables de entorno comunes (`k6/helpers/config.ts`)

- `BASE_URL` (default `http://localhost:3000`, el api-gateway)
- `TRANSPORTATIONS_BASE_URL` (default `http://localhost:3002`, transportation-service directo)
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`, `AUTH0_REALM`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `FREQUENT_COMPANY_EMAIL` / `FREQUENT_COMPANY_PASSWORD`
- `NONFREQUENT_COMPANY_EMAIL` / `NONFREQUENT_COMPANY_PASSWORD`
- `INDIVIDUAL_CLIENT_EMAIL` / `INDIVIDUAL_CLIENT_PASSWORD`

## Hallazgos relevantes durante la implementacion

- `CLAUDE.md` lista `vehicles/` y `zones/` como modulos de
  `reservation-service`; en el codigo actual viven en `transportation-service`
  (`transportation-service/src/modules/{vehicles,zones}`), expuestos por el
  gateway en `/transportations/vehicles` y `/transportations/zones`. Dos
  colecciones de Postman (`postman/vehicles.postman_collection.json` y parte
  de `F18-ConsultarTrasladosEnCurso.postman_collection.json`) todavia apuntan
  a `/reservations/vehicles`, que ya no existe.
- El catch-all protegido del gateway (`mountProtectedRoute("/")` en
  `api-gateway/src/routes/transportations.ts`) exige JWT para cualquier ruta
  de `transportations` no explicitada como publica, incluido `POST
  /gps/signal` -- que en `transportation-service` en si es publico (pensado
  para dispositivos GPS sin login). Por eso estos scripts (igual que el
  `gps-burst.ts` ya existente) le pegan directo al servicio en el puerto 3002
  para ese endpoint puntual, en vez de pasar por el gateway.
- No existe ningun endpoint HTTP de seed/reset de datos de testing; el
  workaround para "cliente frecuente" queda documentado arriba.
