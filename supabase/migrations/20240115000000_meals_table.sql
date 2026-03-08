-- Meals table: stores editable meal plan definitions per day type
-- Meal *status* (complete/partial/skipped) stays in nutrition_logs as-is.

CREATE TABLE public.meals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_type      TEXT        NOT NULL CHECK (day_type IN ('training', 'rest')),
  meal_name     TEXT        NOT NULL, -- e.g. 'meal_breakfast' — matches nutrition_logs column
  label         TEXT        NOT NULL, -- Display label e.g. 'Breakfast 07:30'
  icon          TEXT        NOT NULL DEFAULT '🍽️',
  description   TEXT,
  calories      INT,
  protein       DECIMAL(5,1),
  carbs         DECIMAL(5,1),
  fats          DECIMAL(5,1),
  order_index   INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own meals"
  ON public.meals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX meals_user_day_type ON public.meals (user_id, day_type, order_index);

-- Add meal_changes audit table for tracking AI/manual edits
CREATE TABLE public.meal_changes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id         UUID        NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by      TEXT        NOT NULL DEFAULT 'user',
  previous_value  JSONB,
  new_value       JSONB,
  reason          TEXT
);

ALTER TABLE public.meal_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own meal changes"
  ON public.meal_changes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add extra nutrition_targets to plan_configs (seeded via application, not SQL)
-- Columns already exist in plan_configs table; no schema change needed.
