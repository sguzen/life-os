-- ============================================================
-- Marathon Training Module Schema
-- Belgrade Marathon April 19, 2026 — 9-week plan
-- ============================================================

-- ── training_weeks: one row per week ─────────────────────────

CREATE TABLE training_weeks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number             integer NOT NULL CHECK (week_number BETWEEN 1 AND 9),
  week_label              text NOT NULL,
  week_type               text NOT NULL DEFAULT 'normal'
    CHECK (week_type IN ('normal', 'limassol', 'post_limassol', 'peak', 'taper')),
  planned_km              numeric(5,1),
  actual_km               numeric(5,1) DEFAULT 0,
  status                  text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  blood_donation_recovery boolean NOT NULL DEFAULT false,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, week_number)
);

-- ── training_sessions: one row per planned day ────────────────

CREATE TABLE training_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date          date NOT NULL,
  week_number           integer NOT NULL,
  day_of_week           text NOT NULL,

  -- Planned (from hardcoded plan)
  planned_type          text NOT NULL
    CHECK (planned_type IN ('EASY','VO2_MAX','TEMPO','HILLS','LONG_RUN','REST','RACE','SHAKEOUT')),
  planned_description   text,
  planned_km            numeric(5,1),
  planned_pace_min      text,
  planned_pace_max      text,
  has_strength          boolean NOT NULL DEFAULT false,
  strength_workout      text CHECK (strength_workout IN ('A', 'B')),

  -- Actual (filled post-run)
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','skipped','modified')),
  actual_km             numeric(5,1),
  actual_avg_pace       text,
  actual_avg_hr         integer,
  actual_duration_min   integer,

  -- Pace discipline
  pace_target_met       boolean,
  pace_deviation_sec    integer,

  -- Execution quality
  warmup_done           boolean,
  post_fuel_done        boolean,
  perceived_effort      integer CHECK (perceived_effort BETWEEN 1 AND 10),

  -- Flags
  went_too_fast         boolean NOT NULL DEFAULT false,
  skipped_warmup        boolean NOT NULL DEFAULT false,

  -- Post-run notes + AI
  notes                 text,
  ai_feedback           text,

  -- Morning RHR
  resting_hr            integer,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, session_date)
);

-- ── race_results ──────────────────────────────────────────────

CREATE TABLE race_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_date             date NOT NULL,
  race_name             text NOT NULL,
  distance_km           numeric(5,2),
  finish_time           text,
  finish_time_seconds   integer,
  avg_pace              text,
  official              boolean NOT NULL DEFAULT true,
  notes                 text,
  ai_debrief            text,
  created_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, race_date)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX training_weeks_user_idx
  ON training_weeks (user_id, week_number);

CREATE INDEX training_sessions_user_date_idx
  ON training_sessions (user_id, session_date DESC);

CREATE INDEX training_sessions_user_week_idx
  ON training_sessions (user_id, week_number);

CREATE INDEX race_results_user_date_idx
  ON race_results (user_id, race_date DESC);

-- ── updated_at trigger ────────────────────────────────────────

CREATE TRIGGER set_updated_at_training_sessions
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE training_weeks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own training weeks"
  ON training_weeks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own training sessions"
  ON training_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own race results"
  ON race_results FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
