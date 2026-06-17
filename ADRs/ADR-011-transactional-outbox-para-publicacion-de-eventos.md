# ADR 011: Transactional outbox para la publicación de eventos

Con la adopción de RabbitMQ (ADR-010), `reservation-service` necesita publicar eventos de dominio (`reservation.assigned` al asignar recursos a una reserva, `reservation.unsupported` al rechazar una reserva no soportada) que se originan dentro de transacciones de base de datos. Publicar directamente al broker dentro de la transacción introduce un problema de consistencia dual: si la transacción de base de datos hace rollback luego de publicar, se emite un evento por un cambio que nunca ocurrió; y si el proceso o el broker fallan entre el commit y la publicación, el cambio queda persistido pero el evento nunca se emite.

Este problema afecta directamente a R7, que exige que los flujos críticos no queden en estado inconsistente y que el sistema opere de forma degradada ante fallos de dependencias. Una reserva marcada como `assigned` sin que se llegue a crear su trip, o una reserva `rejected` sin que se notifique al cliente, son exactamente los estados inconsistentes que se busca evitar.

## Decisión

Se implementará el patrón transactional outbox para todos los eventos de dominio originados dentro de una transacción de base de datos en `reservation-service`.

Se utilizará una tabla `outbox_events` que registra cada evento pendiente de publicación con su clave de enrutamiento y su payload. La inserción de la fila en `outbox_events` se realizará dentro de la **misma transacción** que modifica el estado de la reserva, de modo que el evento se persiste si y solo si el cambio de dominio se confirma.

Un proceso relay independiente leerá periódicamente las filas en estado `pending`, las publicará en RabbitMQ utilizando publisher confirms y, una vez confirmadas por el broker, las marcará como `published`. El relay tomará las filas con bloqueo `FOR UPDATE SKIP LOCKED` para ser seguro ante múltiples instancias, y solo operará cuando exista conexión con el broker.

Para las señales GPS, que no se originan dentro de una transacción de dominio acoplable, no se aplicará outbox: se utilizará publicación directa tras la persistencia (publish-after-persist), aceptando el reintento de la siguiente señal del mismo vehículo como mecanismo de recuperación.

## Justificación

El transactional outbox fue elegido porque resuelve la consistencia dual entre la base de datos y el broker sin requerir transacciones distribuidas ni coordinación de dos fases, que serían desproporcionadas para el contexto del obligatorio. Al compartir la transacción de dominio, se garantiza atomicidad entre el cambio de estado y la intención de publicar el evento, lo que impacta positivamente en confiabilidad y en el atributo de disponibilidad (R7): si RabbitMQ o el servicio consumidor están caídos, la operación de dominio se completa igual y el evento queda persistido para reintento.

La entrega resultante es at-least-once: el relay puede republicar un evento si falla luego de publicar pero antes de marcarlo como publicado. Esto es consistente con la decisión de ADR-010 de exigir consumidores idempotentes, que deduplican el efecto de eventuales dobles entregas.

**Alternativas consideradas y rechazadas:**

- **Publicar directamente al broker dentro de la transacción de base de datos**: descartada por el riesgo de "publicado pero con rollback" o "commit pero no publicado", que produce eventos espurios o pérdida de eventos, violando R7.
- **Publicar después del commit, sin tabla intermedia**: descartada porque, si el proceso cae entre el commit y la publicación, el evento se pierde sin posibilidad de reintento, dejando estado inconsistente entre servicios.
- **Change Data Capture (CDC) sobre el log de la base de datos**: descartada por sobredimensionamiento. Requiere infraestructura adicional (por ejemplo, Debezium) y operación de un pipeline de captura, complejidad no justificada para el volumen y el alcance del obligatorio.

**Suposición**: Se asume que el relay se ejecuta de forma embebida en `reservation-service` y que la tabla `outbox_events` reside en la misma base de datos que las reservas, permitiendo compartir la transacción.

## Estado

Aceptado

## Consecuencias

**Positivas:**

- Garantiza que ningún evento originado en una transacción de dominio se pierda ni se emita de forma espuria: el evento se publica si y solo si el cambio de estado se confirma (R7).
- Desacopla la operación de dominio de la disponibilidad del broker y del servicio consumidor: la reserva se asigna o rechaza aunque RabbitMQ esté caído, y el evento se publica al recuperarse.
- El relay con `FOR UPDATE SKIP LOCKED` es seguro ante múltiples instancias del servicio.

**Negativas:**

- Se agrega una tabla y un proceso relay que deben mantenerse y monitorearse.
- Introduce latencia de publicación acotada por el intervalo de polling del relay, en lugar de publicación inmediata.
- La entrega at-least-once obliga a que los consumidores sean idempotentes, trasladando complejidad de deduplicación al lado consumidor.

**Riesgos:**

- Si el relay se detiene, los eventos quedan acumulados en estado `pending` sin publicarse hasta su reanudación. Se mitiga con la simplicidad del relay (proceso embebido en el servicio) y la observabilidad de la profundidad de la tabla.
- Mantener la publicación dentro de la transacción que también realiza la llamada al broker podría extender la duración de la transacción; se mitiga procesando en lotes acotados y publicando fuera del path de request.
