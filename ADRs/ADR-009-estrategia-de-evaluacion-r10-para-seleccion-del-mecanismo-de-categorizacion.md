# ADR 009: Evaluación R10 y adopción de búsqueda semántica como mecanismo de categorización

La funcionalidad F4.1 requiere que el sistema determine la categoría MOVE de los bienes ingresados por un cliente particular a partir de una descripción textual. A su vez, F19 exige que, cuando dicha categoría no pueda determinarse, la reserva pase rápidamente a tratamiento manual por un operador. La categorización impacta de forma directa en funcionalidades posteriores, ya que la categoría inferida condiciona la cotización, las reglas operativas del traslado y el eventual monitoreo adicional.

El requerimiento R10 no introduce una funcionalidad distinta, sino una exigencia de evaluación arquitectónica sobre el mecanismo utilizado para resolver F4.1. En particular, la letra espera que el equipo evalúe y compare tres alternativas mínimas para la categorización: IA generativa con modelos locales, búsqueda semántica y una tercera opción a criterio del equipo. La comparación debe realizarse considerando tiempos de respuesta, precisión en la identificación de categorías y simplicidad de desarrollo.

Para resolver esta exigencia sin sesgar la decisión, el equipo construyó una evaluación empírica común sobre un dataset etiquetado manualmente a partir del CSV de categorías y descripciones provisto por MOVE, complementado con casos adicionales de redacción libre, casos ambiguos y casos que debían derivarse a operador. La comparación se ejecutó con un mismo catálogo de categorías, un mismo contrato de categorización y un mismo harness para las estrategias comparadas.

Como resultado de la corrida final del harness actualizada para utilizar la configuración productiva vigente de búsqueda semántica, esta estrategia obtuvo sobre 38 casos un `accuracy` de `73.68%`, una `classificationPrecision` de `75.00%`, una `fallbackCorrectness` de `66.67%`, un `errorRate` de `0%`, latencia promedio de `231.98 ms` y `p95` de `299.57 ms`. En la misma corrida, el baseline determinístico obtuvo `36.84%` de `accuracy`, `25.00%` de `classificationPrecision` y `100.00%` de `fallbackCorrectness`. La alternativa de IA generativa local fue prototipada con modelos locales sobre Ollama, pero presentó dificultades operativas relevantes en el entorno disponible, principalmente asociadas al peso de los modelos, al consumo de memoria y a la estabilidad de ejecución, lo que impidió obtener una evidencia experimental más sólida y ventajosa que la alcanzada por la búsqueda semántica.

## Decisión

Se adoptará la búsqueda semántica como mecanismo principal de categorización automática para la funcionalidad F4.1.

La selección de esta alternativa se sustentará en la evaluación comparativa exigida por R10, ejecutada sobre un dataset común, un catálogo común de categorías MOVE y un contrato uniforme de categorización.

El sistema hará uso de embeddings y comparación por similitud semántica sobre el catálogo de categorías MOVE, manteniendo la capacidad de devolver ausencia de clasificación cuando la confianza de la inferencia no sea suficiente y corresponda derivar a tratamiento manual.

El enfoque determinístico basado en reglas o palabras clave se conservará únicamente como baseline de evaluación y referencia comparativa para R10, pero no como mecanismo principal de categorización.

La alternativa de IA generativa local con Ollama quedará descartada para la implementación principal del obligatorio, sin perjuicio de que el contrato de categorización preserve la posibilidad de incorporar otra estrategia o proveedor en el futuro.

## Justificación

La búsqueda semántica fue elegida porque presentó el mejor balance entre precisión, comportamiento de fallback y viabilidad operativa dentro de la evidencia efectivamente obtenida por el equipo. Frente al baseline determinístico, la mejora fue significativa en los atributos más relevantes para R10: `73.68%` de `accuracy` frente a `36.84%`, `75.00%` de precisión de clasificación frente a `25.00%`, y `66.67%` de correctitud de fallback frente a `100.00%`. Si bien el baseline mostró mejor comportamiento en fallback puro, la búsqueda semántica obtuvo un desempeño global claramente superior en exactitud total y precisión de clasificación, que son los atributos más determinantes para automatizar la categorización de reservas individuales.

La IA generativa local fue rechazada por razones principalmente operativas y de evaluabilidad. En el ambiente disponible, los modelos locales de mayor tamaño resultaron pesados en consumo de memoria y ejecución, generando inestabilidad y dificultad para producir corridas reproducibles. Esto afectó negativamente atributos como deployabilidad, operabilidad y testabilidad. Incluso utilizando variantes más livianas, no se obtuvo una combinación de simplicidad operativa, estabilidad y evidencia experimental superior a la alcanzada por la búsqueda semántica.

