# ADR 002: Auth0 como proveedor de autenticación externo

La plataforma necesita autenticar usuarios, emitir y validar credenciales, administrar identidades y sostener un nivel razonable de seguridad sin desviar el esfuerzo principal del proyecto hacia la construcción de un sistema de identidad propio. Influyeron aspectos tecnológicos y de costo: implementar autenticación segura desde cero es riesgoso, requiere experiencia específica y aumenta significativamente el tiempo de desarrollo, mantenimiento y auditoría. También era necesario integrarse con tokens estándar y delegar la gestión de credenciales sensibles.

## Decisión

Nosotros utilizaremos Auth0 como proveedor de autenticación externo para el sistema. Nosotros delegaremos en Auth0 la creación de identidades y la emisión de credenciales, y validaremos los tokens de acceso en nuestros servicios mediante JWT firmados con RS256. Nosotros mantendremos en nuestra base local únicamente la información de usuario necesaria para las reglas de negocio y autorización interna.

## Justificación

Auth0 permite adoptar un flujo estándar de identidad con una integración relativamente rápida y una carga operativa baja para el equipo. En la implementación actual ya existe validación de JWKS en el `api-gateway` y creación de usuarios a través de la Management API desde `reservation-service`, lo cual confirma que esta decisión ya condiciona la arquitectura.

La alternativa de desarrollar autenticación propia fue rechazada porque incrementa el riesgo de errores de seguridad, exige manejar contraseñas, recuperación de acceso, rotación de claves y controles adicionales que no aportan valor diferencial al proyecto. La alternativa de usar Keycloak también fue considerada conceptualmente, pero fue descartada en esta etapa por su mayor costo operativo y de administración para un equipo que prioriza velocidad de entrega y menor carga de infraestructura.

Se asume que la dependencia de un tercero es aceptable para el alcance actual y que el entorno de despliegue tendrá conectividad con Auth0. También se acepta una dependencia contractual y técnica con las APIs y políticas del proveedor.

## Estado

Aceptado.

## Consecuencias

1. Se reduce el esfuerzo de implementar y mantener autenticación segura internamente.
2. Se acelera la entrega de funcionalidades que dependen de registro e inicio de sesión.
3. Se adoptan estándares ampliamente usados para validación de tokens y federación de identidad.
4. Se introduce dependencia externa de disponibilidad, costos y políticas de Auth0.
5. Se genera cierto vendor lock-in, porque la integración no es completamente neutral frente al proveedor.
6. Se requiere diseñar claramente la frontera entre identidad externa y autorización interna del sistema.
