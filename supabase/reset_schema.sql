-- ============================================================
-- Life OS — Full Reset Schema
-- Run this on a FRESH / WIPED Supabase database.
-- Paste into the Supabase SQL editor and execute once.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Shared updated_at trigger function ────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE instrument      AS ENUM ('NQ', 'Gold', 'CL', '6E', 'ES');
CREATE TYPE trade_direction AS ENUM ('long', 'short');
CREATE TYPE trade_outcome   AS ENUM ('win', 'loss', 'break_even', 'open');
CREATE TYPE prop_firm       AS ENUM ('FundedNext', 'AlphaFutures', 'TakeProfitTrader', 'YRM');
CREATE TYPE trading_session AS ENUM ('london', 'new_york_am', 'new_york_pm', 'overnight', 'asia');
CREATE TYPE mood_rating     AS ENUM ('1', '2', '3', '4', '5');
CREATE TYPE workout_type    AS ENUM ('easy','long_run','tempo','threshold','interval','recovery','race','other');

-- ============================================================
-- AUTH LAYER
-- profiles: thin extension of auth.users
-- ============================================================

CREATE TABLE public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT        UNIQUE,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: owner" ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- LIFE OS CORE
-- user_profiles, user_goals, daily_logs, user_insights,
-- user_dashboards, coach_conversations, coach_tasks
-- ============================================================

