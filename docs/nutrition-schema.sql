-- Nutrition Tracking Module — Database Schema
-- Run in Supabase SQL editor to set up the nutrition tables

-- ── Daily nutrition log (one row per day) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Meal adherence: 'pending' | 'complete' | 'partial' | 'skipped' | 'modified'
  meal_post_run TEXT NOT NULL DEFAULT 'pending',
  meal_breakfast TEXT NOT NULL DEFAULT 'pending',
  meal_lunch TEXT NOT NULL DEFAULT 'pending',
  meal_lunch_carb_choice TEXT,           -- which lunch carb option chosen
  meal_snack1 TEXT NOT NULL DEFAULT 'pending',
  meal_snack2 TEXT NOT NULL DEFAULT 'pending',
  meal_snack3 TEXT NOT NULL DEFAULT 'pending',
  meal_snack4 TEXT NOT NULL DEFAULT 'pending',
  meal_snack4_fruit TEXT,                -- which fruit chosen for snack 4

  -- Per-meal quick notes (JSONB: { breakfast: "skipped oats", ... })
  meal_notes JSONB NOT NULL DEFAULT '{}',

  -- Water tracking
  water_ml INTEGER NOT NULL DEFAULT 0,   -- target: 2000ml (3000ml on run days)

  -- Alcohol (cross-references trading gate)
  alcohol_consumed BOOLEAN NOT NULL DEFAULT false,
  alcohol_details TEXT,                  -- what, how much

  -- Violation flags
  had_fried_food BOOLEAN NOT NULL DEFAULT false,
  had_processed_snacks BOOLEAN NOT NULL DEFAULT false,
  had_juice_soda BOOLEAN NOT NULL DEFAULT false,
  had_bread_sugar BOOLEAN NOT NULL DEFAULT false, -- current known struggle

  -- Body composition snapshot (optional — log when measured)
  weight_kg DECIMAL(4,1),
  body_fat_pct DECIMAL(4,1),

  -- AI coaching
  ai_daily_advice TEXT,
  ai_advice_generated_at TIMESTAMPTZ,

  -- Adherence score (0-100, computed by application)
  adherence_score INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, log_date)
);

-- RLS
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their nutrition logs"
  ON nutrition_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Supplement compliance log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Daily supplements
  no3_taken BOOLEAN NOT NULL DEFAULT false,
  zentius_taken BOOLEAN NOT NULL DEFAULT false,
  zinc_taken BOOLEAN NOT NULL DEFAULT false,
  folic_acid_taken BOOLEAN NOT NULL DEFAULT false,
  mg_bisglycinate_taken BOOLEAN NOT NULL DEFAULT false,
  mg_melatonin_taken BOOLEAN NOT NULL DEFAULT false,
  se_ace_zinc_taken BOOLEAN NOT NULL DEFAULT false,

  -- Weekly supplements (log on day taken)
  vitamin_d3_taken BOOLEAN NOT NULL DEFAULT false, -- 1x/week
  b12_taken BOOLEAN NOT NULL DEFAULT false,         -- 2x/week

  -- Iron (frequency depends on blood donation recovery flag)
  iron_taken BOOLEAN NOT NULL DEFAULT false,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, log_date)
);

-- RLS
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their supplement logs"
  ON supplement_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Body composition history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  measured_at DATE NOT NULL,
  weight_kg DECIMAL(4,1),
  body_fat_pct DECIMAL(4,1),
  fat_mass_kg DECIMAL(4,1),
  muscle_mass_kg DECIMAL(4,1),
  waist_upper_cm DECIMAL(4,1),
  waist_mid_cm DECIMAL(4,1),
  waist_lower_cm DECIMAL(4,1),
  hip_cm DECIMAL(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their body measurements"
  ON body_measurements FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Trading accountability sessions (cross-reference for alcohol gate) ────────
-- Add gate_pre_blocked and gate_block_reason columns if not already present:
ALTER TABLE accountability_sessions
  ADD COLUMN IF NOT EXISTS gate_pre_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_block_reason TEXT;

-- ── Running activities (add blood_donation_recovery flag if not present) ──────
ALTER TABLE running_activities
  ADD COLUMN IF NOT EXISTS blood_donation_recovery BOOLEAN NOT NULL DEFAULT false;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS nutrition_logs_user_date ON nutrition_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS supplement_logs_user_date ON supplement_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS body_measurements_user_date ON body_measurements(user_id, measured_at DESC);
