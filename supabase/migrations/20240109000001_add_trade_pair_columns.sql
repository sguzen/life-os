-- Add Position_History.csv import columns to trades table
-- position_id: Tradovate Position ID (groups related pair rows)
-- pair_id:     Tradovate Pair ID (unique per matched fill row — used for dedup)

ALTER TABLE trades ADD COLUMN IF NOT EXISTS position_id text;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS pair_id     text;

-- Unique per user so the same file can be safely re-imported (duplicates are skipped)
CREATE UNIQUE INDEX IF NOT EXISTS trades_user_pair_id
  ON trades (user_id, pair_id)
  WHERE pair_id IS NOT NULL;
