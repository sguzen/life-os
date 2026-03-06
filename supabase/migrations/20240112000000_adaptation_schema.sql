-- ============================================================
-- Adaptive Replanning Engine Schema
-- Cross-module adaptation layer for illness, injury, fatigue, sleep
-- ============================================================

-- ── adaptation_events: each time user reports a trigger ───────

CREATE TABLE adaptation_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_at           timestamptz NOT NULL DEFAULT now(),
  event_date            date NOT NULL DEFAULT CURRENT_DATE,

  -- Trigger type
  trigger_type          text NOT NULL
    CHECK (trigger_type IN ('illness', 'injury', 'fatigue', 'poor_sleep')),

  -- Trigger details
  severity              integer NOT NULL CHECK (severity BETWEEN 1 AND 5),
  symptoms              text,
  affected_body_part    text,
  sleep_hours           numeric(3,1),
  resting_hr            integer,

  -- Duration estimate
  estimated_days        integer,

  -- Status lifecycle
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'adjustments_proposed', 'approved', 'rejected', 'recovered')),

  -- AI assessment
  ai_triage             text,
  ai_generated_at       timestamptz,

  recovery_confirmed_at timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── adaptation_adjustments: individual proposed changes ───────

CREATE TABLE adaptation_adjustments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES adaptation_events(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Module
  module              text NOT NULL
    CHECK (module IN ('marathon', 'nutrition', 'trading')),

  -- Target
  target_date         date NOT NULL,
  target_id           uuid,
  target_description  text,

  -- Change type
  change_type         text NOT NULL,

  -- Values (JSONB for flexibility across modules)
  original_value      jsonb,
  adjusted_value      jsonb,
  reasoning           text,

  -- Approval
  approved            boolean,           -- null = pending, true = approved, false = rejected
  applied_at          timestamptz,
  user_override       text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── recovery_checkins: daily check-ins during adaptation ──────

CREATE TABLE recovery_checkins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES adaptation_events(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date        date NOT NULL,
  feeling_score       integer NOT NULL CHECK (feeling_score BETWEEN 1 AND 10),
  symptoms_present    boolean,
  resting_hr          integer,
  notes               text,
  ai_recommendation   text,
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (event_id, checkin_date)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX adaptation_events_user_idx
  ON adaptation_events (user_id, reported_at DESC);

CREATE INDEX adaptation_events_status_idx
  ON adaptation_events (user_id, status)
  WHERE status NOT IN ('rejected', 'recovered');

CREATE INDEX adaptation_adjustments_event_idx
  ON adaptation_adjustments (event_id, target_date);

CREATE INDEX adaptation_adjustments_user_date_idx
  ON adaptation_adjustments (user_id, target_date);

CREATE INDEX recovery_checkins_event_idx
  ON recovery_checkins (event_id, checkin_date DESC);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE adaptation_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptation_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_checkins      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own adaptation events"
  ON adaptation_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own adaptation adjustments"
  ON adaptation_adjustments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own recovery checkins"
  ON recovery_checkins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
