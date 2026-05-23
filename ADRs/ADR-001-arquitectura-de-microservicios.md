# ADR 001: Arquitectura de microservicios por dominios

La plataforma MOVE resuelve problemas de naturaleza distinta: gestión de reservas, operación de transporte, autenticación y, potencialmente, categorización asistida. Cada uno de esos frentes tiene ritmos de cambio, perfiles de carga y riesgos operativos diferentes. También influyeron restricciones de proyecto: necesidad de avanzar por módulos, facilitar el trabajo paralelo del equipo, reducir el impacto de fallas locales y mantener una base de código comprensible. A la vez, el costo de adoptar microservicios no es despreciable, porque introduce más despliegues, más comunicación entre procesos y más superficie operativa.

## Decisión

Nosotros estructuraremos la solución como un conjunto de servicios separados por dominio de negocio. En esta etapa, la arquitectura estará compuesta por `api-gateway`, `reservation-service`, `transportation-service` y `categorizer-service`, cada uno con su propio proceso y responsabilidad principal. Nosotros expondremos estos componentes como servicios HTTP independientes y coordinaremos su ejecución mediante contenedores Docker.

## Justificación

La separación por dominios refleja mejor el problema que una aplicación monolítica única. `reservation-service` concentra reglas de reservas, usuarios, vehículos, zonas y categorías; `transportation-service` concentra viajes, GPS, alertas y operatoria; `api-gateway` resuelve preocupaciones transversales de entrada; y `categorizer-service` encapsula una capacidad especializada. Esta división permite evolucionar y escalar partes concretas sin forzar cambios en todo el sistema.

La alternativa principal rechazada fue un monolito modular. Esa alternativa hubiera reducido el costo operativo inicial y simplificado el debugging, pero hubiese mezclado contextos con necesidades distintas y aumentado el riesgo de acoplamiento fuerte entre módulos. También se descartó, por ahora, una arquitectura más distribuida basada en mensajería como mecanismo principal de integración, porque el costo de implementación y operación no se justifica todavía para el alcance actual del proyecto.

Se asume que el equipo puede manejar la complejidad adicional de contratos HTTP, configuración por servicio y despliegue en contenedores. También se acepta que, en esta etapa, algunas decisiones de infraestructura no estarán completamente desacopladas.

## Estado

Aceptado.

## Consecuencias

1. Se gana aislamiento lógico entre dominios y una estructura más alineada con el negocio.
2. Se facilita el escalado independiente de componentes con perfiles de carga distintos.
3. Se habilita un trabajo más paralelo entre integrantes del equipo.
4. Se incrementa la complejidad operativa, porque hay más procesos, más configuración y más puntos de falla.
5. Aparecen costos de comunicación remota, latencia y manejo de errores entre servicios.
6. Se vuelve necesario definir y mantener contratos explícitos entre componentes.
