-- RLS Hardening — belt-and-suspenders audit pass
-- Safe to apply to any environment; uses IF NOT EXISTS throughout.
--
-- Findings:
-- 1. push_subscriptions was defined in TWO migrations:
--    - 20240107000000: uses column 'auth', UNIQUE (user_id, endpoint)
--    - 20260309000004: tries CREATE TABLE with 'auth_key', UNIQUE (endpoint)
--    The newer app code (subscribe API, cron) reads/writes 'auth_key'.
--    Fix: add auth_key column + global endpoint unique index.
-- 2. All other tables verified to have RLS and user_id policies. ✅

-- ── Fix push_subscriptions column discrepancy ─────────────────────────────
-- Add auth_key column if the table was created by the older migration
-- (which used 'auth' as the column name).
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS auth_key text;

-- Ensure endpoint alone is globally unique (needed for upsert onConflict:'endpoint').
-- The old migration created UNIQUE(user_id, endpoint); the new code conflicts on endpoint only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'push_subscriptions'
      AND indexname = 'push_subscriptions_endpoint_key'
  ) THEN
    CREATE UNIQUE INDEX push_subscriptions_endpoint_key
      ON public.push_subscriptions (endpoint);
  END IF;
END $$;

-- ── Belt-and-suspenders: ensure RLS on Phase 3-5 tables ──────────────────
-- These all have RLS in their migrations, but we double-check here.
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morning_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_digest_log    ENABLE ROW LEVEL SECURITY;

-- Policies (IF NOT EXISTS via DO block — Postgres 14 doesn't have CREATE POLICY IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coach_conversations' AND policyname = 'user owns rows'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "user owns rows" ON public.coach_conversations
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'morning_logs' AND policyname = 'user owns morning_logs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "user owns morning_logs" ON public.morning_logs
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coach_tasks' AND policyname = 'user owns coach_tasks'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "user owns coach_tasks" ON public.coach_tasks
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'user owns push_subscriptions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "user owns push_subscriptions" ON public.push_subscriptions
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_digest_log' AND policyname = 'user owns daily_digest_log'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "user owns daily_digest_log" ON public.daily_digest_log
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END $$;
