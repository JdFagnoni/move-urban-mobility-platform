# ADR 013: Estrategia de resiliencia mediante timeouts, fallbacks y aislamiento en lugar de circuit breaker

El requisito R7 exige que los grupos funcionales críticos del sistema —reservas y su flujo de cotización y pago (F2–F6, F21) y la operación de transporte, GPS y alertas (F13–F15)— no se vean afectados por fallas en otras partes del sistema, y que el sistema opere de forma degradada o alternativa ante la indisponibilidad de una dependencia. La plataforma integra varias dependencias externas e internas que pueden fallar o demorar: Auth0 para validación de identidad, Stripe para pagos, el `categorizer-service` para clasificación de bienes, RabbitMQ para flujos asíncronos, Redis como caché y PostgreSQL como base de datos. Una falla o lentitud en cualquiera de ellas no debe propagarse en cascada ni bloquear indefinidamente los caminos de request.

Existía la decisión de adoptar o no un mecanismo formal de _circuit breaker_ (por ejemplo, una biblioteca como `opossum`) que abriera el circuito tras un umbral de fallos consecutivos. Sin embargo, las dependencias del sistema son pocas, conocidas y de invocación acotada, y el comportamiento de degradación esperado es específico de cada una (devolver 503, devolver `null` para derivar a operador, leer desde la base en vez de la caché). Esto hacía cuestionable el costo conceptual y operativo de introducir una librería de circuit breaker frente a una estrategia explícita y verificable por dependencia.

## Decisión

Se adoptará una estrategia de resiliencia compuesta, basada en cuatro mecanismos explícitos por dependencia, en lugar de un patrón de _circuit breaker_ genérico:

1. **Timeouts en toda llamada saliente**: cada invocación a una dependencia externa se acota con un timeout mediante `AbortController`. La validación de JWKS de Auth0 en el `api-gateway` usa 5 segundos; la llamada a Stripe usa 5 segundos; la llamada al `categorizer-service` usa 10 segundos. Ninguna llamada externa queda sin límite de tiempo.
2. **Fallbacks explícitos por dependencia**: ante fallo o timeout, cada dependencia define su degradación. El `api-gateway` mapea cualquier error de proxy hacia un servicio downstream a `503 Service Unavailable` sin propagar la excepción. Las lecturas de Redis degradan hacia PostgreSQL (ADR-012). La clasificación de bienes que falla devuelve ausencia de categoría, derivando la reserva a tratamiento manual por operador (F19).
3. **Reintentos con durabilidad para el trabajo asíncrono**: la inicialización de la base reintenta hasta 10 veces con 3 segundos de espera; la conexión a RabbitMQ reintenta con backoff exponencial acotado a 30 segundos; los consumidores reintentan hasta 5 veces y parquean en una _dead-letter queue_ tras agotar los reintentos (ADR-010). El patrón transactional outbox (ADR-011) garantiza que ningún evento de dominio se pierda ante la caída del broker.
4. **Aislamiento entre grupos funcionales (bulkhead)**: el desacople por colas de RabbitMQ y el acceso directo de sólo lectura del `transportation-service` a las tablas compartidas (ADR-007) evitan que una falla en el dominio de reservas (F2–F6, F21) afecte la ingesta GPS y la detección de alertas (F13–F15), y viceversa. El path de ingesta GPS no realiza llamadas HTTP síncronas a `reservation-service`, por lo que la indisponibilidad de éste no lo afecta.

## Justificación

La estrategia compuesta fue elegida porque cada dependencia tiene un comportamiento de degradación distinto y deseable, que un circuit breaker genérico no captura por sí solo: ante Auth0 caído corresponde un 503; ante el categorizador caído corresponde derivar a operador; ante Redis caído corresponde leer de la base. Definir la degradación de forma explícita por dependencia hace el comportamiento predecible, testeable y defendible, atributos centrales para R7. El timeout uniforme mediante `AbortController` resuelve el problema principal que motiva un circuit breaker —evitar el bloqueo indefinido y la propagación de lentitud— sin introducir estado adicional ni una librería externa.

El aislamiento entre grupos funcionales se apoya en decisiones ya tomadas: la mensajería desacoplada (ADR-010) actúa como bulkhead natural, ya que una ráfaga o falla en un flujo no consume los recursos de otro, y el acceso directo de sólo lectura a las tablas compartidas (ADR-007) elimina la dependencia síncrona del path GPS respecto de `reservation-service`. La durabilidad del trabajo asíncrono (ADR-010, ADR-011) asegura que la caída de un consumidor o del broker no produzca pérdida de trabajo ni estado inconsistente entre servicios.

**Alternativas consideradas y rechazadas:**

- **Circuit breaker formal (por ejemplo, `opossum`)**: descartado porque agrega estado y configuración (umbrales de apertura, ventanas de medición, _half-open_) cuya complejidad no se justifica para el número acotado de dependencias del obligatorio. El objetivo principal del circuit breaker —cortar llamadas a una dependencia degradada para no bloquearse— ya se cubre con timeouts agresivos y fallbacks explícitos. Se reconoce como evolución futura natural si el número de dependencias o el volumen crecen.
- **No acotar las llamadas externas (sin timeout)**: descartada porque una dependencia lenta bloquearía hilos y propagaría la latencia al cliente, violando R7 y degradando R2.
- **Propagar el error de la dependencia al cliente sin degradación**: descartada porque una falla en una parte del sistema (por ejemplo, el categorizador) no debe impedir el avance del flujo de negocio cuando existe una alternativa válida (derivar a operador, F19).

**Suposición**: Se asume que los valores de timeout elegidos (5 s para Auth0 y Stripe, 10 s para el categorizador) son adecuados para el comportamiento esperado de cada dependencia y podrán ajustarse con evidencia de las pruebas de carga (R8) y de los escenarios de falla.

## Estado

Aceptado

## Consecuencias

**Positivas:**

- Ninguna llamada externa puede bloquear indefinidamente un request, lo que protege la latencia bajo carga (R2) y evita la propagación de lentitud (R7).
- El comportamiento de degradación es explícito y específico por dependencia, lo que lo hace predecible, testeable y defendible.
- Los grupos funcionales F2–F6/F21 y F13–F15 quedan aislados: una falla en uno no se propaga al otro, apoyándose en la mensajería desacoplada (ADR-010) y el acceso directo de lectura (ADR-007).
- El trabajo asíncrono tiene durabilidad y reintento controlado, evitando pérdida de trabajo y estado inconsistente (ADR-010, ADR-011).
- Se evita el costo conceptual y operativo de una librería de circuit breaker no justificada para el alcance actual.

**Negativas:**

- La lógica de resiliencia queda distribuida en múltiples puntos (cada llamada define su timeout y su fallback) en lugar de centralizada en un único componente, lo que exige disciplina para mantener la coherencia.
- No existe un mecanismo automático que "abra el circuito" tras fallos repetidos: cada request a una dependencia caída seguirá pagando el costo del timeout hasta que la dependencia se recupere.
- La ausencia de un breaker formal traslada al equipo la responsabilidad de elegir y mantener timeouts adecuados por dependencia.

**Riesgos:**

- Bajo una dependencia degradada de forma sostenida, el costo repetido de timeouts podría afectar la performance agregada; se mitiga con timeouts agresivos y se señala el circuit breaker como evolución futura.
- Si se incorpora una nueva dependencia sin aplicar la estrategia (timeout + fallback), se abriría una brecha de resiliencia; se mitiga documentando esta decisión como criterio obligatorio para toda integración nueva.
