-- Trading Accountability System — Database Schema
-- Run these in Supabase SQL editor

-- ── Challenge configuration ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trading_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  account_size DECIMAL(12,2) NOT NULL,
  daily_loss_limit DECIMAL(10,2) NOT NULL,
  max_drawdown DECIMAL(10,2) NOT NULL,
  profit_target DECIMAL(10,2) NOT NULL,
  trailing_drawdown BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trading_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trading_challenges: user owns rows" ON trading_challenges
  FOR ALL USING (auth.uid() = user_id);

-- ── Daily accountability session ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accountability_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  challenge_id UUID REFERENCES trading_challenges,

  -- Pre-session gate
  sleep_hours DECIMAL(3,1),
  physical_score INTEGER CHECK (physical_score BETWEEN 1 AND 10),
  emotional_score INTEGER CHECK (emotional_score BETWEEN 1 AND 10),
  alcohol_last_night BOOLEAN,
  gate_passed BOOLEAN,
  gate_ai_response TEXT,

  -- Guardrails
  consecutive_losses INTEGER DEFAULT 0,
  revenge_lock_triggered BOOLEAN DEFAULT false,
  external_influence_flagged BOOLEAN DEFAULT false,

  -- EOD
  net_pnl DECIMAL(10,2),
  eod_ai_response TEXT,
  eod_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, session_date)
);

ALTER TABLE accountability_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accountability_sessions: user owns rows" ON accountability_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ── Individual trade plans ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES accountability_sessions NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  plan_number INTEGER NOT NULL CHECK (plan_number IN (1, 2)),

  instrument TEXT NOT NULL CHECK (instrument IN ('MNQ', 'MGC', 'MES')),
  direction TEXT NOT NULL CHECK (direction IN ('Long', 'Short')),
  session_window TEXT NOT NULL CHECK (session_window IN ('London', 'NY_AM', 'NY_PM')),

  -- ICT setup (all required)
  htf_bias TEXT NOT NULL,
  setup_type TEXT NOT NULL,
  pd_array TEXT NOT NULL,
  confluence TEXT NOT NULL,
  entry_price DECIMAL(12,4),
  stop_loss DECIMAL(12,4),
  target_1 DECIMAL(12,4),
  target_2 DECIMAL(12,4),
  risk_dollars DECIMAL(8,2),

  -- AI validation
  plan_ai_response TEXT,
  conviction_lock BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trade_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_plans: user owns rows" ON trade_plans
  FOR ALL USING (auth.uid() = user_id);

-- ── Trade reviews ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES trade_plans NOT NULL,
  session_id UUID REFERENCES accountability_sessions NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,

  outcome TEXT NOT NULL CHECK (outcome IN ('Win', 'Loss', 'Breakeven', 'Partial')),
  actual_entry DECIMAL(12,4),
  actual_exit DECIMAL(12,4),
  actual_pnl DECIMAL(10,2),
  execution_quality INTEGER CHECK (execution_quality BETWEEN 1 AND 10),

  -- Guardrails
  followed_plan BOOLEAN NOT NULL,
  external_influence BOOLEAN DEFAULT false,
  external_influence_details TEXT,

  -- Notes
  what_went_right TEXT,
  what_went_wrong TEXT,
  lesson TEXT,

  review_ai_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trade_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_reviews: user owns rows" ON trade_reviews
  FOR ALL USING (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_accountability_sessions_user_date
  ON accountability_sessions(user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_trade_plans_session
  ON trade_plans(session_id);

CREATE INDEX IF NOT EXISTS idx_trade_reviews_plan
  ON trade_reviews(plan_id);

CREATE INDEX IF NOT EXISTS idx_trade_reviews_session
  ON trade_reviews(session_id);
