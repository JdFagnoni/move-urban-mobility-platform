import { pool } from "@move/shared";

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gps_signals (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      vehicle_id  UUID        NOT NULL,
      location    JSONB       NOT NULL,
      speed       FLOAT       NOT NULL,
      heading     FLOAT       NOT NULL,
      timestamp   TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time
      ON gps_signals (vehicle_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS alerts (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id     UUID,
      vehicle_id  UUID        NOT NULL,
      type        VARCHAR(50) NOT NULL,
      severity    VARCHAR(20) NOT NULL,
      message     TEXT        NOT NULL,
      location    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_vehicle
      ON alerts (vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_trip
      ON alerts (trip_id);
  `);
}
