# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY api-gateway/package.json ./api-gateway/
COPY reservas-service/package.json ./reservas-service/
COPY traslados-service/package.json ./traslados-service/
COPY categorizer-service/package.json ./categorizer-service/
RUN npm ci --ignore-scripts

# ── dev ────────────────────────────────────────────────────────────────────
FROM base AS dev
COPY shared/ ./shared/
COPY reservas-service/ ./reservas-service/
RUN npm run build --workspace=@move/shared
WORKDIR /app/reservas-service
EXPOSE 3001
CMD ["npm", "run", "dev"]

# ── builder ────────────────────────────────────────────────────────────────
FROM base AS builder
COPY shared/ ./shared/
COPY reservas-service/ ./reservas-service/
RUN npm run build --workspace=@move/shared
RUN npm run build --workspace=@move/reservas-service

# ── prod ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/reservas-service/dist ./dist
COPY --from=builder /app/reservas-service/package.json ./
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/index.js"]