-- ── user_profiles ─────────────────────────────────────────────
CREATE TABLE public.user_profiles (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_context       TEXT,
  setup_completed  BOOLEAN     NOT NULL DEFAULT false,
  weekly_summaries TEXT,
  ai_preferences   JSONB       NOT NULL DEFAULT '{"overrides": {}}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_profiles: owner" ON public.user_profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- ── user_goals ────────────────────────────────────────────────
CREATE TABLE public.user_goals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category       TEXT        NOT NULL CHECK (category IN ('training','nutrition','work','hobby','morning')),
  title          TEXT        NOT NULL,
  description    TEXT,
  target_metrics JSONB       NOT NULL DEFAULT '{}',
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_goals: owner" ON public.user_goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_goals_user_category ON public.user_goals (user_id, category);

CREATE TRIGGER user_goals_updated_at
  BEFORE UPDATE ON public.user_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── daily_logs ────────────────────────────────────────────────
-- The flexible JSONB log for all domains (training, nutrition, work, hobby, morning).
-- embedding: pgvector for semantic retrieval of journal notes.
-- hrv_numeric: generated column for fast HRV range queries without JSONB deserialization.

CREATE TABLE public.daily_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category       TEXT        NOT NULL CHECK (category IN ('training','nutrition','work','hobby','morning')),
  date           DATE        NOT NULL,
  metrics        JSONB       NOT NULL DEFAULT '{}',
  journal_notes  TEXT,
  embedding      vector(1536),
  hrv_numeric    NUMERIC     GENERATED ALWAYS AS ((metrics->>'hrv')::numeric) STORED,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_logs: owner" ON public.daily_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX daily_logs_user_category_date ON public.daily_logs (user_id, category, date DESC);
CREATE UNIQUE INDEX daily_logs_unique_day   ON public.daily_logs (user_id, category, date);
CREATE INDEX daily_logs_hrv_numeric        ON public.daily_logs (user_id, hrv_numeric) WHERE hrv_numeric IS NOT NULL;
CREATE INDEX daily_logs_embedding_ivfflat
  ON public.daily_logs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── user_insights ─────────────────────────────────────────────
-- Mathematical correlation facts produced by background CRON jobs.

CREATE TABLE public.user_insights (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_text          TEXT        NOT NULL,
  confidence            NUMERIC     CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metric_a              TEXT,
  metric_b              TEXT,
  coefficient           NUMERIC,
  p_value               NUMERIC,
  confounding_variables JSONB,
  actionable            BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_insights: owner" ON public.user_insights FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_insights_user_created  ON public.user_insights (user_id, created_at DESC);
CREATE INDEX user_insights_actionable    ON public.user_insights (user_id, actionable, created_at DESC);

-- ── user_dashboards ───────────────────────────────────────────
CREATE TABLE public.user_dashboards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_config JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_dashboards: owner" ON public.user_dashboards FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_dashboards_user ON public.user_dashboards (user_id);

CREATE TRIGGER user_dashboards_updated_at
  BEFORE UPDATE ON public.user_dashboards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── coach_conversations ───────────────────────────────────────
CREATE TABLE public.coach_conversations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id       UUID        NOT NULL DEFAULT gen_random_uuid(),
  role             TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content          TEXT        NOT NULL,
  tool_calls       JSONB,
  context_snapshot JSONB,
  embedding        vector(1536),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_conversations: owner" ON public.coach_conversations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX coach_conversations_user_created ON public.coach_conversations (user_id, created_at DESC);

-- ── coach_tasks ───────────────────────────────────────────────
-- status lifecycle: pending → completed | dismissed
-- 'dismissed' signals the app layer to increment ai_preferences.overrides[task_text]

CREATE TABLE public.coach_tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  notes            TEXT,
  due_date         DATE,
  due_time         TIME,
  recurrence       TEXT        NOT NULL DEFAULT 'none'
                               CHECK (recurrence IN ('none','daily','weekly','weekdays')),
  module           TEXT        CHECK (module IN ('general','training','nutrition','trading','health','personal')),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','completed','dismissed')),
  completed_at     TIMESTAMPTZ,
  snoozed_until    DATE,
  source           TEXT        NOT NULL DEFAULT 'user'
                               CHECK (source IN ('user','ai_coach')),
  coach_context    TEXT,
  confidence_score NUMERIC,
  rationale        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_tasks: owner" ON public.coach_tasks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX coach_tasks_user_due    ON public.coach_tasks (user_id, due_date, status);
CREATE INDEX coach_tasks_pending_ai  ON public.coach_tasks (user_id, confidence_score DESC)
  WHERE status = 'pending' AND source = 'ai_coach';

CREATE OR REPLACE FUNCTION public.sync_coach_task_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
  END IF;
  IF NEW.status IN ('pending', 'dismissed') THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER coach_tasks_sync_status
  BEFORE UPDATE ON public.coach_tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_coach_task_status();

CREATE TRIGGER coach_tasks_updated_at
  BEFORE UPDATE ON public.coach_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- HABITS
-- ============================================================

CREATE TABLE public.habits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  category     TEXT        NOT NULL DEFAULT 'general',
  frequency    TEXT        NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  target_count INT         NOT NULL DEFAULT 1 CHECK (target_count >= 1),
  color        TEXT        NOT NULL DEFAULT '#6366f1',
  icon         TEXT,
  is_archived  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habits: owner" ON public.habits FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.habit_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID        NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  logged_at  DATE        NOT NULL DEFAULT current_date,
  count      INT         NOT NULL DEFAULT 1 CHECK (count >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (habit_id, logged_at)
);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habit_logs: owner" ON public.habit_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX habit_logs_habit_logged ON public.habit_logs (habit_id, logged_at DESC);

-- ============================================================
-- TRADING
-- ============================================================

CREATE TABLE public.prop_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm             prop_firm   NOT NULL,
  account_label    TEXT        NOT NULL,
  account_size     NUMERIC(14,2) NOT NULL,
  balance          NUMERIC(14,2),
  daily_loss_limit NUMERIC(14,2),
  max_drawdown     NUMERIC(14,2),
  profit_target    NUMERIC(14,2),
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  is_funded        BOOLEAN     NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prop_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prop_accounts: owner" ON public.prop_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER prop_accounts_updated_at
  BEFORE UPDATE ON public.prop_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.strategies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  rules       TEXT,
  instruments instrument[],
  timeframes  TEXT[],
  tags        TEXT[],
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategies: owner" ON public.strategies FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER strategies_updated_at
  BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.trades (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prop_account_id  UUID           REFERENCES public.prop_accounts(id) ON DELETE SET NULL,
  strategy_id      UUID           REFERENCES public.strategies(id) ON DELETE SET NULL,
  instrument       instrument     NOT NULL,
  direction        trade_direction NOT NULL,
  entry_price      NUMERIC(14,5)  NOT NULL,
  exit_price       NUMERIC(14,5),
  contracts        NUMERIC(10,2)  NOT NULL DEFAULT 1,
  entry_time       TIMESTAMPTZ    NOT NULL,
  exit_time        TIMESTAMPTZ,
  gross_pnl        NUMERIC(14,2),
  fees             NUMERIC(14,2)  NOT NULL DEFAULT 0,
  net_pnl          NUMERIC(14,2)  GENERATED ALWAYS AS (
                     CASE WHEN gross_pnl IS NOT NULL THEN gross_pnl - fees ELSE NULL END
                   ) STORED,
  outcome          trade_outcome  NOT NULL DEFAULT 'open',
  session          trading_session,
  setup_tags       TEXT[],
  confluence_notes TEXT,
  entry_notes      TEXT,
  exit_notes       TEXT,
  lessons          TEXT,
  screenshots      TEXT[],
  pre_emotion      TEXT,
  post_emotion     TEXT,
  followed_rules   BOOLEAN,
  is_reviewed      BOOLEAN        NOT NULL DEFAULT false,
  -- Tradovate import columns
  position_id      TEXT,
  pair_id          TEXT,
  contract         TEXT,
  exchange_fee     DECIMAL(10,4),
  clearing_fee     DECIMAL(10,4),
  nfa_fee          DECIMAL(10,4),
  commission       DECIMAL(10,4),
  total_fees       DECIMAL(10,4),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades: owner" ON public.trades FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX trades_user_entry_time ON public.trades (user_id, entry_time DESC);
CREATE INDEX trades_user_instrument ON public.trades (user_id, instrument);
CREATE INDEX trades_user_outcome    ON public.trades (user_id, outcome);
CREATE UNIQUE INDEX trades_user_pair_id ON public.trades (user_id, pair_id) WHERE pair_id IS NOT NULL;

CREATE TABLE public.trading_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date      DATE        NOT NULL,
  pre_market_notes  TEXT,
  mood_before       mood_rating,
  plan              TEXT,
  post_market_notes TEXT,
  mood_after        mood_rating,
  lessons           TEXT,
  followed_plan     BOOLEAN,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_date)
);

ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trading_sessions: owner" ON public.trading_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trading_sessions_updated_at
  BEFORE UPDATE ON public.trading_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX trading_sessions_user_date ON public.trading_sessions (user_id, session_date DESC);

-- ============================================================
-- ATHLETICS
-- ============================================================

CREATE TABLE public.running_activities (
  id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at                 TIMESTAMPTZ  NOT NULL,
  name                       TEXT,
  workout_type               workout_type NOT NULL DEFAULT 'easy',
  distance_meters            NUMERIC      NOT NULL,
  duration_seconds           INT          NOT NULL,
  avg_pace_sec_per_km        NUMERIC,
  prescribed_pace_sec_per_km NUMERIC,
  avg_hr                     INT,
  max_hr                     INT,
  resting_hr                 INT,
  elevation_gain_m           NUMERIC,
  elevation_loss_m           NUMERIC,
  avg_cadence                NUMERIC,
  avg_stride_length_m        NUMERIC,
  calories                   INT,
  notes                      TEXT,
  fit_filename               TEXT,
  scheduled_workout_id       UUID,        -- FK added after training_schedule
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.running_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "running_activities: owner" ON public.running_activities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER running_activities_updated_at
  BEFORE UPDATE ON public.running_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX running_activities_user_started ON public.running_activities (user_id, started_at DESC);

CREATE TABLE public.running_laps (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id         UUID        NOT NULL REFERENCES public.running_activities(id) ON DELETE CASCADE,
  lap_number          INT         NOT NULL,
  start_time          TIMESTAMPTZ,
  distance_meters     NUMERIC     NOT NULL,
  duration_seconds    INT         NOT NULL,
  avg_pace_sec_per_km NUMERIC,
  avg_hr              INT,
  max_hr              INT,
  elevation_gain_m    NUMERIC,
  avg_cadence         NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activity_id, lap_number)
);

ALTER TABLE public.running_laps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "running_laps: owner" ON public.running_laps FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX running_laps_activity ON public.running_laps (activity_id, lap_number);

CREATE TABLE public.resting_hr_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  resting_hr   INT         NOT NULL,
  source       TEXT        NOT NULL DEFAULT 'garmin' CHECK (source IN ('garmin','manual')),
  is_spike     BOOLEAN     NOT NULL DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, logged_date)
);

