# ADR 015: Patrón en capas dentro de cada servicio

Cada servicio de la plataforma MOVE (`api-gateway`, `reservation-service`, `transportation-service` y `categorizer-service`) concentra varias responsabilidades dentro de un mismo proceso: recepción y validación de requests HTTP, aplicación de reglas de negocio, acceso a la base de datos y comunicación con dependencias externas. Sin una organización interna consistente, esas responsabilidades tienden a mezclarse en archivos únicos, lo que dificulta la comprensión, las pruebas y la evolución del código. La arquitectura basada en servicios (ADR-001) define la separación entre servicios, pero no prescribe cómo debe estructurarse el código dentro de cada uno. El equipo necesitaba un criterio común de organización interna que fuera predecible entre módulos y entre servicios, facilitara el trabajo paralelo y permitiera probar la lógica de negocio en aislamiento de los detalles de transporte y persistencia.

## Decisión

Se adoptará el patrón arquitectónico en capas (_layered_) como estructura interna de cada servicio, organizado por módulo de dominio. Cada módulo ubicado en `src/modules/<dominio>/` se descompondrá en capas con responsabilidades separadas:

1. **Capa de enrutamiento (`router.ts`)**: declara las rutas HTTP del módulo y asocia cada una a su manejador, aplicando los middlewares correspondientes.
2. **Capa de presentación/controlador (`controller.ts`)**: traduce el request HTTP (parámetros, cuerpo, headers) hacia llamadas de negocio y construye la respuesta HTTP, sin contener reglas de dominio.
3. **Capa de servicio/dominio (`service.ts` y archivos asociados como `quote-service.ts`, `helpers/`)**: concentra las reglas de negocio y orquesta la operación, sin conocer detalles de Express.
4. **Capa de acceso a datos e integraciones (modelos Sequelize en `src/db/models/`, `ports/` y `adapters/`)**: encapsula la persistencia y la comunicación con dependencias externas detrás de interfaces consumidas por la capa de servicio.

La dependencia entre capas será unidireccional: el enrutamiento depende del controlador, el controlador depende del servicio, y el servicio depende de las abstracciones de datos e integraciones, nunca a la inversa.

## Justificación

El patrón en capas fue elegido porque separa preocupaciones técnicamente distintas (transporte HTTP, lógica de negocio, persistencia) en unidades con una única responsabilidad, lo que impacta positivamente en **modificabilidad** y **testabilidad**: la lógica de negocio puede probarse sin levantar un servidor HTTP ni una base de datos, y un cambio en la capa de presentación no obliga a tocar las reglas de dominio. La consistencia de la estructura entre los cuatro servicios reduce la carga cognitiva del equipo y favorece el trabajo paralelo, ya que cualquier integrante encuentra el mismo esqueleto en cualquier módulo.

La organización por módulo de dominio dentro del patrón en capas evita el acoplamiento horizontal entre dominios no relacionados y se alinea con la separación por dominios establecida en ADR-001. El uso de `ports/` y `adapters/` para las integraciones externas (ver ADR-008 para pagos) es coherente con esta estructura: la capa de servicio depende de un puerto y no de la implementación concreta, lo que refuerza la inversión de dependencias hacia los detalles de infraestructura.

**Alternativas consideradas y rechazadas:**

- **Organización técnica horizontal (todos los controllers juntos, todos los services juntos)**: descartada porque dispersa un mismo dominio en múltiples carpetas, dificultando localizar y modificar una funcionalidad completa y favoreciendo el acoplamiento entre dominios.
- **Código sin capas explícitas (lógica de negocio dentro de los handlers de ruta)**: descartada porque mezcla validación HTTP, reglas de negocio y acceso a datos en un mismo punto, lo que degrada la testabilidad y vuelve frágil la evolución del código.
- **Arquitectura hexagonal estricta en todos los módulos**: descartada por sobredimensionamiento para el alcance del proyecto; se adopta su idea de puertos y adapters solo donde aporta valor concreto (integraciones externas), sin imponer su ceremonia completa en cada módulo CRUD.

## Estado

Aceptado

Esta decisión formaliza una estructura ya vigente en el código y documentada en `docs/reports/vista-layered.md`.

## Consecuencias

**Positivas:**

- Se separa la lógica de negocio de los detalles de transporte HTTP y persistencia, mejorando la testabilidad de cada capa en aislamiento.
- Se obtiene una estructura predecible y homogénea entre módulos y servicios, lo que facilita el trabajo paralelo y la incorporación de nuevos integrantes.
- Se reduce el acoplamiento entre dominios al organizar el código por módulo de negocio.
- Se favorece la modificabilidad: cambios en una capa quedan acotados y no se propagan a las demás mientras se respeten los contratos.

**Negativas:**

- Se introduce mayor cantidad de archivos por funcionalidad (router, controller, service), lo que agrega ceremonia para operaciones simples.
- La disciplina de mantener la dependencia unidireccional entre capas debe sostenerse mediante revisión, ya que el lenguaje no la impone por sí mismo.

**Riesgos:**

- Si la separación de capas no se respeta (por ejemplo, reglas de negocio filtradas hacia el controlador o consultas SQL en la capa de presentación), se pierden los beneficios de testabilidad y modificabilidad sin que el sistema lo señale automáticamente. Se mitiga mediante revisión de código y convenciones documentadas.
