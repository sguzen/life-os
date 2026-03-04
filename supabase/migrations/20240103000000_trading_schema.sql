-- ============================================================
-- P2: Trading Journal + Strategy Tracker
-- ============================================================
-- Instruments supported: NQ, Gold, CL, 6E
-- Prop firms supported: FundedNext, AlphaFutures, TakeProfitTrader, YRM
-- ============================================================

-- Ensure updated_at trigger function exists (created in habits migration)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE instrument AS ENUM ('NQ', 'Gold', 'CL', '6E');

CREATE TYPE trade_direction AS ENUM ('long', 'short');

CREATE TYPE trade_outcome AS ENUM ('win', 'loss', 'break_even', 'open');

CREATE TYPE prop_firm AS ENUM (
  'FundedNext',
  'AlphaFutures',
  'TakeProfitTrader',
  'YRM'
);

CREATE TYPE trading_session AS ENUM ('london', 'new_york_am', 'new_york_pm', 'overnight', 'asia');

CREATE TYPE mood_rating AS ENUM ('1', '2', '3', '4', '5');

-- ============================================================
-- TABLE: prop_accounts
-- Track funded/prop trading accounts per firm
-- ============================================================

CREATE TABLE prop_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm          prop_firm NOT NULL,
  account_label text NOT NULL,                  -- e.g. "100K Evaluation #1"
  account_size  numeric(14,2) NOT NULL,          -- e.g. 100000
  balance       numeric(14,2),                   -- current balance (optional, manual update)
  daily_loss_limit  numeric(14,2),
  max_drawdown  numeric(14,2),                   -- max trailing or static drawdown
  profit_target numeric(14,2),
  is_active     boolean NOT NULL DEFAULT true,
  is_funded     boolean NOT NULL DEFAULT false,  -- evaluation vs funded
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prop_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prop_accounts"
  ON prop_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER prop_accounts_updated_at
  BEFORE UPDATE ON prop_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: strategies
-- Named trading strategies with rules and applicable instruments
-- ============================================================

CREATE TABLE strategies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  rules       text,                              -- markdown rules / playbook
  instruments instrument[],                      -- which instruments this applies to
  timeframes  text[],                            -- e.g. ['1m','5m','15m']
  tags        text[],
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own strategies"
  ON strategies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER strategies_updated_at
  BEFORE UPDATE ON strategies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: trades
-- Core trade log — one row per executed trade
-- ============================================================

CREATE TABLE trades (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prop_account_id  uuid REFERENCES prop_accounts(id) ON DELETE SET NULL,
  strategy_id      uuid REFERENCES strategies(id) ON DELETE SET NULL,

  -- Instrument & direction
  instrument       instrument NOT NULL,
  direction        trade_direction NOT NULL,

  -- Execution
  entry_price      numeric(14,5) NOT NULL,
  exit_price       numeric(14,5),
  contracts        numeric(10,2) NOT NULL DEFAULT 1,
  entry_time       timestamptz NOT NULL,
  exit_time        timestamptz,

  -- P&L (stored in dollars; negative = loss)
  gross_pnl        numeric(14,2),               -- before fees
  fees             numeric(14,2) NOT NULL DEFAULT 0,
  net_pnl          numeric(14,2)
    GENERATED ALWAYS AS (
      CASE WHEN gross_pnl IS NOT NULL THEN gross_pnl - fees ELSE NULL END
    ) STORED,

  -- Outcome
  outcome          trade_outcome NOT NULL DEFAULT 'open',

  -- Context
  session          trading_session,
  setup_tags       text[],                       -- e.g. ['OB','BOS','FVG']
  confluence_notes text,                         -- what lined up for this trade
  entry_notes      text,                         -- why you entered
  exit_notes       text,                         -- why you exited
  lessons          text,                         -- post-trade review
  screenshots      text[],                       -- URLs (Supabase Storage or external)

  -- Psychological
  pre_emotion      text,                         -- how you felt before the trade
  post_emotion     text,                         -- how you felt after

  -- Flags
  followed_rules   boolean,                      -- did you follow your strategy rules?
  is_reviewed      boolean NOT NULL DEFAULT false,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trades"
  ON trades FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for common query patterns
CREATE INDEX trades_user_entry_time ON trades (user_id, entry_time DESC);
CREATE INDEX trades_user_instrument ON trades (user_id, instrument);
CREATE INDEX trades_user_outcome    ON trades (user_id, outcome);
CREATE INDEX trades_prop_account    ON trades (prop_account_id) WHERE prop_account_id IS NOT NULL;
CREATE INDEX trades_strategy        ON trades (strategy_id)     WHERE strategy_id IS NOT NULL;

-- ============================================================
-- TABLE: trading_sessions
-- Daily journal entry — one row per trading day per user
-- ============================================================

CREATE TABLE trading_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date     date NOT NULL,

  -- Pre-session
  pre_market_notes text,                         -- bias, key levels, news
  mood_before      mood_rating,                  -- 1-5
  plan             text,                         -- what you planned to do

  -- Post-session
  post_market_notes text,
  mood_after        mood_rating,
  lessons           text,                        -- what did you learn today
  followed_plan     boolean,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, session_date)                 -- one journal entry per day per user
);

ALTER TABLE trading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trading_sessions"
  ON trading_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trading_sessions_updated_at
  BEFORE UPDATE ON trading_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX trading_sessions_user_date ON trading_sessions (user_id, session_date DESC);
