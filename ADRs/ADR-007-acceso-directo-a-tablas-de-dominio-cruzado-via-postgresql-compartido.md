# ADR 007: Acceso directo a tablas de dominio cruzado vía PostgreSQL compartido

El `transportation-service` necesita dos tipos de datos que pertenecen al dominio de `reservation-service`: la existencia de un vehículo (para validar señales GPS) y los polígonos de zonas rojas (para la detección de geofence). Dado que la plataforma adopta una arquitectura basada en servicios con base de datos compartida (ADR-001, ADR-003), ambos servicios acceden a la misma instancia PostgreSQL. La pregunta no es si pueden compartir la base de datos, sino cómo debe `transportation-service` acceder a datos cuya responsabilidad de escritura pertenece a `reservation-service`: mediante llamadas HTTP o mediante consultas directas a las tablas.

## Decisión

Nosotros optamos por que `transportation-service` consulte directamente las tablas `vehicles` y `zones` en la base de datos compartida, sin realizar llamadas HTTP a `reservation-service`. Esto aplica exclusivamente a operaciones de lectura y sólo sobre los campos mínimos necesarios (`SELECT id FROM vehicles`, `SELECT id, name, polygon FROM zones WHERE type='red'`).

## Justificación

Las llamadas HTTP inter-servicio en el camino de ingesta GPS introducen latencia adicional y un punto de falla: si `reservation-service` está caído o lento, el endpoint de ingesta falla también, aunque el problema no tenga relación con la señal GPS. La ingesta es una operación de alta frecuencia y cualquier dependencia síncrona extra en ese path aumenta el riesgo.

El acceso directo a la BD es posible sin violar el principio de responsabilidad porque en este contexto no se modifica ni se crea datos del dominio ajeno: `transportation-service` sólo lee. La tabla `zones` en particular fue diseñada parcialmente para ser consumida por otros servicios del stack (el CLAUDE.md lo anticipa explicitamente: "GET /zones is public so F15 geofencing can consume it").

La alternativa de HTTP fue descartada por el costo en el hot path. Una alternativa intermedia sería cachear los datos de zonas en memoria, lo que reduciría las consultas repetidas, pero añade complejidad de invalidación de caché que no está justificada en esta etapa.

El riesgo principal de esta decisión es el acoplamiento estructural: si `reservation-service` cambia el esquema de `vehicles` o `zones`, `transportation-service` se rompe silenciosamente. Este riesgo se acepta porque ambos servicios están en el mismo repositorio y el mismo equipo, lo que hace el cambio coordinado.

## Estado

Aceptado.

## Consecuencias

1. La validación de vehículos y la detección de geofence son rápidas: una sola query a la BD local, sin round-trip HTTP.
2. No hay dependencia de disponibilidad de `reservation-service` en el path de ingesta GPS.
3. Existe acoplamiento implícito al esquema de tablas ajenas (`vehicles.id`, `zones.type`, `zones.active`, `zones.polygon`).
4. Cualquier cambio en esas columnas requiere coordinación explícita entre módulos.
5. La estrategia no es aplicable si en el futuro los servicios migran a bases de datos separadas.