ALTER TABLE public.resting_hr_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resting_hr_logs: owner" ON public.resting_hr_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.race_targets (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_name              TEXT    NOT NULL,
  location               TEXT,
  race_date              DATE    NOT NULL,
  distance_km            NUMERIC NOT NULL,
  target_time_seconds    INT     NOT NULL,
  target_pace_sec_per_km NUMERIC GENERATED ALWAYS AS (
    CASE WHEN distance_km > 0 THEN target_time_seconds::numeric / distance_km ELSE NULL END
  ) STORED,
  actual_time_seconds    INT,
  activity_id            UUID    REFERENCES public.running_activities(id) ON DELETE SET NULL,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.race_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "race_targets: owner" ON public.race_targets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER race_targets_updated_at
  BEFORE UPDATE ON public.race_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.training_schedule (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  target_distance DECIMAL(6,2),
  target_pace     TEXT,
  type            TEXT        NOT NULL DEFAULT 'base'
                              CHECK (type IN ('base','interval','long','rest','race')),
  week_number     INT,
  day_of_week     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_schedule: owner" ON public.training_schedule FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX training_schedule_user_date ON public.training_schedule (user_id, date);

-- Now add the FK from running_activities → training_schedule
ALTER TABLE public.running_activities
  ADD CONSTRAINT running_activities_schedule_fk
  FOREIGN KEY (scheduled_workout_id) REFERENCES public.training_schedule(id) ON DELETE SET NULL;

CREATE INDEX running_activities_schedule_id
  ON public.running_activities (user_id, scheduled_workout_id)
  WHERE scheduled_workout_id IS NOT NULL;

-- Marathon plan tables
CREATE TABLE public.training_weeks (
  id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number             INT     NOT NULL CHECK (week_number BETWEEN 1 AND 9),
  week_label              TEXT    NOT NULL,
  week_type               TEXT    NOT NULL DEFAULT 'normal'
    CHECK (week_type IN ('normal','limassol','post_limassol','peak','taper')),
  planned_km              NUMERIC(5,1),
  actual_km               NUMERIC(5,1) DEFAULT 0,
  status                  TEXT    NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','in_progress','completed')),
  blood_donation_recovery BOOLEAN NOT NULL DEFAULT false,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_number)
);

