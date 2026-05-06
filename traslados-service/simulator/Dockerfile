# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
COPY traslados-service/simulator/package*.json ./
RUN npm ci --ignore-scripts

FROM base AS dev
COPY traslados-service/simulator/ ./
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY traslados-service/simulator/ ./
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
