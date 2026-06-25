# ADR 012: Redis como capa de caché en memoria

La plataforma MOVE incorpora varios requisitos donde el acceso directo a PostgreSQL en el camino de respuesta resulta insuficiente o riesgoso. El requisito R1 exige que las operaciones de los mejores clientes empresa (top-20) respondan en menos de 600 ms en F4.2, lo que obliga a resolver cotización y resolución de productos sin recalcular agregaciones costosas sobre la base relacional en cada request. El flujo de monitoreo GPS necesita exponer la última posición de cada vehículo con latencia mínima y alta frecuencia de lectura, sin castigar a la base con una consulta `ORDER BY timestamp DESC` por cada consulta del operador. La detección asíncrona de alertas (ADR-006, ADR-010) requiere un mecanismo de deduplicación atómico entre múltiples consumidores concurrentes, que evite que dos workers generen la misma alerta para el mismo vehículo. Estas tres necesidades comparten una característica común: requieren almacenamiento de acceso muy rápido, con expiración automática y operaciones atómicas, que no es natural ni eficiente resolver dentro de PostgreSQL.

A la vez, ninguna de estas estructuras es la fuente de verdad. La fuente de verdad permanece en PostgreSQL (rankings, señales GPS, alertas no resueltas), y la capa de caché debe poder reconstruirse o degradarse sin comprometer la consistencia del dominio, en línea con el requisito de resiliencia R7.

## Decisión

Se utilizará Redis como capa de caché en memoria de la plataforma, accedido mediante la biblioteca `ioredis` desde Node.js a través del cliente compartido `@move/shared` (`shared/redis/client.ts`), de modo que ningún módulo de dominio instancie su propia conexión.

Redis se empleará para tres propósitos acotados, todos ellos con la base de datos relacional como fuente de verdad:

1. **Fast-path de clientes frecuentes (R1)**: el ranking de los 20 mejores clientes empresa se materializa en un `SET` (`reservations:r1:frequent-clients`) para verificación de pertenencia en O(1), y los datos necesarios para cotización (productos de empresa, ubicaciones de empresa y catálogo de categorías) se cachean en estructuras `HASH` bajo claves `reservations:r1:*`. El ranking y sus cachés asociadas se refrescan periódicamente cada 10 minutos.
2. **Caché de señales GPS**: la última señal de cada vehículo se almacena en un `HASH` (`gps:latest:{vehicleId}`, TTL 6 horas) y las señales recientes en una `LIST` acotada a 5 entradas (`gps:recent:{vehicleId}`, TTL 1 hora), para servir el monitoreo en vivo sin consultar PostgreSQL en cada lectura.
3. **Deduplicación de alertas**: se utilizará la operación atómica `SET ... NX EX` sobre claves `alerts:active:{vehicleId}:{type}` (TTL 24 horas) como lock distribuido que garantiza idempotencia de la detección entre consumidores concurrentes.

Toda lectura desde Redis contará con un camino de degradación hacia PostgreSQL: ante error o ausencia de dato en caché, el sistema consultará la fuente de verdad. Adicionalmente, los locks de deduplicación de alertas se reconstruyen desde PostgreSQL al arrancar el servicio (`warmAlertCache`), de modo que un reinicio de Redis no provoque la regeneración de alertas ya activas.

## Justificación

Redis fue elegido porque resuelve simultáneamente los tres patrones requeridos con primitivas nativas: estructuras de datos de acceso sub-milisegundo (`SET`, `HASH`, `LIST`), expiración automática por clave (TTL) y operaciones atómicas (`SET NX`) que habilitan un lock distribuido sin lógica adicional. Esto impacta positivamente en performance (R1, R2) y en confiabilidad de la deduplicación bajo concurrencia (R3, R7). La centralización del cliente en `@move/shared` favorece modificabilidad y testabilidad, ya que el dominio depende de una abstracción común y no de múltiples conexiones dispersas.

