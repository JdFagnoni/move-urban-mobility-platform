# ADR 017: Autenticación interna servicio a servicio mediante token compartido

La plataforma valida la identidad de los clientes externos en el borde, en el `api-gateway`, mediante tokens JWT de Auth0 (ADR-002, ADR-005), y propaga hacia los servicios internos únicamente el contexto autenticado mínimo a través del header `x-auth-subject`. Esto plantea un problema de confianza: si un servicio interno como `reservation-service` acepta el header `x-auth-subject` sin más verificación, cualquier emisor capaz de alcanzar el servicio podría suplantar a un usuario simplemente enviando ese header. La red interna se asume de confianza controlada (ADR-005), pero esa suposición necesita un mecanismo concreto que la haga efectiva. A su vez, no todo el tráfico interno proviene del gateway: `transportation-service` también invoca directamente a `reservation-service` (por ejemplo, en su cliente HTTP interno), por lo que el mecanismo de confianza debe cubrir tanto el flujo gateway→servicio como el flujo servicio→servicio. La solución debía ser simple, verificable y proporcional al alcance del proyecto, sin introducir una infraestructura de identidad de servicios completa.

## Decisión

Se adoptará un esquema de autenticación interna servicio a servicio basado en un secreto compartido propagado mediante el header HTTP `x-internal-gateway-secret`.

- El secreto se configurará por ambiente en la variable de entorno `INTERNAL_GATEWAY_SECRET`, común a los emisores y receptores de tráfico interno de confianza.
- Todo emisor de tráfico interno hacia rutas protegidas de un servicio (el `api-gateway` al proxyar rutas de `reservation-service`, y `transportation-service` al invocar a `reservation-service`) adjuntará el header `x-internal-gateway-secret` con el valor del secreto, junto con el contexto autenticado (`x-auth-subject`) cuando corresponda.
- El servicio receptor validará el header mediante un middleware (`requireInternalGatewaySecret`): si el secreto no está configurado, responderá `503 Service Unavailable`; si el header está ausente o no coincide, responderá `401 Unauthorized`; solo si coincide, procesará el request y confiará en el `x-auth-subject` propagado.
- La lógica de validación se centralizará en `@move/shared` (`shared/auth/middleware.ts`) para evitar reimplementaciones divergentes entre servicios.

## Justificación

El token compartido fue elegido porque resuelve el problema de confianza de la red interna con un mecanismo simple, explícito y verificable: un servicio interno solo acepta el contexto autenticado (`x-auth-subject`) si el request demuestra provenir de un emisor de confianza que conoce el secreto. Esto impacta directamente en el atributo de **seguridad**, al cerrar la posibilidad de que un actor que alcance la red interna suplante usuarios falsificando el header de identidad. La centralización de la validación en `@move/shared` favorece la **modificabilidad** y reduce el riesgo de inconsistencias entre servicios.

La distinción de respuestas (`503` ante secreto no configurado, `401` ante secreto inválido) hace el comportamiento predecible y diagnosticable: un despliegue mal configurado falla de forma evidente en lugar de aceptar tráfico no autenticado de manera silenciosa, lo que aporta también a la **disponibilidad** operativa y a la testabilidad.

El esquema es deliberadamente proporcional al alcance del obligatorio. La frontera real de autenticación de usuarios sigue estando en el `api-gateway` con Auth0 (ADR-002, ADR-005); este ADR cubre exclusivamente la confianza entre componentes internos, no la identidad de los usuarios finales.

**Alternativas consideradas y rechazadas:**

- **No validar nada en los servicios internos y confiar exclusivamente en la topología de red**: descartada. Esta opción consistía en asumir que, dado que el `api-gateway` es el único punto de entrada (ADR-005), los servicios detrás de él podían aceptar cualquier request sin verificación, confiando ciegamente en que todo el tráfico interno es legítimo. Se rechazó porque es una única línea de defensa frágil: cualquier error de configuración de red, un servicio expuesto por accidente o un actor que logre posicionarse dentro de la red interna podría invocar directamente a los servicios y suplantar usuarios mediante `x-auth-subject`, sin que exista control alguno. Validar el secreto compartido agrega una segunda barrera (defensa en profundidad) sin un costo significativo.
- **Confiar en `x-auth-subject` sin verificación adicional**: descartada porque permitiría la suplantación de identidad a cualquier emisor que alcance el servicio interno, anulando la garantía de autenticación del borde.
- **mTLS (TLS mutuo) entre servicios**: descartado por sobredimensionamiento para el alcance actual. Requiere emisión y rotación de certificados por servicio y gestión de una autoridad certificadora interna, complejidad operativa no justificada para el despliegue en Docker Compose de red interna controlada.
- **JWT internos firmados emitidos por el gateway para cada servicio**: descartado por agregar gestión de claves, expiración y validación de firma por servicio, sin beneficio claro frente al secreto compartido dado que la red interna ya se asume de confianza controlada. Se reconoce como evolución futura si el número de servicios o el modelo de amenaza crecen.

**Suposición**: Se asume que la red interna entre el gateway y los servicios, y entre los servicios entre sí, es de confianza controlada y no está expuesta públicamente, y que el secreto `INTERNAL_GATEWAY_SECRET` se gestiona como credencial sensible por ambiente.

## Estado

Aceptado

Complementa a ADR-005 (API Gateway como punto de entrada único), que ya mencionaba la propagación de un secreto interno; este ADR documenta de forma explícita el mecanismo de confianza servicio a servicio.

## Consecuencias

**Positivas:**

- Se impide la suplantación de identidad por parte de emisores que no conozcan el secreto, reforzando la garantía de autenticación establecida en el borde.
- El mecanismo es simple de implementar, entender y defender, y se aplica de forma uniforme tanto al flujo gateway→servicio como servicio→servicio.
- La centralización de la validación en `@move/shared` evita lógica duplicada y divergente entre servicios.
- El comportamiento ante errores de configuración es explícito (`503`) y diferenciado del rechazo por secreto inválido (`401`), facilitando el diagnóstico.

**Negativas:**

- Se introduce un secreto compartido que debe configurarse, distribuirse y rotarse de forma coordinada entre todos los componentes internos.
- El esquema otorga una confianza binaria: cualquier componente que posea el secreto es plenamente confiable, sin granularidad de permisos por servicio.
- La seguridad depende de que la red interna permanezca efectivamente aislada del exterior.

**Riesgos:**

- Si el secreto se filtra o se versiona por error en el repositorio, un atacante podría falsificar tráfico interno de confianza. Se mitiga gestionándolo como variable de entorno sensible por ambiente, fuera del control de versiones.
- Una rotación del secreto mal coordinada puede dejar a un servicio rechazando tráfico legítimo (`401`) o sin secreto configurado (`503`). Se mitiga desplegando el cambio de forma coordinada entre emisores y receptores.
- La confianza binaria implica que el compromiso de un único componente interno con el secreto compromete la frontera interna completa; se acepta para el alcance actual y se señala mTLS o JWT internos como evolución futura.
