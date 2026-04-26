-- Adaptation Engine: adds confidence/rationale to coach_tasks,
-- plus user_dashboards (pinned widgets) and user_insights (correlation results).

-- ── coach_tasks: add AI confidence columns ────────────────────────────────────

ALTER TABLE public.coach_tasks
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC,
  ADD COLUMN IF NOT EXISTS rationale TEXT;

-- ── user_dashboards ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_dashboards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_config JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_dashboards: owner select"
  ON public.user_dashboards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_dashboards: owner insert"
  ON public.user_dashboards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_dashboards: owner update"
  ON public.user_dashboards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_dashboards_user ON public.user_dashboards (user_id);

DROP TRIGGER IF EXISTS user_dashboards_updated_at ON public.user_dashboards;
CREATE TRIGGER user_dashboards_updated_at
  BEFORE UPDATE ON public.user_dashboards
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── user_insights ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_text TEXT NOT NULL,
  confidence   NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_insights: owner select"
  ON public.user_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_insights: owner insert"
  ON public.user_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_insights: owner update"
  ON public.user_insights FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_insights_user_created ON public.user_insights (user_id, created_at DESC);
