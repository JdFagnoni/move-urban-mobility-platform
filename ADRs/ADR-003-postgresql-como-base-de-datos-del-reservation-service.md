# ADR 003: PostgreSQL como base de datos del reservation-service

El dominio de reservas maneja entidades relacionadas entre sí, como usuarios, reservas, categorías y carga asociada. Ese dominio requiere consistencia transaccional, consultas flexibles, validaciones relacionales y una estructura que favorezca integridad de datos. También influyeron costos y pragmatismo: el equipo necesitaba una tecnología madura, conocida y fácil de ejecutar localmente con Docker. A su vez, el tiempo disponible desaconsejaba introducir tecnologías de persistencia con una curva de aprendizaje u operación mayor.

## Decisión

Nosotros utilizaremos PostgreSQL como base de datos principal del `reservation-service`. Nosotros modelaremos las entidades del dominio con un esquema relacional y accederemos a los datos mediante Sequelize y modelos tipados en TypeScript. Nosotros utilizaremos transacciones cuando una operación de negocio deba afectar varias tablas de forma consistente.

## Justificación

PostgreSQL encaja bien con el dominio porque las reservas y sus datos asociados tienen relaciones explícitas y reglas de integridad que son más naturales en un modelo relacional. La implementación actual ya utiliza `sequelize-typescript`, modelos relacionales y transacciones en operaciones de reserva, lo cual confirma que la consistencia de escritura es un requisito real y no hipotético.

La alternativa de usar una base NoSQL documental fue rechazada porque simplifica algunos casos de escritura flexible, pero complica consultas relacionales, consistencia y evolución controlada de entidades conectadas. También se descartó persistir con soluciones ad hoc o archivos, porque no cumplen con requisitos mínimos de concurrencia, consulta ni durabilidad para este dominio.

Se asume que el volumen inicial de datos y tráfico puede ser absorbido por una única instancia PostgreSQL. También se acepta que futuras necesidades de escalado podrán requerir tuning, índices, particionamiento o estrategias complementarias.

## Estado

Aceptado.

## Consecuencias

1. Se obtiene consistencia fuerte y un modelo natural para relaciones entre entidades del dominio.
2. Se facilita el uso de transacciones y restricciones de integridad.
3. Se aprovecha una tecnología madura, ampliamente soportada y simple de correr en desarrollo.
4. Se introduce la necesidad de administrar esquema, migraciones y evolución relacional con cuidado.
5. El escalado horizontal de escrituras no es tan directo como en algunas alternativas NoSQL.
6. Las decisiones de modelado inicial pueden impactar más en cambios futuros si no se gobiernan bien.
