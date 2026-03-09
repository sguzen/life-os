-- Coach Tasks — tasks/reminders creatable by both user and AI coach.
-- One row per task; completion sets completed_at (never deleted).

CREATE TABLE coach_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  notes         text,
  -- Scheduling
  due_date      date,
  due_time      time,
  recurrence    text NOT NULL DEFAULT 'none'
                CHECK (recurrence IN ('none', 'daily', 'weekly', 'weekdays')),
  -- Categorisation
  module        text CHECK (module IN
                  ('general', 'training', 'nutrition', 'trading', 'health', 'personal')),
  -- State
  completed_at  timestamptz,
  snoozed_until date,
  -- Origin
  source        text NOT NULL DEFAULT 'user'
                CHECK (source IN ('user', 'ai_coach')),
  coach_context text,   -- why the coach created it (for transparency)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns coach_tasks"
  ON coach_tasks FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER coach_tasks_updated_at
  BEFORE UPDATE ON coach_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Fast lookup: user's pending tasks ordered by due date
CREATE INDEX coach_tasks_user_due ON coach_tasks (user_id, due_date, completed_at);
