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

    CREATE TABLE IF NOT EXISTS trips (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      reservation_id UUID        NOT NULL,
      vehicle_id     UUID        NOT NULL,
      driver_id      UUID        NOT NULL,
      status         VARCHAR(20) NOT NULL DEFAULT 'assigned',
      started_at     TIMESTAMPTZ,
      completed_at   TIMESTAMPTZ,
      route          JSONB       NOT NULL DEFAULT '[]',
      origin         JSONB,
      destination    JSONB,
      driver_name    TEXT,
      driver_email   TEXT,
      category_ids   UUID[],
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Datos desnormalizados (propagados desde reservation-service vía eventos) para
    -- que el panel del operador no consulte tablas de otros servicios. Nullable porque
    -- se rellenan hacia adelante con cada evento ReservationAssigned; viajes previos
    -- a este cambio pueden no tenerlos.
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS origin       JSONB;
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS destination  JSONB;
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS driver_name  TEXT;
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS driver_email TEXT;
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS category_ids UUID[];

    CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_reservation ON trips (reservation_id);
    CREATE INDEX IF NOT EXISTS idx_trips_driver      ON trips (driver_id);
    CREATE INDEX IF NOT EXISTS idx_trips_vehicle     ON trips (vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_trips_status      ON trips (status);
  `);
}
