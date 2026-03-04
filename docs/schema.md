# Life OS — Database Schema

All tables follow these conventions:
- RLS enabled on every table
- `user_id uuid references auth.users(id)` on every non-profile table
- `created_at` / `updated_at` timestamps

## Tables

### `profiles`
Extends `auth.users`. Auto-created via trigger on sign-up.

| Column      | Type        | Notes                        |
|-------------|-------------|------------------------------|
| id          | uuid (PK)   | FK → auth.users(id)          |
| username    | text        | unique                       |
| full_name   | text        |                              |
| avatar_url  | text        |                              |
| created_at  | timestamptz |                              |
| updated_at  | timestamptz |                              |

**RLS**: users can only select / update their own row.

---

---

### `habits`
User-defined habits to track.

| Column       | Type        | Notes                              |
|--------------|-------------|------------------------------------|
| id           | uuid (PK)   | `gen_random_uuid()`                |
| user_id      | uuid        | FK → auth.users(id)               |
| name         | text        | required                           |
| description  | text        | optional                           |
| frequency    | text        | `'daily'` or `'weekly'`           |
| target_count | int         | min 1, default 1                   |
| color        | text        | hex color, default `'#6366f1'`    |
| icon         | text        | optional emoji / icon name         |
| is_archived  | boolean     | soft-delete, default false         |
| created_at   | timestamptz |                                    |
| updated_at   | timestamptz | auto-updated via trigger           |

**RLS**: users can only select/insert/update/delete their own rows.

---

### `habit_logs`
One row per (habit, calendar day). Supports count > 1 for multi-rep tracking.

| Column    | Type        | Notes                              |
|-----------|-------------|------------------------------------|
| id        | uuid (PK)   | `gen_random_uuid()`                |
| user_id   | uuid        | FK → auth.users(id)               |
| habit_id  | uuid        | FK → habits(id) on delete cascade  |
| logged_at | date        | calendar day, default `current_date` |
| count     | int         | default 1                          |
| created_at| timestamptz |                                    |

**Constraint**: `UNIQUE (habit_id, logged_at)` — one log per habit per day.
**RLS**: users can only manage their own logs.

---

_Future tables (P2+): trades, runs, transactions, books, projects_
