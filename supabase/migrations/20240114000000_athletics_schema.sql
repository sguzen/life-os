-- Athletics Module: training_schedule table + running_activities link
-- Merges the Running and Marathon silos into a unified Athletics module.

-- ── training_schedule ──────────────────────────────────────────────────────
-- Stores the planned training calendar (seeded from the hardcoded 9-week plan).
-- Each row represents one day's session. user_id scoped (RLS) so the same
-- schema supports multiple users.

CREATE TABLE IF NOT EXISTS public.training_schedule (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  title            TEXT        NOT NULL,
  description      TEXT,
  target_distance  DECIMAL(6,2),          -- kilometres
  target_pace      TEXT,                  -- display string e.g. "6:20/km"
  type             TEXT        NOT NULL DEFAULT 'base'
                               CHECK (type IN ('base', 'interval', 'long', 'rest', 'race')),
  week_number      INT,
  day_of_week      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own training schedule"
  ON public.training_schedule FOR ALL
  USING (auth.uid() = user_id);

-- Efficient lookup by date (used on every page load)
CREATE INDEX IF NOT EXISTS training_schedule_user_date
  ON public.training_schedule (user_id, date);

-- ── running_activities: add scheduled_workout_id ───────────────────────────
-- Links a completed Garmin activity back to the planned session it belongs to.
-- Nullable: activities uploaded outside a plan window have no link.

ALTER TABLE public.running_activities
  ADD COLUMN IF NOT EXISTS scheduled_workout_id UUID
  REFERENCES public.training_schedule(id) ON DELETE SET NULL;

-- Index for the reverse lookup (find activity for a given schedule row)
CREATE INDEX IF NOT EXISTS running_activities_schedule_id
  ON public.running_activities (user_id, scheduled_workout_id)
  WHERE scheduled_workout_id IS NOT NULL;
