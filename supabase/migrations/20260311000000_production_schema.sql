-- Production schema: pgvector, generated columns, override tracking,
-- and expanded correlation engine tables.
--
-- Fully defensive: every ALTER TABLE is wrapped in a DO $$ existence check.
-- Safe to run regardless of which prior migrations landed.

-- ── 1. Extensions ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. user_profiles — weekly summary + AI override tracking ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_profiles' AND column_name='weekly_summaries') THEN
    ALTER TABLE public.user_profiles ADD COLUMN weekly_summaries TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_profiles' AND column_name='ai_preferences') THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN ai_preferences JSONB NOT NULL DEFAULT '{"overrides": {}}';
  END IF;
END;
$$;

-- ── 3. daily_logs — pgvector embedding + HRV generated column ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='daily_logs' AND column_name='embedding') THEN
    ALTER TABLE public.daily_logs ADD COLUMN embedding vector(1536);
  END IF;

  -- Generated columns have no IF NOT EXISTS syntax — guard manually
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='daily_logs' AND column_name='hrv_numeric') THEN
    ALTER TABLE public.daily_logs
      ADD COLUMN hrv_numeric NUMERIC
        GENERATED ALWAYS AS ((metrics->>'hrv')::numeric) STORED;
  END IF;
END;
$$;

-- IVFFlat index for approximate nearest-neighbour cosine search
CREATE INDEX IF NOT EXISTS daily_logs_embedding_ivfflat
  ON public.daily_logs
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Partial btree on the generated HRV column
CREATE INDEX IF NOT EXISTS daily_logs_hrv_numeric
  ON public.daily_logs (user_id, hrv_numeric)
  WHERE hrv_numeric IS NOT NULL;

-- ── 4. user_insights — full correlation engine schema ─────────────────────────
-- May not exist at all if adaptation_engine migration never ran.

CREATE TABLE IF NOT EXISTS public.user_insights (
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

-- If the table already existed in its thin form, add missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_insights' AND column_name='metric_a') THEN
    ALTER TABLE public.user_insights ADD COLUMN metric_a TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_insights' AND column_name='metric_b') THEN
    ALTER TABLE public.user_insights ADD COLUMN metric_b TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_insights' AND column_name='coefficient') THEN
    ALTER TABLE public.user_insights ADD COLUMN coefficient NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_insights' AND column_name='p_value') THEN
    ALTER TABLE public.user_insights ADD COLUMN p_value NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_insights' AND column_name='confounding_variables') THEN
    ALTER TABLE public.user_insights ADD COLUMN confounding_variables JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_insights' AND column_name='actionable') THEN
    ALTER TABLE public.user_insights ADD COLUMN actionable BOOLEAN NOT NULL DEFAULT false;
  END IF;
END;
$$;

ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='user_insights' AND policyname='user_insights: owner') THEN
    EXECUTE $p$
      CREATE POLICY "user_insights: owner"
        ON public.user_insights FOR ALL
        USING  (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $p$;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS user_insights_actionable
  ON public.user_insights (user_id, actionable, created_at DESC);

-- ── 5. coach_tasks — status, confidence_score, rationale ─────────────────────
-- The master_schema (00000000000000) created coach_tasks with a minimal schema:
--   task_description TEXT, completed BOOLEAN, completed_at TIMESTAMPTZ.
-- Later migrations may have added title/source/confidence_score/rationale.
-- We add only what's missing, then add the new status column.

DO $$
BEGIN
  -- Columns from 20260309000002 that may not exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='coach_tasks' AND column_name='source') THEN
    ALTER TABLE public.coach_tasks
      ADD COLUMN source TEXT NOT NULL DEFAULT 'user'
        CHECK (source IN ('user', 'ai_coach'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='coach_tasks' AND column_name='confidence_score') THEN
    ALTER TABLE public.coach_tasks ADD COLUMN confidence_score NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='coach_tasks' AND column_name='rationale') THEN
    ALTER TABLE public.coach_tasks ADD COLUMN rationale TEXT;
  END IF;

  -- New status column for override tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='coach_tasks' AND column_name='status') THEN
    ALTER TABLE public.coach_tasks
      ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'dismissed'));
  END IF;
END;
$$;

-- Backfill: rows completed via the old completed_at / completed=true paths
UPDATE public.coach_tasks
   SET status = 'completed'
 WHERE status = 'pending'
   AND (completed_at IS NOT NULL OR completed = true);

-- Trigger: keep completed_at in sync when status is set via the new path
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

DROP TRIGGER IF EXISTS coach_tasks_sync_status ON public.coach_tasks;
CREATE TRIGGER coach_tasks_sync_status
  BEFORE UPDATE ON public.coach_tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_coach_task_status();

-- Partial index: pending AI suggestions ranked by confidence
-- Only created once source column exists (guaranteed above)
CREATE INDEX IF NOT EXISTS coach_tasks_pending_ai
  ON public.coach_tasks (user_id, confidence_score DESC)
  WHERE status = 'pending' AND source = 'ai_coach';
