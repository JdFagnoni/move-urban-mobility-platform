# ADR 004: Módulo shared como librería interna para tipos y utilidades

Los distintos servicios comparten contratos de datos, errores HTTP y utilidades de contexto de request. Sin un mecanismo común, el equipo debería duplicar DTOs, enums y helpers en varios repositorios o carpetas, con alto riesgo de divergencia. También influyeron costos de mantenimiento y coordinación: la duplicación reduce la velocidad de desarrollo y aumenta la probabilidad de incompatibilidades entre productor y consumidor.

## Decisión

Nosotros mantendremos un módulo `shared` como librería interna del monorepo para centralizar tipos compartidos, utilidades transversales y contratos comunes entre servicios. Nosotros consumiremos ese módulo como workspace local en los paquetes que necesiten esos contratos.

## Justificación

La implementación actual ya comparte tipos de negocio, errores y utilidades HTTP a través del paquete `@move/shared`, lo que reduce duplicación y hace más explícitos los contratos entre servicios. Dado que el proyecto ya trabaja como monorepo con workspaces de npm, esta solución tiene un costo de adopción bajo y un beneficio inmediato en consistencia.

La alternativa de copiar definiciones en cada servicio fue rechazada porque produce deriva de contratos y obliga a sincronizaciones manuales. La alternativa de publicar una librería externa versionada también fue descartada por ahora, ya que agrega complejidad de release management innecesaria para un proyecto que todavía evoluciona con alta frecuencia y dentro del mismo repositorio.

Se asume que el equipo puede coordinar cambios compatibles en el monorepo y que el módulo `shared` se mantendrá acotado a verdaderos elementos transversales, evitando convertirlo en un contenedor genérico de código.

## Estado

Aceptado.

## Consecuencias

1. Se reduce la duplicación de DTOs, tipos y utilidades repetidas.
2. Se mejora la consistencia de contratos entre servicios.
3. Se simplifica el desarrollo dentro del monorepo y el refactor coordinado.
4. Se incrementa el acoplamiento temporal entre servicios cuando cambia un contrato compartido.
5. Existe el riesgo de que `shared` crezca sin criterio y termine concentrando responsabilidades que no son realmente transversales.
6. Se vuelve necesario revisar con cuidado los cambios en contratos comunes para no propagar regresiones.
