# ADR 012: Métricas de aplicación en memoria y health checks extendidos por servicio

El obligatorio exige en `R4` que el sistema registre eventos, errores e interacciones con
servicios externos, y que permita visualizar métricas mediante un dashboard o endpoint,
mencionando explícitamente como ejemplos la cantidad de pedidos por categoría y la cantidad de
requests por minuto de un endpoint determinado.

Hasta este punto, MOVE contaba con logging estructurado (Winston en `api-gateway`, un logger
JSON propio en `shared/messaging/log.ts`) y un `GET /health` básico en cada uno de los cuatro
servicios (`api-gateway`, `reservation-service`, `transportation-service`,
`categorizer-service`), pero ningún contador agregado ni endpoint de métricas de negocio. La
colección Postman de observabilidad existente cubría únicamente la API de management de
RabbitMQ (profundidad de colas, reintentos, DLQ), documentada junto a `ADR-010` y `ADR-011`, sin
visibilidad sobre requests HTTP por endpoint ni sobre el resultado de las llamadas a servicios
externos (Auth0, Stripe, Ollama).

El equipo decidió priorizar este requerimiento en el tiempo disponible antes de la entrega,
optando por la solución de menor costo de implementación que aun así cubriera los ejemplos
literales de la letra y resultara fácil de demostrar en el video de defensa mediante Postman.

## Decisión

Se implementará un registro de métricas en memoria por proceso, centralizado en
`@move/shared` (`shared/metrics/registry.ts` y el middleware `shared/http/request-metrics.ts`),
y se expondrá mediante un endpoint `GET /metrics` propio en cada uno de los cuatro servicios, sin
agregación cruzada entre ellos. El formato de respuesta será JSON simple, no el formato de
exposición de Prometheus.

Cada `/metrics` reportará como mínimo `requestsByRoute` (cantidad y latencia promedio por método
y ruta) y, cuando el servicio realice llamadas a servicios externos, `externalCalls` (resultado
`success`/`error`/`timeout` por proveedor). Adicionalmente, `reservation-service` agregará
`reservationsByCategory` mediante una consulta de agregación sobre las tablas `goods` y
`categories`, y `transportation-service` agregará alertas generadas por tipo y señales GPS
ingeridas, ambos derivados directamente de Postgres.

Se ampliará además `GET /health` en `reservation-service` (estado de Postgres y de RabbitMQ, este
último mediante `isConnected()` de `shared/messaging`), en `transportation-service` (Postgres,
Redis y RabbitMQ) y en `categorizer-service` (verificación liviana de Ollama con timeout corto).
`api-gateway` no expone dependencias de infraestructura propias, por lo que su `/health` se
mantiene sin cambios.

## Justificación

La centralización del registro de contadores en `@move/shared` sigue el mismo patrón ya
establecido en el repositorio para `shared/db/pool.ts` y `shared/messaging/` (`ADR-004`),
evitando que cada servicio implemente su propia lógica de conteo. Que cada servicio expone su
propio `/metrics` y `/health` sin agregación central es consistente con el diseño ya vigente para
`/health` y con el acceso directo a la UI de management de RabbitMQ en el puerto `15672`, en lugar
de proxearla a través del gateway.

El registro en memoria, sin persistencia, fue preferido porque `R4` exige poder *visualizar* el
estado del sistema, no mantener un histórico durable de métricas; agregar persistencia hubiera
introducido complejidad sin un requerimiento que la justifique. Instrumentar los adaptadores de
Stripe y Auth0 envolviendo sus métodos públicos, sin modificar la lógica de timeouts ya existente,
minimiza el riesgo de introducir regresiones en código de integración externa ya probado.

Esta decisión impacta positivamente los atributos de calidad de disponibilidad (los health checks
extendidos permiten detectar qué dependencia concreta está caída) y de testability/observabilidad
(facilita demostrar el cumplimiento de requerimientos no funcionales durante la defensa). El costo
en performance es despreciable: los contadores son incrementos en memoria sobre estructuras `Map`,
sin I/O adicional en el camino crítico de cada request.

**Alternativas consideradas y rechazadas:**

- **Prometheus / `prom-client`**: descartado por agregar una dependencia nueva al proyecto y por
  exponer texto en formato de métricas de Prometheus, que es menos demostrable directamente en
  Postman durante el video de defensa que un JSON legible, dado el tiempo disponible antes de la
  entrega. Queda como una evolución futura razonable si el sistema necesitara integrarse con
  Grafana.
- **Agregación centralizada de métricas en `api-gateway`**, haciendo fan-out hacia los demás
  servicios: descartada por ser inconsistente con el patrón ya vigente de `/health`
  independiente por servicio, y por agregar complejidad adicional (orquestación de llamadas,
  manejo de fallos parciales) no justificada por el tiempo disponible.
- **Persistir las métricas en Postgres o Redis**: descartada porque `R4` no exige histórico
  durable de métricas, solo visibilidad del estado actual; persistirlas hubiera duplicado
  responsabilidades sin beneficio claro.

**Suposición**: Se asume que, para los fines de la defensa y de la demo funcional, es aceptable
que los contadores se reinicien con cada redeploy o reinicio de proceso, ya que el objetivo es
mostrar el comportamiento del sistema en una ventana de demostración acotada, no producir
reportes históricos.

## Estado

Aceptado

Complementa a `ADR-010` (adopción de RabbitMQ) y `ADR-011` (transactional outbox): la UI de
management de RabbitMQ ya cubre la observabilidad de colas; este ADR cubre la parte de métricas
de aplicación y de interacción con servicios externos que faltaba para satisfacer `R4`.

## Consecuencias

**Positivas:**

- Se cumplen los dos ejemplos literales de `R4` (pedidos por categoría y requests por minuto por
  endpoint) con una solución de bajo costo de implementación.
- Los health checks extendidos permiten, durante la demo, apagar una dependencia puntual
  (Postgres, Redis, RabbitMQ u Ollama) y mostrar exactamente cuál está degradada, reforzando
  también la evidencia de `R7`.
- La centralización en `@move/shared` evita duplicar lógica de conteo entre los cuatro servicios
  y facilita extender las métricas a futuro (por ejemplo, para medir la latencia de `R1`).

**Negativas:**

- Los contadores no persisten entre reinicios del proceso, por lo que no sirven como fuente de
  métricas históricas ni de auditoría a largo plazo.
- Al no agregarse entre servicios, obtener una vista unificada del sistema requiere consultar los
  cuatro endpoints por separado (mitigado parcialmente con la colección Postman dedicada).
- El conteo de `externalCalls` depende de que cada nuevo punto de integración externa se
  instrumente manualmente; si se agrega un proveedor externo nuevo sin envolver su llamada con
  `recordExternalCall`, quedará fuera de las métricas sin que el sistema lo señale.

**Riesgos:**

- Si el volumen de rutas distintas crece mucho (por ejemplo, por IDs en la URL que no se agrupan
  correctamente), el mapa de `requestsByRoute` podría crecer sin límite dentro de la vida del
  proceso. Se mitiga parcialmente agrupando por el patrón de ruta de Express (`req.route.path`)
  en lugar del path literal cuando está disponible.
