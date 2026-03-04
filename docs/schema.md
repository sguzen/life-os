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

_Future tables (P1+): habits, habit_logs, trades, runs, transactions, books, projects_
