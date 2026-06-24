# ADR 001: Arquitectura basada en servicios por dominios

La plataforma MOVE resuelve problemas de naturaleza distinta: gestión de reservas, operación de transporte, autenticación y categorización asistida. Cada uno de esos frentes tiene ritmos de cambio, perfiles de carga y riesgos operativos diferentes. También influyeron restricciones de proyecto: necesidad de avanzar por módulos, facilitar el trabajo paralelo del equipo, reducir el impacto de fallas locales y mantener una base de código comprensible. A la vez, el costo de adoptar una arquitectura distribuida no es despreciable, porque introduce más despliegues, más comunicación entre procesos y más superficie operativa.

## Decisión

Nosotros estructuraremos la solución como una **arquitectura basada en servicios** (_service-based architecture_): un conjunto reducido de servicios de granularidad gruesa, organizados por dominio de negocio, que comparten una única instancia de base de datos PostgreSQL. En esta etapa, la arquitectura estará compuesta por `api-gateway`, `reservation-service`, `transportation-service` y `categorizer-service`, cada uno con su propio proceso y responsabilidad principal. Nosotros expondremos estos componentes como servicios HTTP independientes y coordinaremos su ejecución mediante contenedores Docker.

A diferencia de una arquitectura de microservicios, los servicios no tienen bases de datos propias e independientes: comparten la misma instancia PostgreSQL. Esta característica es deliberada y no una deuda técnica.

## Justificación

La separación por dominios refleja mejor el problema que una aplicación monolítica única. `reservation-service` concentra reglas de reservas, usuarios, vehículos, zonas y categorías; `transportation-service` concentra viajes, GPS, alertas y operatoria; `api-gateway` resuelve preocupaciones transversales de entrada; y `categorizer-service` encapsula una capacidad especializada. Esta división permite evolucionar y escalar partes concretas sin forzar cambios en todo el sistema.

La elección de **base de datos compartida** (en lugar de una base de datos por servicio) responde a múltiples factores. Primero, simplifica la consistencia de datos entre dominios: consultas como la validación de vehículos o la lectura de zonas geográficas (ADR-007) se resuelven directamente en la base de datos sin round-trips HTTP adicionales. Segundo, reduce el costo operativo de la etapa actual: mantener múltiples instancias de base de datos con migraciones independientes escalaría la complejidad operativa sin justificación para el equipo y el alcance del proyecto. Tercero, el acoplamiento estructural resultante es aceptable porque todos los servicios pertenecen al mismo repositorio y al mismo equipo, lo que hace posible coordinar cambios de esquema de forma controlada.

**Alternativas consideradas y rechazadas:**

- **Monolito modular**: hubiera reducido el costo operativo inicial y simplificado el debugging, pero hubiera mezclado contextos con necesidades distintas y aumentado el riesgo de acoplamiento fuerte entre módulos con ciclos de release acoplados.
- **Arquitectura de microservicios con bases de datos por servicio**: descartada porque exige bases de datos independientes, datos replicados entre servicios, sagas o two-phase commit para consistencia distribuida, y mayor complejidad operativa que no está justificada para el equipo y el alcance actual del proyecto.
- **Mensajería como mecanismo principal de integración (event-driven)**: descartada como arquitectura base; introducida selectivamente para flujos asíncronos específicos donde el desacople lo justifica (ADR-010).

Se asume que el equipo puede manejar la complejidad adicional de contratos HTTP, configuración por servicio y despliegue en contenedores. También se acepta que la base de datos compartida introduce acoplamiento de esquema entre servicios que conviene gobernar explícitamente mediante convenciones de acceso documentadas.

## Estado

Aceptado.

## Consecuencias

1. Se gana aislamiento lógico entre dominios y una estructura más alineada con el negocio.
2. Se facilita el trabajo paralelo entre integrantes del equipo.
3. Se habilita el escalado independiente de los procesos de cada servicio, aunque no de la capa de datos de forma independiente.
4. La base de datos compartida permite consultas entre dominios sin HTTP adicional, pero introduce acoplamiento de esquema que debe gobernarse con cuidado (ver ADR-007).
5. Se incrementa la complejidad operativa respecto de un monolito: hay más procesos, más configuración y más puntos de falla.
6. Se vuelve necesario definir y mantener contratos explícitos entre componentes.
7. Las migraciones de esquema afectan a múltiples servicios de forma coordinada; cualquier cambio de tabla debe considerar todos los consumidores actuales.