La configuración del cliente (`maxRetriesPerRequest: 1`, `retryStrategy` con backoff acotado a 2 segundos) está deliberadamente orientada a fallar rápido: si Redis no responde, el código no debe quedar bloqueado esperando, sino degradar hacia PostgreSQL lo antes posible. Esta decisión es coherente con el rol de Redis como acelerador y no como fuente de verdad.

**Alternativas consideradas y rechazadas:**

- **Resolver todo contra PostgreSQL con índices y vistas materializadas**: descartada para el camino caliente de R1 y del monitoreo GPS porque, aun con buen tuneo, la latencia y la carga de recalcular agregaciones o servir la última señal por vehículo en cada request son superiores a una lectura en memoria. Además, PostgreSQL no ofrece una primitiva de lock con expiración tan simple como `SET NX EX` para la deduplicación de alertas.
- **Caché en memoria del proceso (in-process)**: descartada porque no se comparte entre instancias ni entre servicios. El lock de deduplicación de alertas debe ser válido entre múltiples consumidores concurrentes del worker de detección, lo que exige un almacén externo compartido.
- **Memcached**: descartado porque carece de las estructuras de datos ricas (`SET`, `HASH`, `LIST`) y de la operación atómica `SET NX EX` que el diseño aprovecha; sólo ofrece pares clave-valor planos, lo que obligaría a serializar y a implementar manualmente la lógica que Redis provee de fábrica.
- **Reutilizar Redis también como broker de mensajería**: descartada en ADR-010, donde se adoptó RabbitMQ para los flujos asíncronos. Redis queda acotado a su rol de caché, evitando mezclar responsabilidades de caché y mensajería.

**Suposición**: Se asume que Redis estará disponible como servicio dentro de la red interna del despliegue (Docker Compose), sin exposición pública, y que la pérdida temporal de la caché es tolerable porque toda lectura degrada hacia PostgreSQL.

## Estado

Aceptado

## Consecuencias

**Positivas:**

- Se habilita el cumplimiento de R1 (top-20 en menos de 600 ms) sirviendo el camino caliente desde estructuras en memoria en lugar de recalcular agregaciones sobre PostgreSQL.
- Se reduce la latencia y la carga del monitoreo GPS al servir la última posición de cada vehículo desde caché, con expiración automática.
- Se obtiene deduplicación atómica de alertas entre consumidores concurrentes mediante `SET NX EX`, garantizando idempotencia (R3, R7).
- Se preserva la consistencia del dominio: PostgreSQL sigue siendo la fuente de verdad y toda lectura de caché degrada hacia él ante fallo o ausencia.
- La centralización del cliente en `@move/shared` evita conexiones dispersas y facilita el mantenimiento.

**Negativas:**

- Se agrega un nuevo componente de infraestructura que debe ser desplegado, monitoreado y mantenido, con su propia configuración y healthcheck.
- La caché introduce consistencia eventual respecto de la fuente de verdad: entre refrescos, el ranking de clientes frecuentes o las cachés de cotización pueden quedar momentáneamente desactualizados.
- Se incrementa la complejidad del código, que debe contemplar explícitamente el camino de degradación hacia PostgreSQL en cada lectura.

**Riesgos:**

- Si Redis no está disponible, la latencia aumenta porque las lecturas caen sobre PostgreSQL; el sistema sigue siendo correcto pero R1 podría no cumplirse durante la indisponibilidad. Se mitiga con el fallo rápido del cliente (`maxRetriesPerRequest: 1`) y la degradación a la base.
- Un reinicio de Redis vacía los locks de deduplicación; se mitiga reconstruyéndolos desde PostgreSQL al arrancar el servicio (`warmAlertCache`).
- El uso de `KEYS gps:latest:*` para el monitoreo batch puede ser costoso si la cantidad de vehículos crece de forma significativa; se acepta para el volumen actual y se señala como punto de revisión futura.
