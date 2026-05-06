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
COPY categorizer-service/ ./categorizer-service/
WORKDIR /app/categorizer-service
EXPOSE 3003
CMD ["npm", "run", "dev"]

# ── builder ────────────────────────────────────────────────────────────────
FROM base AS builder
COPY shared/ ./shared/
COPY categorizer-service/ ./categorizer-service/
RUN npm run build --workspace=@move/shared
RUN npm run build --workspace=@move/categorizer-service

# ── prod ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/categorizer-service/dist ./dist
COPY --from=builder /app/categorizer-service/package.json ./
EXPOSE 3003
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["node", "dist/index.js"]
