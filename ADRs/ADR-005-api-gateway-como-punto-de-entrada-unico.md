# ADR 005: API Gateway como punto de entrada único

La solución expone varios servicios internos, pero no conviene que los clientes conozcan sus direcciones, políticas de seguridad y particularidades de integración. Había fuerzas claras a favor de centralizar la entrada: simplificar el consumo externo, concentrar preocupaciones transversales como autenticación y rate limiting, y mantener una frontera más controlada hacia los servicios internos. También influyeron costos de proyecto, porque replicar estas capacidades en cada servicio duplicaría trabajo y aumentaría la posibilidad de inconsistencias.

## Decisión

Nosotros utilizaremos un `api-gateway` como punto de entrada único para los clientes externos. Nosotros aplicaremos en ese gateway middleware de autenticación, logging y rate limiting, y reenviaremos las solicitudes hacia los servicios internos correspondientes. Nosotros propagaremos la identidad autenticada a los servicios que lo requieran mediante headers internos controlados.

## Justificación

La implementación actual ya sigue este patrón: el `api-gateway` valida tokens, limita tráfico, expone rutas unificadas y proxya solicitudes hacia `reservation-service` y `transportation-service`. Esto evita repetir lógica transversal en todos los servicios y ofrece una interfaz más estable hacia el exterior.

La alternativa de exponer cada microservicio directamente a los clientes fue rechazada porque obliga a duplicar autenticación, rate limiting, observabilidad y políticas de borde en múltiples puntos. También se descartó, por ahora, una solución más sofisticada basada en service mesh o un API management completo, porque el costo operativo y conceptual es alto para el tamaño actual del sistema.

Se asume que la red interna entre gateway y servicios es de confianza controlada y que los headers propagados por el gateway no serán aceptados desde fuentes no confiables. También se acepta que el gateway será un componente crítico y deberá operar con especial cuidado.

## Estado

Aceptado.

## Consecuencias

1. Se simplifica la integración de los clientes con una única puerta de entrada.
2. Se centralizan autenticación, rate limiting y otras políticas transversales.
3. Se reduce la duplicación de lógica de borde en servicios internos.
4. El gateway se convierte en un punto crítico cuya falla afecta a gran parte del sistema.
5. Se agrega un salto de red adicional y, por lo tanto, cierta latencia.
6. Se requiere proteger cuidadosamente la frontera interna para que la identidad propagada no pueda ser falsificada.
