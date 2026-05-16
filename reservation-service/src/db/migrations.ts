import { query } from "@move/shared";

export async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      auth_provider text NOT NULL DEFAULT 'auth0',
      auth_subject text NOT NULL,
      email text NOT NULL,
      name text NOT NULL,
      role text NOT NULL,
      client_type text,
      status text NOT NULL DEFAULT 'active',
      phone text,
      document_type text,
      document_number text,
      company_name text,
      tax_id text,
      last_login_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT users_auth_provider_check CHECK (auth_provider IN ('auth0')),
      CONSTRAINT users_role_check CHECK (role IN ('admin', 'operator', 'client', 'driver')),
      CONSTRAINT users_client_type_check CHECK (client_type IS NULL OR client_type IN ('individual', 'company')),
      CONSTRAINT users_client_type_role_check CHECK (
        (role = 'client' AND client_type IS NOT NULL)
        OR (role <> 'client' AND client_type IS NULL)
      ),
      CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'disabled'))
    );
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_provider_subject_unique
      ON users (auth_provider, auth_subject);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
      ON users (lower(email));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS users_role_status_idx
      ON users (role, status);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS auth_audit_logs (
      id uuid PRIMARY KEY,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      event_type text NOT NULL,
      decision text NOT NULL,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      auth_subject text,
      email text,
      role text,
      client_type text,
      method text,
      path text,
      status_code integer,
      ip_address text,
      user_agent text,
      correlation_id text,
      reason text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT auth_audit_event_type_check CHECK (
        event_type IN (
          'registration_success',
          'registration_failure',
          'token_accepted',
          'token_rejected',
          'access_denied',
          'status_changed',
          'profile_updated'
        )
      ),
      CONSTRAINT auth_audit_decision_check CHECK (
        decision IN ('authorized', 'denied', 'failed', 'success')
      )
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS auth_audit_logs_occurred_at_idx
      ON auth_audit_logs (occurred_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS auth_audit_logs_user_id_idx
      ON auth_audit_logs (user_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS auth_audit_logs_email_idx
      ON auth_audit_logs (lower(email));
  `);
}
