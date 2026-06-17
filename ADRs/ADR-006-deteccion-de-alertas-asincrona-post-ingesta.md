# ADR 006: Detección de alertas asíncrona post-ingesta de señal GPS

El sistema debe ingestar señales GPS con alta frecuencia (potencialmente cada pocos segundos por vehículo) y, sobre cada señal, ejecutar lógica de detección que involucra múltiples consultas a la base de datos: búsqueda de zonas rojas, cálculo geométrico punto-en-polígono, consulta de historial de velocidad y verificación de alertas activas. Ejecutar todo esto en el ciclo de respuesta HTTP haría que el endpoint de ingesta fuera lento y susceptible a timeouts bajo carga, penalizando al emisor de señales (el simulador o el dispositivo GPS real) aunque la señal en sí sea válida.

## Decisión

Nosotros separamos el pipeline de ingesta en dos fases. En la primera fase, el endpoint `POST /gps/signal` valida la señal (rangos geográficos, existencia del vehículo) y la persiste en `gps_signals`. Inmediatamente después responde `202 Accepted`. En la segunda fase, `detectAndAlert(signal)` se invoca de forma no bloqueante usando un `.catch()` para capturar errores sin propagar excepciones al caller. La detección corre de forma concurrente al resto del sistema sin bloquear nuevas ingestas.

## Justificación

El 202 Accepted comunica semánticamente que la señal fue recibida y aceptada para procesamiento, pero que el resultado de ese procesamiento (la alerta) puede no estar disponible de inmediato. Esto es correcto: el cliente que emite la señal no necesita saber si se generó una alerta; eso es incumbencia del operador que consulta `GET /alerts`.

La alternativa de responder 200/201 sólo cuando toda la detección termina agrega latencia variable e injustificada al endpoint más frecuentemente llamado del sistema. Otra alternativa, usar una cola de mensajes (como RabbitMQ o Redis Streams), hubiera dado más garantías de entrega pero introduce infraestructura adicional que no está justificada para el volumen actual.

El riesgo de esta decisión es que si `detectAndAlert` falla silenciosamente, la señal queda persistida pero sin la alerta esperada. Este riesgo se mitiga logueando el error (`console.error`) y con el hecho de que la siguiente señal del mismo vehículo volverá a ejecutar la detección.

## Estado

Supersedido parcialmente por ADR-010.

La decisión original de responder `202 Accepted` y desacoplar la detección del ciclo de respuesta HTTP se mantiene vigente. Lo que se supersede es el mecanismo de ejecución de la detección: el patrón fire-and-forget in-process (`detectAndAlert(signal).catch()`) se reemplaza por la publicación de la señal en una cola RabbitMQ (`gps.detection`) consumida por workers dedicados.

## Enmienda (ADR-010)

Al evaluar los requisitos no funcionales de pico de carga (R8: soportar picos de hasta 50x) y de durabilidad de las alertas (R3: alertas procesadas en menos de 5 segundos desde su detección), el patrón fire-and-forget in-process resultó insuficiente. Su principal debilidad ya estaba documentada en la consecuencia 4 de este ADR: si el proceso cae entre la persistencia de la señal y la ejecución de la detección, la alerta puede perderse, sin reintento ni durabilidad del trabajo en vuelo.

La detección pasa entonces a un esquema basado en cola: el endpoint `POST /gps/signal` sigue validando y persistiendo la señal y respondiendo `202 Accepted` en tiempo acotado, pero en lugar de invocar la detección en proceso publica un evento `gps.signal.ingested` en el exchange `move.gps`. La cola `gps.detection` actúa como buffer ante ráfagas (R8) y otorga durabilidad y reintento controlado al trabajo de detección (R3, R7). La lógica de detección y su idempotencia (deduplicación vía `hasActiveAlert`) se conservan sin cambios; solo cambia el mecanismo de invocación. Los detalles de la topología, garantías de entrega y resiliencia se documentan en ADR-010.

## Consecuencias

1. El endpoint de ingesta responde siempre en tiempo acotado, independientemente de la carga de detección.
2. Las alertas pueden aparecer con un pequeño retraso respecto a la señal que las disparó.
3. Un fallo en la detección no impide que señales posteriores sean procesadas ni devuelve error al emisor.
4. El sistema no garantiza "exactly-once" para la detección: si el proceso cae entre la ingesta y la detección, la alerta puede no generarse.
5. La lógica de detección es idempotente por diseño (deduplicación via `hasActiveAlert`), lo que reduce el impacto de eventuales dobles ejecuciones.
