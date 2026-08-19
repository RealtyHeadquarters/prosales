-- ProSales Tracking App — database schema
-- Safe to run multiple times (idempotent-ish): uses IF NOT EXISTS / DO blocks.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'sales');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE client_status AS ENUM ('lead', 'active', 'inactive', 'converted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE visit_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Users (sales reps, managers, admins) ----------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'sales',
  manager_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Attendance (daily login/logout time) ----------
CREATE TABLE IF NOT EXISTS attendance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_at    TIMESTAMPTZ,
  check_in_lat   DOUBLE PRECISION,
  check_in_lng   DOUBLE PRECISION,
  check_out_at   TIMESTAMPTZ,
  check_out_lat  DOUBLE PRECISION,
  check_out_lng  DOUBLE PRECISION,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);

-- ---------- Location pings (live GPS tracking) ----------
CREATE TABLE IF NOT EXISTS location_pings (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,
  speed       DOUBLE PRECISION,
  battery     INT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_location_user_time ON location_pings (user_id, recorded_at DESC);

-- ---------- Clients (CRM) ----------
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  company     TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  status      client_status NOT NULL DEFAULT 'lead',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients (assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients (status);

-- ---------- Visits (client meetings + meeting details) ----------
CREATE TABLE IF NOT EXISTS visits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         visit_status NOT NULL DEFAULT 'completed',
  purpose        TEXT,
  notes          TEXT,          -- meeting detail
  outcome        TEXT,
  check_in_at    TIMESTAMPTZ,
  check_out_at   TIMESTAMPTZ,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  next_follow_up DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visits_user_time ON visits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_client ON visits (client_id);

-- ---------- Visit photos (geo-tagged uploads) ----------
CREATE TABLE IF NOT EXISTS visit_photos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id  UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  lat       DOUBLE PRECISION,
  lng       DOUBLE PRECISION,
  taken_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_visit ON visit_photos (visit_id);

-- =====================================================================
-- Phase 1.5 — Field Force extensions
-- =====================================================================

-- ---------- App settings (singleton row) ----------
CREATE TABLE IF NOT EXISTS app_settings (
  id                        INT PRIMARY KEY DEFAULT 1,
  geofence_enforce          BOOLEAN NOT NULL DEFAULT TRUE,
  default_geofence_radius_m INT NOT NULL DEFAULT 200,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_single_row CHECK (id = 1)
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------- Territories (geo + team mapping) ----------
CREATE TABLE IF NOT EXISTS territories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  center_lat  DOUBLE PRECISION,
  center_lng  DOUBLE PRECISION,
  radius_m    INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS territory_users (
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (territory_id, user_id)
);

-- Link clients + geofencing to the CRM
ALTER TABLE clients ADD COLUMN IF NOT EXISTS territory_id     UUID REFERENCES territories(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS geofence_radius_m INT; -- per-client override; NULL = use default

-- Visit geofence audit + scheduling
ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_at    TIMESTAMPTZ;      -- for planned meetings
ALTER TABLE visits ADD COLUMN IF NOT EXISTS distance_m      DOUBLE PRECISION; -- rep distance from client at log time
ALTER TABLE visits ADD COLUMN IF NOT EXISTS within_geofence BOOLEAN;

-- ---------- Tasks / Day-plan / Follow-ups ----------
DO $$ BEGIN CREATE TYPE task_type AS ENUM ('call', 'meeting', 'todo', 'follow_up');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_status AS ENUM ('pending', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- assignee
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  type         task_type NOT NULL DEFAULT 'todo',
  title        TEXT NOT NULL,
  description  TEXT,
  priority     task_priority NOT NULL DEFAULT 'medium',
  status       task_status NOT NULL DEFAULT 'pending',
  plan_date    DATE,   -- which day it is planned for (day-plan)
  due_date     DATE,   -- deadline / follow-up date
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_plan ON tasks (user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due  ON tasks (user_id, due_date);
