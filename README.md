# 298679_288818_292300

Plataforma de traslados urbanos **MOVE** — sistema de gestión de reservas con seguimiento GPS en tiempo real.

## Requisitos

- [Docker](https://www.docker.com/) y Docker Compose
- [Node.js 20](https://nodejs.org/) (para instalar dependencias y correr scripts de calidad)

## Servicios

| Servicio | Puerto | Descripción |
|---|---|---|
| api-gateway | 3000 | Punto de entrada único: autenticación JWT, rate limiting y proxy |
| reservation-service | 3001 | Reservas, usuarios, categorías y pagos |
| transportation-service | 3002 | Viajes, GPS, alertas, vehículos y zonas |
| categorizer-service | 3003 | Categorización de bienes con IA |
| PostgreSQL | 5432 | Base de datos compartida |
| RabbitMQ | 5672 / 15672 | Mensajería asíncrona + management UI |
| Redis | 6379 | Caché y rate limiting |
| Ollama | 11434 | Modelos de IA local |

## Configuración

Copiar el archivo de ejemplo y completar las variables:

```bash
cp .env.example .env
```

Variables obligatorias para que el sistema funcione:

| Variable | Descripción |
|---|---|
| `AUTH0_DOMAIN` | Dominio del tenant de Auth0 (ej. `dev-xxx.us.auth0.com`) |
| `AUTH0_AUDIENCE` | Audience configurado en Auth0 |
| `AUTH0_MGMT_CLIENT_ID` / `AUTH0_MGMT_CLIENT_SECRET` | Credenciales de la Management API de Auth0 |
| `INTERNAL_GATEWAY_SECRET` | Secret compartido para comunicación interna entre servicios |
| `BOOTSTRAP_ADMIN_AUTH_SUBJECT` | `sub` del usuario administrador inicial en Auth0 |
| `BOOTSTRAP_ADMIN_EMAIL` | Email del administrador inicial |

Variables opcionales según funcionalidad:

| Variable | Descripción |
|---|---|
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Para pagos reales con Stripe |
| `OPENAI_API_KEY` | Para búsqueda semántica con embeddings de OpenAI |
| `NGROK_AUTHTOKEN` | Para exponer el webhook de Stripe en desarrollo |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Para envío de emails reales |

## Correr en desarrollo

```bash
npm run dev
```

Levanta todos los servicios con hot-reload. Los cambios en el código fuente se reflejan automáticamente sin reconstruir la imagen.

## Correr con ngrok (webhook de Stripe)

```bash
npm run dev:ngrok
```

Igual que `dev`, pero levanta además un túnel público con ngrok para recibir eventos del webhook de Stripe en desarrollo local. Requiere `NGROK_AUTHTOKEN` en el `.env`.

## Correr en producción

```bash
npm run prod
```

Usa imágenes compiladas (`target: prod`) con artefactos en `dist/`. No monta código fuente como volumen.

## Calidad de código

```bash
npm run lint          # ESLint en todos los servicios
npm run lint:fix      # Corregir errores automáticamente
npm run format        # Prettier sobre todo el proyecto
npm run format:check  # Verificar formato sin modificar
```

## Otros comandos útiles

```bash
# Evaluar las estrategias de categorización (R10)
npm run evaluate:r10:docker

# Ver logs de un servicio en particular
docker compose -f docker-compose.dev.yml logs -f reservations

# Acceder a la base de datos
docker compose -f docker-compose.dev.yml exec postgres psql -U move -d move_platform

# RabbitMQ Management UI
# http://localhost:15672  (usuario: move / contraseña: move_secret)
```
