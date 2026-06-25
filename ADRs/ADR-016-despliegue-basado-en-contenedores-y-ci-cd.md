# ADR 016: Estrategia de despliegue basada en contenedores y pipeline de CI

La plataforma MOVE está compuesta por varios servicios independientes (`api-gateway`, `reservation-service`, `transportation-service`, `categorizer-service`) y dependencias de infraestructura (PostgreSQL, Redis, RabbitMQ, Ollama, simulador de GPS). Ejecutar y coordinar este conjunto de procesos de forma reproducible, tanto en las máquinas de desarrollo como en el entorno de evaluación, exige un mecanismo que evite el clásico problema de "funciona en mi máquina" y que garantice paridad entre ambientes. A su vez, el obligatorio requiere que los cambios se integren manteniendo la calidad del código (convenciones de estilo, compilación sin errores, servicios que arrancan correctamente), lo que demanda una verificación automatizada y consistente en cada cambio. Sin estas garantías, el riesgo de romper la integración entre servicios o de introducir regresiones aumenta con cada merge.

## Decisión

Se adoptará una estrategia de despliegue basada en contenedores Docker, con multi-stage builds por servicio y orquestación mediante Docker Compose, complementada con un pipeline de integración continua (CI) en GitHub Actions.

**Contenedores y composición:**

- Cada servicio definirá un `Dockerfile` con etapas separadas: `base` (instalación de dependencias), `dev` (ejecución con `ts-node-dev` y recarga en caliente), `builder` (compilación TypeScript) y `prod` (ejecución del código compilado en `dist/`).
- Cada imagen de producción expondrá un `HEALTHCHECK` que consulta el endpoint `GET /health` del servicio.
- La orquestación se realizará con tres archivos de composición según el propósito: `docker-compose.yml` (producción), `docker-compose.dev.yml` (desarrollo con volúmenes de código fuente y servicio `gps-simulator`) y `docker-compose.ci.yml` (verificación de health checks en CI).

**Pipeline de CI:**

- Se ejecutará en cada _pull request_ hacia `develop` y `main`, y en cada _push_ a `main`.
- El pipeline comprenderá tres jobs encadenados: (1) _lint & format_ (ESLint y verificación de formato con Prettier), (2) _TypeScript build_ (compilación de todos los workspaces) y (3) _Docker build & health check_ (construcción de imágenes con `docker-compose.ci.yml`, arranque de los servicios y espera activa hasta que respondan sus health checks).

## Justificación

La contenedorización fue elegida porque resuelve directamente el atributo de **deployability**: empaqueta cada servicio con sus dependencias y su runtime, garantizando paridad entre la máquina de desarrollo y el entorno de evaluación, y permite levantar la totalidad del stack con un único comando. Los multi-stage builds mantienen las imágenes de producción livianas (solo el código compilado y las dependencias necesarias) sin sacrificar la comodidad de desarrollo con recarga en caliente. Los `HEALTHCHECK` por servicio aportan a la **disponibilidad** y a la observabilidad del despliegue, al exponer de forma estandarizada el estado de cada componente.

El pipeline de CI impacta positivamente en **testabilidad** y modificabilidad: verifica de forma automática y reproducible que cada cambio respete las convenciones de código, compile correctamente y que los servicios efectivamente arranquen y respondan, detectando regresiones antes de que se integren. La verificación de health checks sobre las imágenes Docker dentro del pipeline asegura que no solo el código compila, sino que el sistema empaquetado es ejecutable de extremo a extremo.

**Alternativas consideradas y rechazadas:**

- **Ejecución directa de los servicios en el host sin contenedores**: descartada porque obliga a instalar y coordinar manualmente PostgreSQL, Redis, RabbitMQ y Ollama en cada máquina, con alto riesgo de divergencia de versiones y de entornos no reproducibles.
- **Orquestador de contenedores más sofisticado (por ejemplo, Kubernetes)**: descartado por sobredimensionamiento. Su complejidad operativa (gestión de clústeres, manifiestos, networking avanzado) no se justifica para el alcance y el volumen del obligatorio; Docker Compose cubre las necesidades de orquestación de la etapa actual.
- **No automatizar la verificación (validación manual previa al merge)**: descartada porque depende de la disciplina individual, es propensa a omisiones y no garantiza que los servicios arranquen en un entorno limpio.
- **Pipeline de despliegue continuo (CD) automático a un entorno productivo**: descartado por ahora, ya que el proyecto no cuenta con un entorno productivo permanente; el pipeline se limita a integración continua (build, lint y verificación de arranque), dejando el despliegue como operación manual mediante Compose.

**Suposición**: Se asume que el entorno de ejecución dispone de Docker y Docker Compose, y que el runner de GitHub Actions puede construir y levantar las imágenes dentro de los límites de tiempo y recursos del plan utilizado.

## Estado

Aceptado

Esta decisión formaliza la estrategia de contenedores y CI ya vigente en el repositorio (`Dockerfile` por servicio, `docker-compose.{yml,dev,ci}.yml` y `.github/workflows/ci.yml`).

## Consecuencias

**Positivas:**

- Se obtiene paridad entre entornos de desarrollo y evaluación, eliminando el problema de "funciona en mi máquina".
- Se levanta el stack completo (servicios y dependencias) de forma reproducible con un único comando.
- Cada cambio se verifica automáticamente en cuanto a estilo, compilación y arranque efectivo de los servicios, reduciendo el riesgo de regresiones.
- Las imágenes de producción son livianas gracias a los multi-stage builds, y los health checks estandarizan la verificación de estado.

**Negativas:**

- Se agrega complejidad de configuración (Dockerfiles, archivos de Compose y workflow de CI) que debe mantenerse en coherencia con la evolución del código.
- La construcción de imágenes y la espera de health checks añaden tiempo a cada ejecución del pipeline.
- El consumo de recursos local para correr todo el stack en contenedores es mayor que ejecutar un único proceso.

**Riesgos:**

- Si el `docker-compose.ci.yml` o los health checks quedan desalineados con la configuración real de los servicios, el pipeline puede dar falsos positivos o negativos. Se mitiga manteniendo la composición de CI lo más cercana posible a la de producción.
- La ausencia de despliegue continuo automatizado implica que el paso a un entorno desplegado sigue siendo manual y, por lo tanto, susceptible a error humano. Se acepta para el alcance actual y se señala como evolución futura.
