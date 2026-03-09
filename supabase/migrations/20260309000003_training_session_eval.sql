-- Add coach evaluation fields to training_sessions
-- coach_notes: AI-generated post-session evaluation text
-- flag: traffic-light status from coach evaluation

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS coach_notes text,
  ADD COLUMN IF NOT EXISTS flag text CHECK (flag IN ('ok', 'warning', 'rest'));
