-- AI-driven adapt events
-- Separate from adaptation_events (manual user-reported illness/injury/fatigue).
-- adapt_events are fired automatically by data patterns and carry AI-generated proposals.

CREATE TABLE IF NOT EXISTS adapt_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'proposed', 'approved', 'rejected')),
  proposal     jsonb,           -- AI-generated array of proposed changes
  proposal_at  timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE adapt_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns adapt_events"
  ON adapt_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX adapt_events_user_status_idx
  ON adapt_events (user_id, status, created_at DESC);
