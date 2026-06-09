# ADR 002: Auth0 como proveedor de identidad federada externo

La plataforma necesita autenticar usuarios, emitir y validar credenciales, administrar identidades y sostener un nivel razonable de seguridad sin desviar el esfuerzo principal del proyecto hacia la construcción de un sistema de identidad propio. El sistema también requiere una frontera clara entre autenticación y autorización: la primera debe resolverse mediante un proveedor especializado, mientras que la segunda debe permanecer bajo control del dominio de negocio. Influyeron además restricciones de tiempo, costo operativo y riesgo técnico, ya que implementar autenticación segura desde cero implica gestionar contraseñas, recuperación de acceso, rotación de claves, endurecimiento de endpoints y controles de seguridad que no forman parte del valor principal del proyecto.

La implementación actual ya refleja estas necesidades. El `api-gateway` valida tokens JWT firmados con RS256 contra las claves públicas publicadas por Auth0 mediante JWKS, y luego propaga hacia los servicios internos únicamente el contexto autenticado mínimo necesario. Por su parte, `reservation-service` mantiene un registro local de usuario asociado al `authSubject` externo para aplicar autorización, estados y reglas de negocio sin almacenar credenciales. Esta separación muestra que la decisión no es solamente adoptar un proveedor externo, sino también utilizar un esquema de identidad federada.

## Decisión

Se utilizará Auth0 como proveedor externo de identidad federada para la autenticación de usuarios de la plataforma.

Se delegará en Auth0 la gestión de identidades, la custodia de credenciales y la emisión de tokens de acceso. La validación criptográfica de dichos tokens se realizará en el `api-gateway`, utilizando JWT firmados con RS256 y resolución de claves públicas mediante JWKS.

Los servicios internos no validarán directamente el token emitido por el proveedor ni administrarán credenciales de usuario. En su lugar, consumirán el contexto autenticado propagado por el `api-gateway` y mantendrán en la base local únicamente la información necesaria para autorización, estado del usuario y reglas de negocio.

## Justificación

Auth0 fue elegido porque permite adoptar un esquema estándar de identidad federada con una integración relativamente rápida y una carga operativa baja para el equipo. Esta decisión reduce la necesidad de implementar capacidades sensibles de seguridad dentro del sistema y permite apoyarse en un proveedor especializado para autenticación, emisión de tokens y administración del ciclo de vida de credenciales.

El enfoque de identidad federada aporta beneficios relevantes. En primer lugar, evita almacenar contraseñas dentro de la plataforma, lo que reduce la superficie de ataque y la responsabilidad operativa asociada a secretos sensibles. En segundo lugar, centraliza la validación de identidad en el borde del sistema, desacoplando a los servicios internos de detalles específicos del proveedor. En tercer lugar, preserva una separación clara entre autenticación externa y autorización interna: Auth0 afirma la identidad del usuario, mientras que el sistema decide localmente qué puede hacer ese usuario según su rol, estado y relación con el dominio.

La arquitectura implementada confirma esta decisión. El `api-gateway` consulta JWKS de Auth0, verifica `issuer`, `audience` y firma del token antes de aceptar la solicitud, y luego propaga el `sub` autenticado hacia los servicios internos. A su vez, el servicio de reservas crea identidades mediante la Management API y persiste un usuario local con `authSubject`, lo que permite aplicar reglas de negocio sin custodiar credenciales. Esto impacta positivamente en los atributos de seguridad, integrabilidad, mantenibilidad y modificabilidad.

**Alternativas consideradas y rechazadas:**
- **Autenticación propia dentro de la plataforma**: descartada porque incrementa el riesgo de errores de seguridad y obliga a implementar almacenamiento de contraseñas, recuperación de acceso, rotación de claves, validación de credenciales y endurecimiento adicional de endpoints, con alto costo para el alcance del proyecto.
- **Uso de Keycloak u otro IdP autogestionado**: descartado en esta etapa por su mayor costo operativo y de administración de infraestructura respecto de una solución gestionada, dado que el equipo prioriza velocidad de entrega y menor carga de operación.
- **Validación del token en cada servicio interno**: descartada porque duplica lógica transversal, aumenta el acoplamiento de múltiples servicios al proveedor de identidad y debilita el patrón de `api-gateway` como punto unificado de autenticación.

## Estado

Aceptado

## Consecuencias

**Positivas:**
- Se reduce significativamente el esfuerzo de implementar y mantener autenticación segura dentro del sistema.
- Se evita custodiar contraseñas y otros secretos de autenticación en la plataforma.
- Se adopta un esquema de identidad federada basado en estándares ampliamente usados, lo que mejora integrabilidad y claridad arquitectónica.
- Se centraliza la validación de identidad en el `api-gateway`, evitando duplicación de lógica en servicios internos.
- Se mantiene una separación explícita entre identidad externa y autorización interna, facilitando la evolución del dominio sin acoplarlo al proveedor.
- Se habilita una mejor base para incorporar capacidades futuras del proveedor, como MFA o variantes de login, sin reescribir la lógica de negocio.

**Negativas:**
- Se introduce dependencia externa de disponibilidad, costos, políticas y contratos técnicos de Auth0.
- Se genera cierto vendor lock-in en la capa de infraestructura de identidad.
- El `api-gateway` se vuelve un punto crítico para la autenticación, ya que concentra la validación de tokens y la propagación del contexto autenticado.
- La integración requiere coordinación entre identidad externa y registro local de usuarios para evitar inconsistencias.

**Riesgos:**
- Si Auth0 o la resolución de JWKS no están disponibles, la autenticación puede degradarse o quedar temporalmente indisponible.
- Cambios en configuración de `issuer`, `audience`, claves o credenciales de Management API pueden interrumpir el flujo de autenticación y registro.
- Si la frontera entre identidad externa y autorización interna no se mantiene clara, pueden aparecer acoplamientos indebidos entre el dominio y el proveedor de identidad.
