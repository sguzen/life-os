-- ==========================================
-- 1. EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- Essential for AI Semantic Search & Pattern Matching

-- ==========================================
-- 2. MASTER COACH CORE (The Missing Tables)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.morning_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    sleep_hours NUMERIC(4,2),
    rhr INTEGER,
    hrv INTEGER,
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
    journal_notes TEXT,
    embedding VECTOR(1536), -- Vectorized for Coach memory
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.coach_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_date DATE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coach_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    task_description TEXT NOT NULL,
    target_date DATE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. ADAPTATION ENGINE (The Event Bus)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.adapt_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    domain TEXT NOT NULL, -- e.g., 'running', 'trading', 'sleep'
    event_type TEXT NOT NULL, -- e.g., 'hr_spike', 'poor_sleep', 'drawdown'
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    trigger_data JSONB, -- Context data
    handled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. TRADING & FINANCE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    instrument TEXT NOT NULL,
    direction TEXT NOT NULL,
    entry_price NUMERIC,
    exit_price NUMERIC,
    pnl NUMERIC NOT NULL,
    trade_date TIMESTAMPTZ NOT NULL,
    strategy_id UUID,
    mistakes_made TEXT[],
    coach_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prop_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    firm_name TEXT NOT NULL,
    account_size NUMERIC NOT NULL,
    current_balance NUMERIC NOT NULL,
    drawdown_limit NUMERIC NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trading_accountability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    rules_followed BOOLEAN DEFAULT FALSE,
    tilt_level INTEGER CHECK (tilt_level >= 1 AND tilt_level <= 10),
    journal TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. ATHLETICS (Running & Marathon)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    distance_km NUMERIC,
    duration_seconds INTEGER,
    avg_hr INTEGER,
    max_hr INTEGER,
    cadence INTEGER,
    perceived_exertion INTEGER CHECK (perceived_exertion >= 1 AND perceived_exertion <= 10),
    fit_file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marathon_plan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    scheduled_date DATE NOT NULL,
    workout_type TEXT NOT NULL, -- e.g., 'Intervals', 'Long Run', 'Recovery'
    target_distance NUMERIC,
    target_pace TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. NUTRITION & RECOVERY
-- ==========================================

CREATE TABLE IF NOT EXISTS public.meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    log_time TIMESTAMPTZ NOT NULL,
    meal_type TEXT NOT NULL,
    description TEXT,
    calories INTEGER,
    protein_g NUMERIC,
    carbs_g NUMERIC,
    fat_g NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    timing_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. HABITS & LIFE TRACKING
-- ==========================================

CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    frequency TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.habit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
    log_date DATE NOT NULL,
    completed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(habit_id, log_date)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL,
    auth TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(endpoint)
);

-- ==========================================
-- 8. ROW LEVEL SECURITY (RLS) HARDENING
-- ==========================================
-- Enable RLS on all tables
ALTER TABLE public.morning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adapt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prop_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_accountability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marathon_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create dynamic policies for full isolated user access
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'morning_logs', 'coach_conversations', 'coach_tasks', 'adapt_events',
            'trades', 'prop_accounts', 'trading_accountability', 'runs', 
            'marathon_plan', 'meals', 'supplements', 'habits', 'habit_logs', 'push_subscriptions'
        )
    )
    LOOP
        EXECUTE format('
            CREATE POLICY "Users can fully manage their own %I" 
            ON public.%I 
            FOR ALL 
            USING (auth.uid() = user_id) 
            WITH CHECK (auth.uid() = user_id);
        ', t_name, t_name);
    END LOOP;
END
$$;

-- ==========================================
-- 9. TRIGGERS (Auto-Update Timestamps)
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_morning_logs_updated_at BEFORE UPDATE ON public.morning_logs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_coach_tasks_updated_at BEFORE UPDATE ON public.coach_tasks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
