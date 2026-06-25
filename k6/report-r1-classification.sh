#!/usr/bin/env bash
# Reporte de rendimiento de clasificacion asincrona de reservas individuales.
# Uso: ./k6/report-r1-classification.sh [minutos] [archivo.md]
# Por defecto busca reservas de los ultimos 10 minutos.
# Si se pasa un segundo argumento, escribe el reporte en ese archivo .md.

MINUTES=${1:-10}
OUTPUT=${2:-}
CONTAINER="298679_288818_292300-postgres-1"
RUN_DATE=$(date "+%Y-%m-%d %H:%M:%S")

RAW=$(docker exec "$CONTAINER" psql -U move -d move_platform -t -A -c "
WITH samples AS (
  SELECT
    ROUND(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000)::int AS ms
  FROM reservations
  WHERE status = 'pending_confirmation'
    AND created_at > NOW() - INTERVAL '${MINUTES} minutes'
    AND updated_at > created_at
),
percentiles AS (
  SELECT
    COUNT(*)                                                        AS n,
    MIN(ms)                                                         AS min_ms,
    ROUND(AVG(ms))                                                  AS avg_ms,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ms))::int   AS p50_ms,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ms))::int   AS p90_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ms))::int   AS p95_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ms))::int   AS p99_ms,
    MAX(ms)                                                         AS max_ms
  FROM samples
)
SELECT
  n        || chr(9) ||
  min_ms   || chr(9) ||
  avg_ms   || chr(9) ||
  p50_ms   || chr(9) ||
  p90_ms   || chr(9) ||
  p95_ms   || chr(9) ||
  p99_ms   || chr(9) ||
  max_ms
FROM percentiles;
")

IFS=$'\t' read -r N MIN AVG P50 P90 P95 P99 MAX <<< "$RAW"

# --- Terminal ---
echo ""
echo "┌─────────────────────────────────────────────────────────┐"
echo "│   Clasificacion asincrona — clientes particulares (R1)  │"
echo "├──────────────┬──────────────────────────────────────────┤"
printf "│ %-12s │ %-40s │\n" "Muestras"  "${N} reservas"
printf "│ %-12s │ %-40s │\n" "Min"       "${MIN} ms"
printf "│ %-12s │ %-40s │\n" "Avg"       "${AVG} ms"
printf "│ %-12s │ %-40s │\n" "p50"       "${P50} ms"
printf "│ %-12s │ %-40s │\n" "p90"       "${P90} ms"
printf "│ %-12s │ %-40s │\n" "p95"       "${P95} ms"
printf "│ %-12s │ %-40s │\n" "p99"       "${P99} ms"
printf "│ %-12s │ %-40s │\n" "Max"       "${MAX} ms"
echo "└──────────────┴──────────────────────────────────────────┘"
echo ""

# --- Markdown ---
if [ -n "$OUTPUT" ]; then
  cat > "$OUTPUT" <<EOF
# R1 — Clasificacion asincrona: clientes particulares

**Fecha:** ${RUN_DATE}
**Ventana:** ultimos ${MINUTES} minutos
**SLA threshold:** p95 < 30 000 ms

| Metrica  | Valor         |
|----------|---------------|
| Muestras | ${N} reservas |
| Min      | ${MIN} ms     |
| Avg      | ${AVG} ms     |
| p50      | ${P50} ms     |
| p90      | ${P90} ms     |
| p95      | ${P95} ms     |
| p99      | ${P99} ms     |
| Max      | ${MAX} ms     |

## Interpretacion

El tiempo mide el intervalo entre \`created_at\` y \`updated_at\` en la tabla \`reservations\`
para reservas que pasaron al estado \`pending_confirmation\` — es decir, el tiempo real de
clasificacion asincrona via RabbitMQ + categorizer-service, medido desde la base de datos.

El threshold de K6 (\`classification_e2e_ms p95 < 30 000 ms\`) incluye ademas el overhead
de polling desde el cliente; el valor de p95 de la DB es el tiempo neto del pipeline.
EOF
  echo "Reporte escrito en: $OUTPUT"
fi