El enfoque determinístico basado en reglas o palabras clave fue descartado como solución principal porque, si bien exhibe muy baja complejidad de implementación y operación, su performance funcional quedó claramente por debajo de la búsqueda semántica. Esto lo vuelve útil como línea base de comparación, pero insuficiente como mecanismo principal de categorización para un flujo que depende de interpretar descripciones textuales variables.

La evaluación se realizó sobre una interfaz funcional única de categorización, independiente de la implementación concreta, de forma que las alternativas comparadas recibieran la misma entrada y devolvieran la misma salida posible: categoría identificada o ausencia de clasificación. Esto mejora la modificabilidad y la testabilidad, y evitó acoplar el flujo de negocio a una tecnología puntual antes de completar la comparación exigida por R10.

La utilización de un dataset etiquetado manualmente, construido tomando como base el CSV provisto por MOVE y complementado con casos adicionales redactados por el equipo, evitó comparaciones subjetivas y permitió medir no sólo la capacidad de clasificar correctamente, sino también la capacidad de derivar a operador cuando la inferencia no era suficientemente confiable. Esto alinea la comparación con F19, donde no sólo importa acertar, sino también fallar de forma controlada.

La búsqueda semántica también resulta una decisión más defendible desde el punto de vista arquitectónico porque mantiene desacoplado el flujo de negocio respecto del proveedor concreto de embeddings. La estrategia elegida describe un mecanismo de categorización, no una dependencia irreversible de una tecnología puntual. Por lo tanto, si en una iteración posterior se resolviera migrar desde un modelo local a un servicio externo de embeddings, la decisión seguiría siendo consistente con la arquitectura seleccionada.

En la implementación vigente, el servicio de categorización precalienta al arrancar el caché de embeddings de categorías. Esto implica que los tiempos reportados en la evaluación corresponden al régimen estable de operación, es decir, una vez completado el warmup inicial. Esta decisión reduce significativamente la latencia percibida por la primera reserva clasificada luego del arranque, a costa de asumir un tiempo de inicialización mayor del servicio.

**Alternativas consideradas y rechazadas:**

- **IA generativa local con Ollama**: descartada como opción principal por mayor complejidad operativa, consumo de memoria elevado en el entorno disponible y ausencia de evidencia experimental superior y estable respecto de la búsqueda semántica.
- **Clasificación determinística por reglas o palabras clave**: descartada como opción principal por baja precisión frente a entradas con paráfrasis, lenguaje natural y descripciones no literales, aunque se conserva como baseline exigible y útil para R10.
- **Selección basada únicamente en simplicidad operativa**: descartada porque hubiera conducido a privilegiar el baseline determinístico aun cuando la evidencia mostró una degradación importante en precisión.

**Suposición**: Se asume que el catálogo MOVE y el dataset de evaluación son suficientemente representativos para comparar las alternativas en el contexto del obligatorio.

**Suposición**: Se asume que la solución final puede conservar la abstracción actual de categorización, de forma que el proveedor concreto de embeddings pueda cambiar sin alterar el flujo de reservas.

## Estado

Aceptado

## Consecuencias

**Positivas:**

- Se adopta la alternativa con mejor resultado experimental global entre las evaluadas y estabilizadas.
- Se mejora la precisión de categorización respecto del baseline determinístico.
- Se preserva un mecanismo explícito de fallback cuando la clasificación no es suficientemente confiable.
- Se mantiene una complejidad operativa menor que la observada en la alternativa de IA generativa local.
- Se conserva flexibilidad para reemplazar el proveedor de embeddings en el futuro sin rediseñar el flujo funcional.
- El precalentamiento del caché de embeddings de categorías al inicio permite que la latencia de categorización observada en operación normal sea baja y consistente.

**Negativas:**

- La latencia promedio es mayor que la del baseline determinístico.
- La solución depende de un componente de embeddings y de su disponibilidad operativa.
- La calibración de umbrales de aceptación sigue requiriendo ajuste y validación sobre dataset.
- El servicio requiere un warmup inicial para precalentar embeddings de categorías antes de alcanzar su mejor latencia operativa.

**Riesgos:**

- Si el modelo de embeddings o el catálogo de categorías cambian sustancialmente, los umbrales actuales pueden dejar de ser adecuados.
- Si el entorno de ejecución dispone de recursos insuficientes, el tiempo de respuesta puede degradarse.
- Si el dataset de evaluación no representa suficientemente ciertos casos límite, la estrategia podría mostrar peor comportamiento en producción que en la evaluación controlada.
