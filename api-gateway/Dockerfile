# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# Layer cacheable: only package.jsons change rarely
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
COPY api-gateway/ ./api-gateway/
RUN npm run build --workspace=@move/shared
WORKDIR /app/api-gateway
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── builder ────────────────────────────────────────────────────────────────
FROM base AS builder
COPY shared/ ./shared/
COPY api-gateway/ ./api-gateway/
RUN npm run build --workspace=@move/shared
RUN npm run build --workspace=@move/api-gateway

# ── prod ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/api-gateway/dist ./dist
COPY --from=builder /app/api-gateway/package.json ./
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
