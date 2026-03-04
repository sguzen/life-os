-- P1-01: habits table
create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  description  text,
  frequency    text not null default 'daily'
                 check (frequency in ('daily', 'weekly')),
  target_count int  not null default 1 check (target_count >= 1),
  color        text not null default '#6366f1',
  icon         text,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.habits enable row level security;

create policy "Users can manage their own habits"
  on public.habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- keep updated_at fresh on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger habits_updated_at
  before update on public.habits
  for each row execute procedure public.set_updated_at();

-- P1-02: habit_logs table
-- One row per (habit, calendar-day). count supports "did it N times today".
create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  habit_id   uuid not null references public.habits (id) on delete cascade,
  logged_at  date not null default current_date,
  count      int  not null default 1 check (count >= 1),
  created_at timestamptz not null default now(),
  unique (habit_id, logged_at)
);

alter table public.habit_logs enable row level security;

create policy "Users can manage their own habit logs"
  on public.habit_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- index for fast streak / log queries
create index habit_logs_habit_id_logged_at_idx
  on public.habit_logs (habit_id, logged_at desc);
