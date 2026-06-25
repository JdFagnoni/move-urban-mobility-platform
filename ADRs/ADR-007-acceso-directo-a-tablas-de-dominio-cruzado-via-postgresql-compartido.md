# ADR 007: Acceso directo de lectura a tablas de dominio cruzado vía PostgreSQL compartido

El `transportation-service`, durante la detección asíncrona de alertas (ADR-006, ADR-010), necesita conocer el comportamiento configurado de las categorías de carga asociadas a un viaje en curso para decidir si una señal debe generar o no una alerta. Esa información reside en la tabla `categories`, cuya responsabilidad de escritura pertenece al dominio de `reservation-service` (que mantiene el modelo `category` y expone la administración de categorías). Dado que la plataforma adopta una arquitectura basada en servicios con base de datos compartida (ADR-001, ADR-003), ambos servicios acceden a la misma instancia PostgreSQL. La pregunta no es si pueden compartir la base de datos, sino cómo debe `transportation-service` acceder a datos cuya escritura pertenece a otro dominio: mediante una llamada HTTP síncrona a `reservation-service` o mediante una consulta directa de solo lectura a la tabla.

Cabe aclarar el alcance de esta decisión a partir de la evolución del sistema. Las tablas `vehicles` y `zones`, que en una etapa anterior eran candidatas a acceso cruzado, fueron migradas al dominio de `transportation-service` (ver `docs/reports/plan-migrate-vehicles-zones.md`): hoy ese servicio es dueño de ambas y las gestiona mediante sus propios modelos Sequelize (`VehicleModel`, `ZoneModel`), por lo que ya no constituyen acceso de dominio cruzado. El caso de dominio cruzado que efectivamente persiste es la lectura de `categories`.

## Decisión

Se optará por que el `transportation-service` consulte directamente la tabla `categories` en la base de datos compartida, sin realizar una llamada HTTP a `reservation-service`, en el camino de detección de alertas. Esto aplicará **exclusivamente a operaciones de lectura** y sólo sobre los campos mínimos necesarios:

```
SELECT behavior FROM categories WHERE id = ANY($1::uuid[])
```

La consulta se utilizará para resolver, a partir de la configuración `behavior.generatesAlerts` de las categorías de un viaje, si corresponde emitir la alerta. Ante ausencia de información o error de consulta, la detección adoptará un comportamiento _fail-open_ (preferir generar la alerta antes que perderla silenciosamente), coherente con el requisito de resiliencia R7. La escritura y administración de `categories` permanecerá como responsabilidad exclusiva de `reservation-service`.

## Justificación

Una llamada HTTP inter-servicio en el camino de detección de alertas introduciría latencia adicional y un punto de falla: si `reservation-service` está caído o lento, la detección —que corre de forma asíncrona sobre cada señal GPS— se vería afectada por un dominio que no es el suyo. El acceso directo de solo lectura evita esa dependencia síncrona y mantiene la detección rápida y aislada (bulkhead, ADR-013).

El acceso directo a la base es admisible sin violar el principio de responsabilidad porque en este contexto no se modifica ni se crea dato del dominio ajeno: `transportation-service` sólo lee la configuración de comportamiento de las categorías. La fuente de verdad y la escritura siguen siendo exclusivas de `reservation-service`.

**Alternativas consideradas y rechazadas:**

- **Llamada HTTP síncrona a `reservation-service`**: descartada por el costo en latencia y por introducir una dependencia de disponibilidad de otro servicio en el camino de detección de alertas, contraria al aislamiento buscado en R7.
- **Replicar o cachear las categorías en `transportation-service`**: descartada por ahora, ya que añade complejidad de invalidación de caché y de sincronización de datos que no se justifica para el volumen actual; el acceso directo a la tabla compartida es suficiente.
- **Publicar la configuración de categorías por evento hacia `transportation-service`**: descartada por sobredimensionamiento para una lectura puntual y poco frecuente; la mensajería (ADR-010) se reserva para flujos genuinamente asíncronos de trabajo, no para replicar datos de referencia.

El riesgo principal de esta decisión es el acoplamiento estructural: si `reservation-service` cambia el esquema de `categories` (en particular la columna `behavior` o su estructura `generatesAlerts`), la detección de `transportation-service` podría romperse. Este riesgo se acepta porque ambos servicios están en el mismo repositorio y el mismo equipo, lo que permite coordinar el cambio, y se mitiga con el comportamiento _fail-open_ ante error de consulta.

## Estado

Reemplazado por ADR-018.

El equipo revirtió esta decisión: el acceso de dominio cruzado dejó de hacerse por consulta directa a la base compartida y pasó a realizarse mediante HTTP al servicio dueño (ver ADR-018). En particular, la lectura de `categories` desde `transportation-service` se migró a una llamada `GET /categories` a `reservation-service`. Se conserva este documento como historia de la decisión original.

Nota histórica: las tablas `vehicles` y `zones` dejaron de ser acceso de dominio cruzado tras su migración al dominio de `transportation-service`; el último caso vigente bajo esta decisión era la lectura de `categories`, hoy también migrada a HTTP.

## Consecuencias

1. La detección de alertas resuelve el comportamiento de categorías con una sola consulta a la base local, sin round-trip HTTP, manteniéndose rápida.
2. No hay dependencia de disponibilidad de `reservation-service` en el camino de detección de alertas.
3. Existe acoplamiento implícito al esquema de una tabla de otro dominio (`categories.behavior`, `categories.id`).
4. Cualquier cambio en esas columnas requiere coordinación explícita entre módulos, ya que no hay un contrato HTTP que medie el cambio.
5. El comportamiento _fail-open_ ante error reduce el impacto de una indisponibilidad o un cambio incompatible, a costa de poder generar alguna alerta de más.
6. La estrategia no sería aplicable si en el futuro los servicios migraran a bases de datos separadas, en cuyo caso debería sustituirse por un contrato explícito (HTTP o mensajería).