ALTER TABLE public.training_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_weeks: owner" ON public.training_weeks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.training_sessions (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date          DATE    NOT NULL,
  week_number           INT     NOT NULL,
  day_of_week           TEXT    NOT NULL,
  planned_type          TEXT    NOT NULL
    CHECK (planned_type IN ('EASY','VO2_MAX','TEMPO','HILLS','LONG_RUN','REST','RACE','SHAKEOUT')),
  planned_description   TEXT,
  planned_km            NUMERIC(5,1),
  planned_pace_min      TEXT,
  planned_pace_max      TEXT,
  has_strength          BOOLEAN NOT NULL DEFAULT false,
  strength_workout      TEXT    CHECK (strength_workout IN ('A','B')),
  status                TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','skipped','modified')),
  actual_km             NUMERIC(5,1),
  actual_avg_pace       TEXT,
  actual_avg_hr         INT,
  actual_duration_min   INT,
  pace_target_met       BOOLEAN,
  pace_deviation_sec    INT,
  warmup_done           BOOLEAN,
  post_fuel_done        BOOLEAN,
  perceived_effort      INT     CHECK (perceived_effort BETWEEN 1 AND 10),
  went_too_fast         BOOLEAN NOT NULL DEFAULT false,
  skipped_warmup        BOOLEAN NOT NULL DEFAULT false,
  notes                 TEXT,
  ai_feedback           TEXT,
  coach_notes           TEXT,
  flag                  TEXT    CHECK (flag IN ('ok','warning','rest')),
  resting_hr            INT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_date)
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_sessions: owner" ON public.training_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER training_sessions_updated_at
  BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX training_sessions_user_date ON public.training_sessions (user_id, session_date DESC);
CREATE INDEX training_sessions_user_week ON public.training_sessions (user_id, week_number);

CREATE TABLE public.race_results (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_date           DATE    NOT NULL,
  race_name           TEXT    NOT NULL,
  distance_km         NUMERIC(5,2),
  finish_time         TEXT,
  finish_time_seconds INT,
  avg_pace            TEXT,
  official            BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  ai_debrief          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, race_date)
);

ALTER TABLE public.race_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "race_results: owner" ON public.race_results FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- MORNING LOGS
-- ============================================================

