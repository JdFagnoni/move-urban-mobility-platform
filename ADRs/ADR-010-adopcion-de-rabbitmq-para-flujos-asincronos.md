# ADR 010: Adopción de RabbitMQ para flujos asíncronos

La plataforma MOVE está compuesta por servicios que hasta este punto se comunicaban exclusivamente mediante HTTP síncrono y resolvían sus efectos secundarios (detección de alertas, notificaciones) dentro del ciclo de request o con patrones fire-and-forget en proceso. Este enfoque presenta limitaciones frente a varios requisitos no funcionales del obligatorio:

- **R7** exige que los flujos críticos no se vean afectados por fallos en otras partes del sistema y que exista operación degradada o alternativa. Con comunicación HTTP síncrona entre servicios, la caída de un servicio downstream propaga el fallo al productor y puede dejar estado inconsistente entre servicios (por ejemplo, una reserva marcada como `assigned` sin su trip asociado).
- **R3** exige que las alertas se procesen en menos de 5 segundos desde su detección. El patrón fire-and-forget in-process no ofrece durabilidad ni reintento: si el proceso cae, el trabajo de detección se pierde.
- **R8** exige soportar picos de carga de hasta 50 veces el volumen normal. Ejecutar el trabajo pesado en el path de ingesta hace que el endpoint sea susceptible a saturación bajo ráfaga.
- **R2** exige listados en menos de 500 ms y consultas en menos de 300 ms a carga máxima, lo que se favorece sacando el trabajo pesado del path de request.

Se requería un mecanismo que desacoplara productores de consumidores, otorgara durabilidad al trabajo en vuelo, permitiera reintentos controlados y absorbiera ráfagas de carga, sin convertirse en un sistema de registro paralelo a la base de datos.

## Decisión

Se adoptará RabbitMQ como broker de mensajería para los flujos genuinamente asíncronos de la plataforma, utilizando la biblioteca `amqplib` (cliente AMQP 0-9-1) desde Node.js y la imagen `rabbitmq:3.13-management-alpine` en los despliegues Docker.

La integración se centralizará en la capa compartida `@move/shared/messaging`, de modo que ningún módulo de dominio dependa directamente de `amqplib`. Esta capa expone la conexión con reconexión y backoff exponencial, la declaración idempotente de la topología, la publicación con confirmaciones del broker y el consumo con reconocimiento manual.

Se utilizarán exchanges de tipo `topic` segmentados por dominio: `move.reservations` para los eventos del dominio de reservas, `move.gps` para los jobs de detección de señales GPS, y `move.dlx` como dead-letter exchange común. Cada cola de trabajo (`trip.creation`, `notifications.email`, `gps.detection`) contará con su pareja de cola de reintento con TTL y su cola de dead-letter parqueada para inspección manual.

La garantía de entrega será at-least-once: la publicación usará publisher confirms y mensajes persistentes, y los consumidores serán idempotentes por diseño, aceptando la posibilidad de doble entrega y deduplicando sus efectos.

Los flujos sincrónicos de baja latencia (R1, top-20) y las operaciones CRUD (F8–F11) quedan explícitamente fuera del alcance del broker, por no ser candidatos genuinos a asincronía.

## Justificación

RabbitMQ fue elegido porque resuelve directamente los atributos de calidad comprometidos: disponibilidad y confiabilidad (R7), performance bajo carga (R2, R8) y capacidad de procesamiento durable de eventos (R3). El desacople por cola permite que un productor no falle ni quede inconsistente cuando el consumidor o un servicio downstream está caído, y que el trabajo encolado se procese cuando el consumidor se recupere.

El tipo de exchange `topic` fue preferido por su extensibilidad: nuevos consumidores pueden engancharse mediante nuevos bindings sin modificar a los productores, lo que favorece la modificabilidad. La centralización en `@move/shared/messaging` favorece modificabilidad y testabilidad, ya que el dominio depende de una abstracción y no de la infraestructura concreta del broker.

**Alternativas consideradas y rechazadas:**

- **Mantener la comunicación HTTP síncrona actual**: descartada porque acopla la disponibilidad de los servicios, propaga fallos downstream al productor y puede dejar estado inconsistente entre servicios (viola R7). Además, ejecutar el trabajo en el path de request penaliza la latencia bajo carga (R2, R8).
- **Redis Streams**: descartada porque, si bien ofrece colas y grupos de consumidores, aporta menos primitivas nativas para enrutamiento por tópicos, reintentos con dead-letter y confirmaciones de publicación que RabbitMQ. Reutilizar Redis como broker mezclaría responsabilidades de caché y mensajería y exigiría implementar manualmente patrones que RabbitMQ provee de fábrica.
- **Apache Kafka**: descartada por sobredimensionamiento. Kafka está orientado a log de eventos de alto volumen y retención prolongada, con mayor complejidad operativa (gestión de particiones, offsets, coordinación). Para el volumen y los casos de uso del obligatorio (creación de trip por evento, detección de alertas, notificaciones con reintento), RabbitMQ ofrece las garantías necesarias con menor costo operativo.

**Suposición**: Se asume que RabbitMQ estará disponible como servicio dentro de la red interna del despliegue (Docker Compose), sin exposición pública más allá de la UI de management utilizada para observabilidad y demostración.

## Estado

Aceptado

Supersede parcialmente a ADR-006 en lo referente al mecanismo de detección de alertas GPS.

## Consecuencias

**Positivas:**

- Se desacoplan productores y consumidores: la caída de un servicio downstream no propaga el fallo al productor, habilitando operación degradada (R7).
- Se otorga durabilidad y reintento controlado al trabajo en vuelo (detección de alertas, creación de trips, notificaciones), reduciendo la pérdida de trabajo ante caídas de proceso (R3).
- Las colas actúan como buffer y back-pressure, absorbiendo ráfagas sin saturar los endpoints de ingesta (R8) y sacando el trabajo pesado del path de request (R2).
- La topología por tópicos permite incorporar nuevos consumidores sin modificar productores, favoreciendo la modificabilidad.
- La UI de management expone métricas de colas (profundidad, procesados, reintentos, DLQ) que alimentan la observabilidad (R4).

**Negativas:**

- Se agrega un nuevo componente de infraestructura que debe ser desplegado, monitoreado y mantenido, con su configuración de credenciales y healthcheck.
- La comunicación deja de ser sincrónica en los flujos afectados y pasa a depender de consistencia eventual entre el productor y el efecto del consumidor.
- La garantía at-least-once implica que los consumidores deben ser idempotentes, lo que agrega complejidad de diseño (deduplicación por clave de dominio).

**Riesgos:**

- Si RabbitMQ no está disponible, los eventos no se procesan hasta su recuperación. Este riesgo se mitiga con el patrón transactional outbox (ADR-011) para eventos originados en transacciones de base de datos, y con la persistencia de las señales GPS más el reintento de la siguiente señal del mismo vehículo.
- Una topología mal declarada (TTL, bindings de retry o dead-letter incorrectos) puede provocar ciclos de reintento infinitos o pérdida de mensajes. Se mitiga centralizando y versionando la declaración idempotente de la topología en `@move/shared/messaging` y parqueando los mensajes en la DLQ tras un número máximo de reintentos.
