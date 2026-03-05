-- Add ES (E-mini S&P 500 / Micro E-mini S&P) to the instrument enum
ALTER TYPE instrument ADD VALUE IF NOT EXISTS 'ES';
