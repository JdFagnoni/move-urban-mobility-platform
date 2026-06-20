# K6 - Pruebas de performance (R1, R2, R3, R8)

Los cuatro scripts (`r1`/`r2`/`r3`/`r8`) y el seed se corrieron de punta a
punta contra el stack local (`docker-compose.dev.yml`) para validarlos; las
notas de "Hallazgos" mas abajo son resultado de eso, no suposiciones.

## Prerequisitos

- Stack levantado: `docker compose -f docker-compose.dev.yml up -d` (o `npm run dev` desde la raiz).
- k6 instalado (probado con v2.0.0; corre los `.ts` directo, sin paso de build).
- Las credenciales del tenant de prueba de Auth0 y del admin bootstrap (`admin@move.local` / `Admin123`) ya estan como default en `k6/helpers/config.ts`, tomadas de `postman/`. Si tu entorno usa un tenant o admin distinto, pasalos por `--env`.

## Scripts existentes (sin tocar)

- `k6/load-test.ts`: throughput/latencia genericos sobre `/health` (R2/R5/R8).
- `k6/gps-burst.ts`: rafaga de GPS hasta 50x (R8/R3).

## Hallazgo importante: rate limiter global del gateway

`api-gateway` aplica un rate limiter fijo de **300 req/min (=5 req/s) por IP**
sobre TODAS sus rutas, incluso `/health` (`api-gateway/src/middleware/rate-limit.ts`,
valor hardcodeado, sin variable de entorno). Como la letra no pide modificar
codigo de los servicios, los scripts no lo desactivan: en cambio, las tasas
de R1 y R2 estan calibradas para quedar bien por debajo de ese techo (asi se
mide la latencia real de los endpoints en vez de la latencia de un 429), y
R8 usa un baseline (`BASELINE_RPS=4`) elegido a proposito **justo debajo**
del techo, para que el escalon 1x se vea limpio y la degradacion aparezca de
forma clara recien en 5x. Si necesitas reproducir el "20 req/s" que sugiere
la letra como ejemplo de baseline, vas a estar midiendo el rate limiter del
gateway, no la capacidad de `reservation-service`.

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
frecuente". (Verificado: tras el seed + restart, el `SET` de Redis
`reservations:r1:frequent-clients` contiene el id real del cliente.)

## R1 - Performance de clasificacion de reservas

```bash
k6 run k6/r1-reservation-performance.ts --env BASE_URL=http://localhost:3000
```

Override de carga (tasas, no VUs sueltos -- ver rate limiter arriba):
`--env FREQUENT_RATE=2 --env NONFREQUENT_RATE=1 --env PARTICULAR_RATE=1 --env DURATION=2m`

## R2 - Consultas y listados bajo carga maxima

```bash
k6 run k6/r2-query-performance.ts --env BASE_URL=http://localhost:3000
```

Override: `--env ACTIVE_TRIPS_COUNT=15 --env GPS_VEHICLE_COUNT=50 --env RESERVAS_PER_MIN=100 --env DURATION=2m`

El `setup()` tarda uno o dos minutos: registra `ACTIVE_TRIPS_COUNT`
conductores y crea sus vehiculos/reservas/traslados reales (incluye logins
contra Auth0, espaciados para no chocar con el rate limiter). El
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

Override: `--env BASELINE_RPS=4 --env RAMP_TIME_S=10 --env STAGE_HOLD_S=30 --env MAX_VUS=1000`

Para ver en que escalon empieza la degradacion, correr con
`k6 run k6/r8-stress-test.ts --out json=r8-result.json` y filtrar los puntos
`http_req_duration`/`http_req_failed` por `tags.stage` (k6 no soporta
thresholds por escalon dentro de una misma corrida).

## Variables de entorno comunes (`k6/helpers/config.ts`)

- `BASE_URL` (default `http://localhost:3000`, el api-gateway)
- `TRANSPORTATIONS_BASE_URL` (default `http://localhost:3002`, usado solo para `POST /gps/signal`)
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`, `AUTH0_REALM`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `FREQUENT_COMPANY_EMAIL` / `FREQUENT_COMPANY_PASSWORD`
- `NONFREQUENT_COMPANY_EMAIL` / `NONFREQUENT_COMPANY_PASSWORD`
- `INDIVIDUAL_CLIENT_EMAIL` / `INDIVIDUAL_CLIENT_PASSWORD`

## Hallazgos relevantes durante la implementacion

- **Rate limiter global del gateway** (ver seccion arriba): 300 req/min por
  IP sobre todas las rutas, sin variable de entorno para ajustarlo.
- **`createAuthenticate()` de `@move/shared` no valida JWT por su cuenta**:
  tanto `reservation-service` como `transportation-service` usan el mismo
  middleware compartido, que solo confia en los headers `x-auth-subject` /
  `x-internal-gateway-secret` que el **gateway** agrega al proxyear
  (`forwardIdentityHeaders`). Pegarle directo a `transportation-service`
  (puerto 3002) con un Bearer token valido en una ruta protegida (vehiculos,
  zonas, trips) devuelve 401 igual, porque el servicio nunca mira ese header.
  Por eso `helpers/fleet.ts` pasa por el gateway para esas llamadas; la unica
  excepcion es `POST /gps/signal`, que no tiene ningun middleware de auth y
  por eso sigue yendo directo al servicio (igual que `k6/gps-burst.ts`).
- `CLAUDE.md` lista `vehicles/` y `zones/` como modulos de
  `reservation-service`; en el codigo actual viven en `transportation-service`
  (`transportation-service/src/modules/{vehicles,zones}`), expuestos por el
  gateway en `/transportations/vehicles` y `/transportations/zones`. Dos
  colecciones de Postman (`postman/vehicles.postman_collection.json` y parte
  de `F18-ConsultarTrasladosEnCurso.postman_collection.json`) todavia apuntan
  a `/reservations/vehicles`, que ya no existe.
- El catch-all protegido del gateway (`mountProtectedRoute("/")` en
  `api-gateway/src/routes/transportations.ts`) exige JWT para cualquier ruta
  de `transportations` no explicitada como publica. `POST /gps/signal` no
  esta en esa lista de publicas pese a no requerir auth en el servicio.
- No existe ningun endpoint HTTP de seed/reset de datos de testing; el
  workaround para "cliente frecuente" queda documentado arriba.
- `GET /reservations/auth/me` anida el perfil en `data.user`, no en `data`
  directamente.
- Se observaron fallos transitorios puntuales y poco frecuentes (una llamada
  aislada en varias decenas) tanto en el registro de usuarios ("Could not
  create an Auth0 user: fetch failed", 503) como en el propio gateway
  ("Authentication service unavailable", 503) durante corridas con muchos
  requests seguidos; en ambos casos un reintento inmediato funciono. Los
  helpers reintentan una vez el registro por las dudas.
- Esta version de k6 no resuelve imports relativos locales sin extension de
  archivo: hace falta escribir `from "./helpers/auth.ts"`, no
  `from "./helpers/auth"`. Tenelo en cuenta si agregas mas helpers.
