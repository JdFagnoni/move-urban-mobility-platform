# ADR 005: API Gateway como punto de entrada único

La solución expone varios servicios internos, pero no resulta conveniente que los clientes externos conozcan sus direcciones, contratos particulares, políticas de seguridad ni detalles de integración de cada uno. El sistema necesita una frontera de entrada unificada que reduzca complejidad para los consumidores y concentre preocupaciones transversales de borde. Entre esas preocupaciones se encuentran la validación de identidad, el rate limiting, el logging de requests y el control de qué rutas deben permanecer públicas y cuáles requieren autenticación.

La implementación actual ya evidencia además una segunda necesidad: algunos servicios internos requieren recibir contexto autenticado derivado de la identidad validada en el borde, mientras que otros sólo necesitan quedar protegidos detrás del gateway sin manejar directamente el token del cliente. También existen rutas especiales, como el webhook de Stripe, que deben atravesar el gateway sin alterar el cuerpo original del request. Estas condiciones hacen que el gateway no sea sólo un reverse proxy, sino un componente de borde con responsabilidades explícitas de seguridad y enrutamiento.

## Decisión

Se utilizará un `api-gateway` como punto de entrada único para las solicitudes externas del sistema.

El `api-gateway` concentrará la validación de tokens de acceso, el logging de requests, el rate limiting y el enrutamiento hacia los servicios internos correspondientes. También definirá, en un único punto, qué rutas serán públicas, cuáles serán protegidas y qué casos particulares requerirán tratamiento especial de proxy.

Cuando un servicio interno requiera contexto autenticado para aplicar autorización o reglas de negocio, el `api-gateway` propagará únicamente la identidad validada y los headers internos necesarios para establecer una relación de confianza controlada. Cuando el servicio sólo necesite quedar protegido de acceso externo directo, el gateway actuará como frontera autenticada sin trasladar el token original al servicio.

## Justificación

La adopción de un `api-gateway` simplifica el consumo externo del sistema al ofrecer una única puerta de entrada, estable y consistente, en lugar de exponer múltiples servicios con contratos y responsabilidades de seguridad dispersos. Esta decisión mejora la integrabilidad y reduce la complejidad para clientes, pruebas manuales y automatización.

La implementación actual confirma esta decisión. El gateway aplica `requestLogger` y `rateLimiter` de forma centralizada, valida tokens JWT antes de acceder a rutas protegidas y proxya solicitudes hacia `reservation-service` y `transportation-service`. En el caso de `reservation-service`, además propaga el `authSubject` autenticado y un secreto interno compartido para que el servicio pueda confiar en el contexto reenviado y aplicar autorización local. En el caso del webhook de Stripe, el gateway reenvía el request antes del `JSON parser` para preservar el cuerpo original requerido por la validación de firma. Esto demuestra que el gateway encapsula políticas de borde que no deberían replicarse en cada servicio.

La alternativa de exponer cada microservicio directamente a clientes externos fue descartada porque obligaría a duplicar autenticación, observabilidad, rate limiting y control de frontera en múltiples puntos. Esto aumentaría el riesgo de inconsistencias, ampliaría la superficie de ataque y dificultaría mantener una experiencia uniforme de consumo. También se descartó, en esta etapa, una solución más sofisticada basada en service mesh o una plataforma completa de API management, porque su costo operativo y conceptual no está justificado para el tamaño actual del sistema.

**Suposición**: Se asume que la red interna entre el gateway y los servicios es de confianza controlada, y que los headers internos propagados por el gateway no serán aceptados desde fuentes no confiables. También se asume que el gateway operará como componente crítico de borde y contará con la configuración necesaria para distinguir correctamente rutas públicas, protegidas y de integración externa.

## Enmienda: detalle de implementación del rate limiting (R8)

El rate limiting mencionado entre las responsabilidades del gateway se concreta con la biblioteca `express-rate-limit`, aplicada como middleware global (`app.use(rateLimiter)`) sobre todas las solicitudes entrantes. La configuración vigente utiliza una ventana de 1 minuto con un máximo de 300 solicitudes por ventana, devuelve `429 Too Many Requests` ante exceso y expone los headers estándar de límite (`standardHeaders`) para que los clientes puedan adaptar su ritmo.

Es importante delimitar el rol de este mecanismo respecto del requisito R8 (soportar picos de hasta 50 veces la carga normal). El rate limiter del gateway **no** es el componente que absorbe la ráfaga de R8; su función es actuar como techo de protección contra abuso y tráfico anómalo en el borde, evitando que un cliente individual sature el sistema. La capacidad de absorber picos de carga legítima se resuelve aguas adentro mediante el desacople asíncrono y el buffering de colas de RabbitMQ (ADR-010), que sacan el trabajo pesado del path de request y amortiguan las ráfagas, y mediante el fast-path en caché para los flujos de baja latencia (ADR-012). El límite global se eligió como valor de protección de borde y se considera un parámetro ajustable con evidencia de las pruebas de carga y stress (K6), no como una garantía por sí mismo del cumplimiento de R8.

Se consideró y descartó, por ahora, un rate limiting distribuido respaldado en Redis (que permitiría un límite coherente entre múltiples instancias del gateway) por no estar justificado para el despliegue actual de instancia única; se señala como evolución futura si el gateway se escala horizontalmente. También se descartó delegar el rate limiting a un componente de infraestructura externo (por ejemplo, Nginx o un API management), por mantener la política de borde dentro del gateway, coherente con el resto de las responsabilidades transversales ya centralizadas en él.

## Estado

Aceptado

## Consecuencias

**Positivas:**

- Se simplifica la integración externa mediante una única puerta de entrada.
- Se centralizan autenticación, logging, rate limiting y otras políticas transversales de borde.
- Se reduce la duplicación de lógica de seguridad y observabilidad en servicios internos.
- Se preserva una frontera clara entre clientes externos y la red interna de servicios.
- Se facilita la propagación controlada de identidad sólo a los servicios que realmente la necesitan.
- Se mejora la mantenibilidad al concentrar reglas de exposición de rutas en un único componente.

**Negativas:**

- El gateway se convierte en un punto crítico cuya falla afecta gran parte del sistema.
- Se agrega un salto de red adicional y, por lo tanto, cierta latencia en las solicitudes.
- Se concentra complejidad operativa en el componente de borde, especialmente al manejar rutas públicas, protegidas y casos especiales como webhooks.
- Un error de configuración en el gateway puede bloquear rutas válidas o exponer rutas que debían permanecer protegidas.

**Riesgos:**

- Si la frontera interna no se protege adecuadamente, la identidad propagada podría ser falsificada o utilizada fuera del contexto previsto.
- Si el gateway no preserva correctamente requests especiales, como webhooks firmados, ciertas integraciones externas pueden fallar aun cuando los servicios internos estén correctos.
- La centralización de autenticación y políticas de borde exige mayor cuidado en cambios futuros, porque cualquier regresión impacta a múltiples flujos del sistema.
