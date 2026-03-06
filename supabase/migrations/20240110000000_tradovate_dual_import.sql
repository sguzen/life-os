-- Add columns for the Tradovate dual-file (Cash_History + Orders) importer.
-- The existing gross_pnl, fees, and net_pnl (generated) columns are already present.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS contract     TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exchange_fee DECIMAL(10,4);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS clearing_fee DECIMAL(10,4);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS nfa_fee      DECIMAL(10,4);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS commission   DECIMAL(10,4);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS total_fees   DECIMAL(10,4);
