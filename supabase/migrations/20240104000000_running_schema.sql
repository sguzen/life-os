-- ============================================================
-- P4: Garmin + Running Performance Schema
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────

CREATE TYPE workout_type AS ENUM (
  'easy',
  'long_run',
  'tempo',
  'threshold',
  'interval',
  'recovery',
  'race',
  'other'
);

-- ── Tables ──────────────────────────────────────────────────

-- running_activities: one row per uploaded Garmin activity
CREATE TABLE running_activities (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at                timestamptz NOT NULL,
  name                      text,
  workout_type              workout_type NOT NULL DEFAULT 'easy',
  -- distance / time
  distance_meters           numeric NOT NULL,
  duration_seconds          int NOT NULL,
  -- pace (seconds per km)
  avg_pace_sec_per_km       numeric,
  prescribed_pace_sec_per_km numeric,          -- set manually for pace comparison
  -- heart rate
  avg_hr                    int,
  max_hr                    int,
  resting_hr                int,               -- morning/overnight HR if present
  -- elevation
  elevation_gain_m          numeric,
  elevation_loss_m          numeric,
  -- cadence / stride
  avg_cadence               numeric,           -- steps per minute
  avg_stride_length_m       numeric,
  -- other
  calories                  int,
  notes                     text,
  fit_filename              text,              -- original uploaded filename
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- running_laps: one row per lap within an activity
CREATE TABLE running_laps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id         uuid NOT NULL REFERENCES running_activities(id) ON DELETE CASCADE,
  lap_number          int NOT NULL,
  start_time          timestamptz,
  distance_meters     numeric NOT NULL,
  duration_seconds    int NOT NULL,
  avg_pace_sec_per_km numeric,
  avg_hr              int,
  max_hr              int,
  elevation_gain_m    numeric,
  avg_cadence         numeric,
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (activity_id, lap_number)
);

-- resting_hr_logs: daily resting HR (extracted from Garmin or logged manually)
CREATE TABLE resting_hr_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date  date NOT NULL DEFAULT CURRENT_DATE,
  resting_hr   int NOT NULL,
  source       text NOT NULL DEFAULT 'garmin'  CHECK (source IN ('garmin', 'manual')),
  is_spike     boolean NOT NULL DEFAULT false,  -- true when ≥5 bpm above 7-day avg
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, logged_date)
);

-- race_targets: upcoming or completed races with pace targets
CREATE TABLE race_targets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_name            text NOT NULL,
  location             text,
  race_date            date NOT NULL,
  distance_km          numeric NOT NULL,
  target_time_seconds  int NOT NULL,            -- total target race time
  target_pace_sec_per_km numeric GENERATED ALWAYS AS (
    CASE WHEN distance_km > 0
      THEN target_time_seconds::numeric / distance_km
      ELSE NULL
    END
  ) STORED,
  actual_time_seconds  int,                     -- filled after race
  activity_id          uuid REFERENCES running_activities(id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX running_activities_user_started_at_idx
  ON running_activities (user_id, started_at DESC);

CREATE INDEX running_laps_activity_idx
  ON running_laps (activity_id, lap_number);

CREATE INDEX resting_hr_logs_user_date_idx
  ON resting_hr_logs (user_id, logged_date DESC);

CREATE INDEX race_targets_user_date_idx
  ON race_targets (user_id, race_date ASC);

-- ── Triggers (updated_at) ────────────────────────────────────
-- Uses the same set_updated_at() function created in the habits migration.
-- Redeclare with CREATE OR REPLACE so this migration is safe to run standalone.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_running_activities
  BEFORE UPDATE ON running_activities
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_race_targets
  BEFORE UPDATE ON race_targets
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE running_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE running_laps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE resting_hr_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_targets       ENABLE ROW LEVEL SECURITY;

-- running_activities
CREATE POLICY "users manage own activities"
  ON running_activities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- running_laps
CREATE POLICY "users manage own laps"
  ON running_laps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- resting_hr_logs
CREATE POLICY "users manage own resting hr logs"
  ON resting_hr_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- race_targets
CREATE POLICY "users manage own race targets"
  ON race_targets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
