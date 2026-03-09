-- Coach conversation persistence
-- Stores every user ↔ assistant turn so sessions survive page reloads.

CREATE TABLE coach_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL DEFAULT gen_random_uuid(),
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  context_snapshot jsonb,  -- optional: which tools fired, serialised results
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns rows" ON coach_conversations
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fast lookup: user's messages newest-first, for loading history
CREATE INDEX coach_conv_user_created
  ON coach_conversations(user_id, created_at DESC);
