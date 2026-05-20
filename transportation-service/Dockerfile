# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY api-gateway/package.json ./api-gateway/
COPY reservation-service/package.json ./reservation-service/
COPY transportation-service/package.json ./transportation-service/
COPY categorizer-service/package.json ./categorizer-service/
RUN npm ci --ignore-scripts

# ── dev ────────────────────────────────────────────────────────────────────
FROM base AS dev
COPY shared/ ./shared/
COPY transportation-service/ ./transportation-service/
RUN npm run build --workspace=@move/shared
WORKDIR /app/transportation-service
EXPOSE 3002
CMD ["npm", "run", "dev"]

# ── builder ────────────────────────────────────────────────────────────────
FROM base AS builder
COPY shared/ ./shared/
COPY transportation-service/ ./transportation-service/
RUN npm run build --workspace=@move/shared
RUN npm run build --workspace=@move/transportation-service

# ── prod ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/transportation-service/dist ./dist
COPY --from=builder /app/transportation-service/package.json ./
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1
CMD ["node", "dist/index.js"]