CREATE TABLE public.morning_logs (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date       DATE     NOT NULL DEFAULT current_date,
  resting_hr_bpm SMALLINT,
  sleep_hours    NUMERIC(3,1),
  sleep_quality  SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  energy_level   SMALLINT CHECK (energy_level BETWEEN 1 AND 5),
  mood           SMALLINT CHECK (mood BETWEEN 1 AND 5),
  body_readiness SMALLINT CHECK (body_readiness BETWEEN 1 AND 5),
  woke_easily    BOOLEAN,
  had_dreams     BOOLEAN,
  dream_quality  TEXT     CHECK (dream_quality IN ('good','neutral','bad','nightmare')),
  notes          TEXT,
  ai_briefing    TEXT,
  -- Legacy fields from master_schema (kept for compat)
  hrv            INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.morning_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "morning_logs: owner" ON public.morning_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER morning_logs_updated_at
  BEFORE UPDATE ON public.morning_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- NUTRITION & SUPPLEMENTS
-- ============================================================

CREATE TABLE public.meals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_type    TEXT        NOT NULL CHECK (day_type IN ('training','rest')),
  meal_name   TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  icon        TEXT        NOT NULL DEFAULT '🍽️',
  description TEXT,
  calories    INT,
  protein     DECIMAL(5,1),
  carbs       DECIMAL(5,1),
  fats        DECIMAL(5,1),
  order_index INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meals: owner" ON public.meals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX meals_user_day_type ON public.meals (user_id, day_type, order_index);

CREATE TRIGGER meals_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.meal_changes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id        UUID        NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by     TEXT        NOT NULL DEFAULT 'user',
  previous_value JSONB,
  new_value      JSONB,
  reason         TEXT
);

ALTER TABLE public.meal_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_changes: owner" ON public.meal_changes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.supplements (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    TEXT        NOT NULL,
  brand                   TEXT,
  dose_amount             DECIMAL(8,2),
  dose_unit               TEXT,
  dose_count              DECIMAL(4,1) DEFAULT 1,
  frequency               TEXT        NOT NULL DEFAULT 'daily',
  frequency_days          JSONB,
  frequency_times_per_week INT,
  timing                  TEXT,
  timing_notes            TEXT,
  take_with_food          BOOLEAN     DEFAULT false,
  has_duration            BOOLEAN     DEFAULT false,
  start_date              DATE,
  end_date                DATE,
  duration_days           INT,
  duration_notes          TEXT,
  is_active               BOOLEAN     DEFAULT true,
  is_paused               BOOLEAN     DEFAULT false,
  pause_reason            TEXT,
  paused_at               DATE,
  resume_at               DATE,
  prescribed_by           TEXT,
  prescribed_for          TEXT,
  notes                   TEXT,
  blood_donation_override BOOLEAN     DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplements: owner" ON public.supplements FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER supplements_updated_at
  BEFORE UPDATE ON public.supplements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.supplement_log_entries (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id  UUID        NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
  log_date       DATE        NOT NULL,
  taken          BOOLEAN     DEFAULT false,
  taken_at       TIMESTAMPTZ,
  skipped_reason TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, supplement_id, log_date)
);

ALTER TABLE public.supplement_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplement_log_entries: owner" ON public.supplement_log_entries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.supplement_changes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_id  UUID        NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at     TIMESTAMPTZ DEFAULT now(),
  change_type    TEXT,
  previous_value JSONB,
  new_value      JSONB,
  reason         TEXT,
  changed_by     TEXT        DEFAULT 'user'
);

ALTER TABLE public.supplement_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplement_changes: owner" ON public.supplement_changes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PLAN CONFIGS + AUDIT
-- ============================================================

CREATE TABLE public.plan_configs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module           TEXT        NOT NULL,
  config_key       TEXT        NOT NULL,
  config_label     TEXT        NOT NULL,
  config_value     TEXT        NOT NULL,
  config_type      TEXT        NOT NULL,
  config_unit      TEXT,
  description      TEXT,
  editable_by_user BOOLEAN     DEFAULT true,
  editable_by_ai   BOOLEAN     DEFAULT true,
  last_changed_at  TIMESTAMPTZ,
  last_changed_by  TEXT,
  change_reason    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, module, config_key)
);

ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_configs: owner" ON public.plan_configs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.plan_audit_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at            TIMESTAMPTZ DEFAULT now(),
  module                TEXT        NOT NULL,
  entity_type           TEXT        NOT NULL,
  entity_description    TEXT,
  action                TEXT        NOT NULL,
  field_changed         TEXT,
  previous_value        TEXT,
  new_value             TEXT,
  reason                TEXT,
  changed_by            TEXT        NOT NULL,
  coach_conversation_id TEXT
);

