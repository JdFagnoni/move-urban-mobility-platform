# ADR 008: Integración de pagos con Stripe mediante adapter y webhook asíncrono

El sistema de reservas requiere permitir la confirmación de pagos asociados a una reserva una vez que ésta alcanza el estado `pending_confirmation`. Esta capacidad introduce una dependencia externa crítica, ya que el procesamiento monetario no se resuelve dentro del sistema sino a través de un proveedor especializado. La solución debía contemplar integrabilidad con un PSP real, trazabilidad del intento de pago, validación de autenticidad de eventos externos y una transición consistente del estado de la reserva hacia `confirmed` sólo cuando el proveedor informe el resultado definitivo.

La implementación actual muestra además restricciones concretas del dominio y de la plataforma. El flujo de confirmación es iniciado por un cliente autenticado sobre una reserva propia, genera un registro de pago interno y devuelve `202 Accepted`, mientras que la resolución final del pago se recibe mediante un webhook firmado por Stripe. Esto obliga a modelar un flujo asincrónico con consistencia eventual entre el estado del pago y el estado de la reserva. También existía la necesidad de evitar acoplar la lógica del dominio de reservas a detalles específicos de la API de Stripe, preservando modificabilidad y testabilidad.

## Decisión

Se utilizará Stripe como proveedor externo de pagos para la confirmación de reservas. Se implementará un adapter dedicado que encapsulará la integración HTTP con Stripe detrás de un puerto interno de pagos, de modo que el dominio de reservas dependa de una abstracción y no de la API concreta del proveedor.

Se adoptará un flujo híbrido de procesamiento: la solicitud de confirmación de pago iniciará un `payment_intent`, persistirá un registro interno de pago en estado `pending` y responderá de forma asincrónica al cliente. La confirmación definitiva del resultado se realizará mediante un webhook firmado por Stripe, cuyo procesamiento actualizará el estado del pago y, cuando corresponda, promoverá la reserva al estado `confirmed`.

Se validará la autenticidad del webhook mediante firma HMAC provista por Stripe y se registrará el identificador de evento para evitar reprocesamientos duplicados. El sistema hará uso de claves de idempotencia cuando sean provistas por el cliente para reducir el riesgo de duplicación de intentos en la llamada al proveedor.

## Justificación

Stripe fue elegido porque resuelve una capacidad especializada que el sistema no debería implementar por cuenta propia: procesamiento de pagos con tarjeta, manejo de `payment_intents` y notificación del resultado final mediante eventos. Esta decisión favorece el atributo de integrabilidad, ya que permite incorporar un PSP ampliamente adoptado usando una interfaz técnica clara y conocida.

La adopción de un adapter específico mejora la modificabilidad y la testabilidad. La lógica de negocio de reservas no necesita conocer headers, payloads, códigos de error ni formato de firma del proveedor; sólo interactúa con un contrato interno de pagos. Esto reduce el acoplamiento a infraestructura y deja preparada la sustitución futura del proveedor con impacto acotado.

El uso de webhook asíncrono fue preferido frente a asumir que la respuesta inicial de la confirmación equivale al resultado definitivo. El proveedor puede completar, rechazar o dejar procesando un pago luego de la solicitud inicial, por lo que confirmar la reserva únicamente a partir de la primera respuesta incrementaría el riesgo de inconsistencias. El webhook permite alinear el estado interno con el estado efectivo reportado por el PSP, mejorando confiabilidad y auditabilidad.

También se incorporó control de idempotencia y deduplicación. La clave de idempotencia en la llamada saliente reduce el riesgo de crear múltiples operaciones ante reintentos, y el almacenamiento del identificador del evento recibido por webhook evita aplicar dos veces una misma notificación. Esta decisión impacta positivamente en confiabilidad operativa.

**Alternativas consideradas y rechazadas:**
- **Plataforma de pagos simulada o local**: descartada porque la implementación actual ya integra un PSP real y el objetivo de esta parte del sistema es documentar una capacidad operativa concreta, no una simulación. Mantener un mock como decisión principal ocultaría restricciones reales de seguridad, disponibilidad e integración.
- **Confirmación completamente síncrona en el request de pago**: descartada porque el sistema necesita aceptar estados intermedios y depender del resultado definitivo informado por el proveedor. Confirmar la reserva en la respuesta inicial aumentaría el riesgo de divergencia entre el sistema y Stripe.
- **Integración directa de Stripe dentro del servicio de reservas sin puerto ni adapter**: descartada porque acoplaría la lógica del dominio a detalles del proveedor, dificultando pruebas, reemplazo futuro del PSP y mantenimiento de la integración.

**Suposición**: Se asume que Stripe será el único proveedor de pagos en esta etapa del proyecto y que el endpoint de webhook podrá ser alcanzado de forma confiable a través de la infraestructura del sistema.

## Estado

Aceptado

## Consecuencias

**Positivas:**
- Se incorpora una integración real de pagos sin implementar lógica financiera sensible dentro del sistema.
- Se desacopla el dominio de reservas de la API concreta del proveedor mediante un puerto y un adapter.
- Se mejora la confiabilidad del flujo al confirmar la reserva sólo ante evidencia definitiva provista por Stripe.
- Se incrementa la auditabilidad al persistir pagos, códigos de respuesta del proveedor y eventos de webhook procesados.
- Se habilita una degradación controlada ante fallas del proveedor, devolviendo errores explícitos cuando Stripe no está disponible o no está configurado.

**Negativas:**
- Se agrega dependencia de un servicio externo crítico cuya indisponibilidad impacta directamente la confirmación de pagos.
- El flujo deja de ser completamente síncrono y pasa a depender de consistencia eventual entre el intento inicial y el webhook final.
- Se suma complejidad operativa en configuración de secretos, validación de firmas, exposición del webhook y manejo de errores del proveedor.
- La solución actual queda sesgada a Stripe en la capa de infraestructura, aunque el adapter reduzca ese acoplamiento en la capa de dominio.

**Riesgos:**
- Si el webhook no llega, llega tarde o es rechazado, una reserva puede permanecer en `pending_confirmation` aun cuando exista actividad del lado del proveedor.
- Un error de configuración en `STRIPE_SECRET_KEY` o `STRIPE_WEBHOOK_SECRET` inutiliza parcial o totalmente el flujo de pagos.
- La dependencia de red y del proveedor introduce fallas transitorias, timeouts y escenarios de reintento que deben seguir siendo tratados de manera cuidadosa.
