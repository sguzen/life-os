-- ============================================================
-- Supplement Manager + Plan Configs + Audit Log
-- ============================================================

-- ── Supplements ──────────────────────────────────────────────

CREATE TABLE supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  dose_amount DECIMAL(8,2),
  dose_unit TEXT,                        -- "mg" | "mcg" | "IU" | "tablet" | "sachet" | "scoop"
  dose_count DECIMAL(4,1) DEFAULT 1,

  frequency TEXT NOT NULL DEFAULT 'daily',
  -- 'daily' | 'every_other_day' | 'weekly' | 'twice_weekly' | 'three_times_weekly' | 'custom'
  frequency_days JSONB,                  -- for 'custom': [1,3,5] = Mon/Wed/Fri
  frequency_times_per_week INTEGER,

  timing TEXT,                           -- 'morning'|'evening'|'with_food'|'before_bed'|'post_workout'|'any'
  timing_notes TEXT,
  take_with_food BOOLEAN DEFAULT false,

  has_duration BOOLEAN DEFAULT false,
  start_date DATE,
  end_date DATE,
  duration_days INTEGER,
  duration_notes TEXT,

  is_active BOOLEAN DEFAULT true,
  is_paused BOOLEAN DEFAULT false,
  pause_reason TEXT,
  paused_at DATE,
  resume_at DATE,

  prescribed_by TEXT,
  prescribed_for TEXT,
  notes TEXT,

  -- Iron override: during blood donation recovery → force daily
  blood_donation_override BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplements_owner" ON supplements USING (auth.uid() = user_id);

-- ── Supplement Daily Logs ─────────────────────────────────────

CREATE TABLE supplement_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  supplement_id UUID REFERENCES supplements(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL,
  taken BOOLEAN DEFAULT false,
  taken_at TIMESTAMPTZ,
  skipped_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, supplement_id, log_date)
);

ALTER TABLE supplement_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplement_log_owner" ON supplement_log_entries USING (auth.uid() = user_id);

-- ── Supplement Change History ─────────────────────────────────

CREATE TABLE supplement_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_id UUID REFERENCES supplements(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_type TEXT,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  changed_by TEXT DEFAULT 'user'        -- 'user' | 'ai_coach' | 'adaptation_engine'
);

ALTER TABLE supplement_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplement_changes_owner" ON supplement_changes USING (auth.uid() = user_id);

-- ── Plan Configs ──────────────────────────────────────────────

CREATE TABLE plan_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  module TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_label TEXT NOT NULL,
  config_value TEXT NOT NULL,
  config_type TEXT NOT NULL,            -- 'number' | 'text' | 'boolean' | 'pace' | 'json'
  config_unit TEXT,
  description TEXT,
  editable_by_user BOOLEAN DEFAULT true,
  editable_by_ai BOOLEAN DEFAULT true,
  last_changed_at TIMESTAMPTZ,
  last_changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module, config_key)
);

ALTER TABLE plan_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_configs_owner" ON plan_configs USING (auth.uid() = user_id);

-- ── Universal Audit Log ───────────────────────────────────────

CREATE TABLE plan_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  module TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_description TEXT,
  action TEXT NOT NULL,
  field_changed TEXT,
  previous_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_by TEXT NOT NULL,            -- 'user' | 'ai_coach' | 'adaptation_engine' | 'system'
  coach_conversation_id TEXT
);

ALTER TABLE plan_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_owner" ON plan_audit_log USING (auth.uid() = user_id);

-- ── Updated_at trigger for supplements ───────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplements_updated_at
  BEFORE UPDATE ON supplements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