ALTER TABLE public.plan_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_audit_log: owner" ON public.plan_audit_log FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ADAPTATION ENGINE
-- ============================================================

CREATE TABLE public.adaptation_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  trigger_type          TEXT        NOT NULL
    CHECK (trigger_type IN ('illness','injury','fatigue','poor_sleep')),
  severity              INT         NOT NULL CHECK (severity BETWEEN 1 AND 5),
  symptoms              TEXT,
  affected_body_part    TEXT,
  sleep_hours           NUMERIC(3,1),
  resting_hr            INT,
  estimated_days        INT,
  status                TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','adjustments_proposed','approved','rejected','recovered')),
  ai_triage             TEXT,
  ai_generated_at       TIMESTAMPTZ,
  recovery_confirmed_at TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.adaptation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adaptation_events: owner" ON public.adaptation_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX adaptation_events_user     ON public.adaptation_events (user_id, reported_at DESC);
CREATE INDEX adaptation_events_status   ON public.adaptation_events (user_id, status)
  WHERE status NOT IN ('rejected','recovered');

CREATE TABLE public.adaptation_adjustments (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID    NOT NULL REFERENCES public.adaptation_events(id) ON DELETE CASCADE,
  user_id            UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module             TEXT    NOT NULL CHECK (module IN ('marathon','nutrition','trading')),
  target_date        DATE    NOT NULL,
  target_id          UUID,
  target_description TEXT,
  change_type        TEXT    NOT NULL,
  original_value     JSONB,
  adjusted_value     JSONB,
  reasoning          TEXT,
  approved           BOOLEAN,
  applied_at         TIMESTAMPTZ,
  user_override      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.adaptation_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adaptation_adjustments: owner" ON public.adaptation_adjustments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.recovery_checkins (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID    NOT NULL REFERENCES public.adaptation_events(id) ON DELETE CASCADE,
  user_id           UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date      DATE    NOT NULL,
  feeling_score     INT     NOT NULL CHECK (feeling_score BETWEEN 1 AND 10),
  symptoms_present  BOOLEAN,
  resting_hr        INT,
  notes             TEXT,
  ai_recommendation TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, checkin_date)
);

ALTER TABLE public.recovery_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery_checkins: owner" ON public.recovery_checkins FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI-driven adapt events (separate from manual adaptation_events)
CREATE TABLE public.adapt_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','proposed','approved','rejected')),
  proposal    JSONB,
  proposal_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.adapt_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adapt_events: owner" ON public.adapt_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX adapt_events_user_status ON public.adapt_events (user_id, status, created_at DESC);

-- ============================================================
-- BOOKSHELF + PROJECTS
-- ============================================================

CREATE TABLE public.books (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  author      TEXT,
  isbn        TEXT,
  status      TEXT        NOT NULL DEFAULT 'want-to-read'
              CHECK (status IN ('want-to-read','reading','done','abandoned')),
  rating      INT         CHECK (rating >= 1 AND rating <= 5),
  notes       TEXT,
  started_at  DATE,
  finished_at DATE,
  cover_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books: owner" ON public.books FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX books_user_status ON public.books (user_id, status);

CREATE TABLE public.projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  status      TEXT        NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','paused','done','abandoned')),
  color       TEXT        NOT NULL DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects: owner" ON public.projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.project_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'todo'
             CHECK (status IN ('todo','in_progress','done')),
  notes      TEXT,
  position   INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_tasks: owner" ON public.project_tasks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX project_tasks_project_position ON public.project_tasks (project_id, position);

-- ============================================================
-- PUSH NOTIFICATIONS
-- ============================================================

CREATE TABLE public.push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth_key   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions: owner" ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_digest_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_date DATE        NOT NULL DEFAULT current_date,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  digest_text TEXT,
  UNIQUE (user_id, digest_date)
);

ALTER TABLE public.daily_digest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_digest_log: owner" ON public.daily_digest_log FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
