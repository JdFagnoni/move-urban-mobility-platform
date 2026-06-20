# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MOVE Platform** is a microservices-based transportation reservation and management system. Five services are deployed via Docker:

- **api-gateway** (port 3000): Entry point handling authentication, rate limiting, and request routing
- **reservation-service** (port 3001): Manages reservations, users, and categories
- **transportation-service** (port 3002): Handles trips, GPS tracking, alerts, operational tasks, vehicles, and zones
- **categorizer-service** (port 3003): AI-powered cargo categorization via Ollama
- **shared**: Internal npm workspace with shared types, database utilities, and HTTP error handling

Supporting infrastructure: **PostgreSQL** (port 5432) shared across services, **Ollama** (port 11434) for AI categorization.

## Architecture

The system follows a domain-driven microservices architecture (ADR-001). Each service is independently deployable via Docker with multi-stage builds and health checks.

### Key Design Patterns

1. **API Gateway Pattern** (ADR-005): All external traffic flows through `api-gateway`, which validates JWT tokens from Auth0 (RS256), applies rate limiting, and proxies requests via `express-http-proxy`. Authenticated user identity is forwarded via `x-auth-subject` header.

2. **Authentication** (ADR-002): Auth0 handles identity. Downstream services receive the `sub` claim and apply authorization rules locally. Services don't store credentials.

3. **Data Persistence** (ADR-003): PostgreSQL with Sequelize-TypeScript ORM in `reservation-service` and `transportation-service` (vehicles, zones). `categorizer-service` uses raw `pg` queries.

4. **Shared Code** (ADR-004): `@move/shared` workspace centralizes type definitions (`reservation.ts`, `trip.ts`, `category.ts`, `user-auth.ts`, `gps.ts`, `zone.ts`, `vehicle.ts`, `alert.ts`), a PostgreSQL connection pool, and HTTP utilities.

### Request Flow

1. Client sends `Authorization: Bearer <JWT>` to `api-gateway:3000`
2. Gateway validates token via Auth0 JWKS (cached 10 minutes)
3. Gateway extracts `sub` claim, forwards as `x-auth-subject` to downstream service
4. Service uses identity context for authorization

### Service Module Structure

**reservation-service/src/modules/**: `auth/`, `reservations/`, `categories/`, `users/`

**transportation-service/src/modules/**: `trips/`, `gps/`, `alerts/`, `operator/`, `vehicles/`, `zones/`

### Database Initialization

`reservation-service` initializes PostgreSQL on startup: syncs Sequelize models, seeds bootstrap admin user if absent, retries connection up to 10 times with 3-second delays.

## Commands

### Root Workspace

```bash
npm ci                    # Install all workspace dependencies
npm run build             # Compile all services + shared
npm run lint              # ESLint across all workspaces
npm run lint:fix          # Auto-fix lint issues
npm run format            # Prettier format
npm run format:check      # Check formatting without modifying
npm run dev               # Start full stack in Docker (dev mode)
npm run prod              # Start full stack in Docker (production)
```

### Individual Services

From any service directory:

```bash
npm run dev    # ts-node-dev with watch (source code changes hot-reload)
npm run build  # TypeScript compile to dist/
npm run start  # Run compiled dist/ (production)
npm run lint   # Lint this service only
```

To run a single service locally against Docker dependencies:

```bash
docker compose -f docker-compose.dev.yml up postgres ollama
cd <service-directory>
npm run dev
```

### Load Testing

```bash
k6 run k6/load-test.ts --env BASE_URL=http://localhost:3000
```

Targets: throughput R2, concurrency R8, p95 latency <500ms (R5).

## Code Quality

**TypeScript** (`tsconfig.base.json`): strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, target ES2022.

**ESLint + Prettier** (`.eslintrc.json`, `.prettierrc`):
- Print width: 100, double quotes, trailing commas (ES5), always parenthesize arrow params
- No `any`, no floating promises, consistent type imports enforced

CI runs lint, format check, TypeScript build, and Docker health checks on every PR (`.github/workflows/ci.yml`).

## Configuration

Environment variables loaded from `.env` (see `.env.example`):

```
DATABASE_URL                         # postgres://move:move_secret@postgres:5432/move_platform
AUTH0_DOMAIN, AUTH0_AUDIENCE         # Auth0 tenant config
AUTH0_MGMT_CLIENT_ID/SECRET          # Auth0 Management API credentials
BOOTSTRAP_ADMIN_AUTH_SUBJECT/EMAIL/NAME
RESERVATIONS_URL, TRANSPORTATIONS_URL, CATEGORIZER_SERVICE_URL, OLLAMA_URL
API_GATEWAY_PORT, RESERVATIONS_PORT, TRANSPORTATIONS_PORT, CATEGORIZER_SERVICE_PORT
GPS_SIMULATOR_INTERVAL_MS
```

## Docker

Multi-stage Dockerfiles: `base` (install deps) → `dev` (ts-node-dev) / `builder` (compile) → `prod` (node dist/).

- `docker-compose.yml`: Production
- `docker-compose.dev.yml`: Development with source volume mounts and `gps-simulator` service
- `docker-compose.ci.yml`: CI health checks on ports 3000–3003

All services expose `GET /health`.

## Common Workflows

### Adding a route to a service

1. Create module files (controller, service, router) in `src/modules/<domain>/`
2. Register router in `src/index.ts`: `app.use("/<path>", router)`
3. In `api-gateway/src/routes/`, expose the endpoint (with or without `authenticate` middleware depending on visibility)

### Adding a shared type

1. Edit or create `shared/types/<domain>.ts`
2. Export from `shared/types/index.ts`
3. No build step needed — consuming services pick it up immediately

### Import patterns for shared

```typescript
import type { Reservation, ReservationStatus } from "@move/shared";
import { pool, query } from "@move/shared";
```

## Architectural Decisions

See `ADRs/` directory for full context on:
- ADR-001: Microservices by domain
- ADR-002: Auth0 vs. Keycloak or custom auth
- ADR-003: PostgreSQL vs. NoSQL
- ADR-004: Shared npm workspace vs. external package
- ADR-005: API Gateway vs. direct service exposure
