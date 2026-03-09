-- Proactive intelligence layer: push subscriptions + daily digest log

-- Store web push subscriptions (one per browser endpoint per user)
CREATE TABLE push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth_key   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Track daily digest sends — prevents double-sending per user per day
CREATE TABLE daily_digest_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_date date NOT NULL DEFAULT current_date,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  digest_text text,
  UNIQUE (user_id, digest_date)
);

ALTER TABLE daily_digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns daily_digest_log"
  ON daily_digest_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
