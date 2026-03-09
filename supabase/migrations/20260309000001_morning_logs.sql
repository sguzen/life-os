-- Morning Check-In logs
-- One row per user per day — stores vitals, readiness scores, and the cached AI briefing.

CREATE TABLE morning_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date        date NOT NULL DEFAULT current_date,

  -- Vitals
  resting_hr_bpm  smallint,
  sleep_hours     numeric(3,1),
  sleep_quality   smallint CHECK (sleep_quality BETWEEN 1 AND 5),

  -- Readiness
  energy_level    smallint CHECK (energy_level BETWEEN 1 AND 5),
  mood            smallint CHECK (mood BETWEEN 1 AND 5),
  body_readiness  smallint CHECK (body_readiness BETWEEN 1 AND 5),

  -- Sleep details
  woke_easily     boolean,
  had_dreams      boolean,
  dream_quality   text CHECK (dream_quality IN ('good','neutral','bad','nightmare')),

  -- Free text
  notes           text,

  -- Stored AI briefing so it doesn't re-generate on re-open
  ai_briefing     text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, log_date)
);

ALTER TABLE morning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns morning_logs"
  ON morning_logs FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER morning_logs_updated_at
  BEFORE UPDATE ON morning_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
