-- P6-01: Bookshelf + Projects schema
-- ============================================================
-- BOOKS
-- ============================================================

create table public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  author      text,
  isbn        text,
  status      text not null default 'want-to-read'
                check (status in ('want-to-read', 'reading', 'done', 'abandoned')),
  rating      int  check (rating >= 1 and rating <= 5),
  notes       text,
  started_at  date,
  finished_at date,
  cover_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "Users can manage their own books"
  on public.books for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger books_updated_at
  before update on public.books
  for each row execute procedure public.set_updated_at();

create index books_user_id_status_idx
  on public.books (user_id, status);

-- ============================================================
-- PROJECTS
-- ============================================================

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'active'
                check (status in ('active', 'paused', 'done', 'abandoned')),
  color       text not null default '#6366f1',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Users can manage their own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- PROJECT TASKS
-- ============================================================

create table public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null,
  status      text not null default 'todo'
                check (status in ('todo', 'in_progress', 'done')),
  notes       text,
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.project_tasks enable row level security;

create policy "Users can manage their own project tasks"
  on public.project_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger project_tasks_updated_at
  before update on public.project_tasks
  for each row execute procedure public.set_updated_at();

create index project_tasks_project_id_position_idx
  on public.project_tasks (project_id, position);
