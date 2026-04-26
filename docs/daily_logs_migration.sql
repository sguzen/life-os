-- Run this once in the Supabase SQL editor.
-- Creates daily_logs (multi-category metrics store) and user_insights (correlation engine output).

-- ── daily_logs ────────────────────────────────────────────────────────────────

create table if not exists public.daily_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null,          -- 'morning' | 'training' | 'work' | 'nutrition'
  date          date not null,
  metrics       jsonb not null default '{}',
  journal_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint daily_logs_user_category_date unique (user_id, category, date)
);

alter table public.daily_logs enable row level security;

create policy "users manage own daily_logs"
  on public.daily_logs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists daily_logs_user_date
  on public.daily_logs (user_id, date desc);

-- ── user_insights (correlation engine output) ────────────────────────────────

create table if not exists public.user_insights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric_a     text not null,
  metric_b     text not null,
  coefficient  numeric(6,4) not null,
  confidence   numeric(6,4) not null,
  insight_text text,
  actionable   boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.user_insights enable row level security;

create policy "users read own insights"
  on public.user_insights for select
  using (auth.uid() = user_id);

-- service role inserts via cron — no insert policy needed for anon/authed users
