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

---

### `prop_accounts`
Tracks funded/prop trading accounts per firm.

| Column           | Type        | Notes                                                          |
|------------------|-------------|----------------------------------------------------------------|
| id               | uuid (PK)   | `gen_random_uuid()`                                            |
| user_id          | uuid        | FK → auth.users(id)                                           |
| firm             | prop_firm   | ENUM: FundedNext, AlphaFutures, TakeProfitTrader, YRM         |
| account_label    | text        | e.g. "100K Evaluation #1"                                      |
| account_size     | numeric     | starting account size ($)                                      |
| balance          | numeric     | current balance (optional, manual)                             |
| daily_loss_limit | numeric     | max daily loss allowed ($)                                     |
| max_drawdown     | numeric     | max trailing/static drawdown ($)                               |
| profit_target    | numeric     | profit target to pass challenge ($)                            |
| is_active        | boolean     | default true                                                   |
| is_funded        | boolean     | evaluation vs funded; default false                            |
| notes            | text        | optional                                                       |
| created_at       | timestamptz |                                                                |
| updated_at       | timestamptz | auto-updated via trigger                                       |

**RLS**: users manage only their own rows.

---

### `strategies`
Named trading strategies with rules, applicable instruments, and timeframes.

| Column      | Type         | Notes                              |
|-------------|--------------|------------------------------------|
| id          | uuid (PK)    | `gen_random_uuid()`                |
| user_id     | uuid         | FK → auth.users(id)               |
| name        | text         | required                           |
| description | text         | brief overview                     |
| rules       | text         | markdown playbook                  |
| instruments | instrument[] | ENUM array: NQ, Gold, CL, 6E      |
| timeframes  | text[]       | e.g. ['5m','15m']                  |
| tags        | text[]       | e.g. ['ICT','SMC']                |
| is_active   | boolean      | default true                       |
| created_at  | timestamptz  |                                    |
| updated_at  | timestamptz  | auto-updated via trigger           |

**RLS**: users manage only their own rows.

---

### `trades`
Core trade log — one row per executed trade.

| Column           | Type            | Notes                                                    |
|------------------|-----------------|----------------------------------------------------------|
| id               | uuid (PK)       | `gen_random_uuid()`                                      |
| user_id          | uuid            | FK → auth.users(id)                                     |
| prop_account_id  | uuid            | FK → prop_accounts(id) ON DELETE SET NULL               |
| strategy_id      | uuid            | FK → strategies(id) ON DELETE SET NULL                  |
| instrument       | instrument      | ENUM: NQ, Gold, CL, 6E                                  |
| direction        | trade_direction | ENUM: long, short                                        |
| entry_price      | numeric         | required                                                 |
| exit_price       | numeric         | optional (open trades)                                   |
| contracts        | numeric         | number of contracts, default 1                           |
| entry_time       | timestamptz     | required                                                 |
| exit_time        | timestamptz     | optional                                                 |
| gross_pnl        | numeric         | P&L before fees                                          |
| fees             | numeric         | commissions/fees, default 0                              |
| net_pnl          | numeric         | GENERATED ALWAYS AS (gross_pnl - fees) STORED           |
| outcome          | trade_outcome   | ENUM: win, loss, break_even, open                       |
| session          | trading_session | ENUM: london, new_york_am, new_york_pm, overnight, asia |
| setup_tags       | text[]          | e.g. ['OB','FVG','BOS']                                 |
| confluence_notes | text            | what aligned for this trade                              |
| entry_notes      | text            | why you entered                                          |
| exit_notes       | text            | why you exited                                           |
| lessons          | text            | post-trade review                                        |
| screenshots      | text[]          | URLs to trade screenshots                                |
| pre_emotion      | text            | emotional state before trade                             |
| post_emotion     | text            | emotional state after trade                              |
| followed_rules   | boolean         | did you follow strategy rules                            |
| is_reviewed      | boolean         | default false                                            |
| created_at       | timestamptz     |                                                          |
| updated_at       | timestamptz     | auto-updated via trigger                                 |

**RLS**: users manage only their own rows.
**Indexes**: `(user_id, entry_time DESC)`, `(user_id, instrument)`, `(user_id, outcome)`

---

### `trading_sessions`
Daily trading journal — one entry per user per day.

| Column            | Type        | Notes                             |
|-------------------|-------------|-----------------------------------|
| id                | uuid (PK)   | `gen_random_uuid()`               |
| user_id           | uuid        | FK → auth.users(id)              |
| session_date      | date        | calendar day                      |
| pre_market_notes  | text        | bias, key levels, news            |
| mood_before       | mood_rating | ENUM: '1'–'5'                    |
| plan              | text        | what you planned to trade         |
| post_market_notes | text        | session recap                     |
| mood_after        | mood_rating | ENUM: '1'–'5'                    |
| lessons           | text        | daily lessons                     |
| followed_plan     | boolean     | did you follow the plan           |
| created_at        | timestamptz |                                   |
| updated_at        | timestamptz | auto-updated via trigger          |

**Constraint**: `UNIQUE (user_id, session_date)` — one journal entry per day.
**RLS**: users manage only their own rows.

---

---

### `debts`
Tracks individual debts for payoff projection.

| Column          | Type        | Notes                             |
|-----------------|-------------|-----------------------------------|
| id              | uuid (PK)   | `gen_random_uuid()`               |
| user_id         | uuid        | FK → auth.users(id)              |
| name            | text        | e.g. "Credit Card", "Car Loan"   |
| total_amount    | numeric     | original debt amount              |
| current_balance | numeric     | remaining balance                 |
| interest_rate   | numeric     | APR %, default 0                  |
| minimum_payment | numeric     | minimum monthly payment, default 0|
| due_day         | int         | day of month due (1–31), optional |
| notes           | text        | optional                          |
| is_paid_off     | boolean     | default false                     |
| created_at      | timestamptz |                                   |
| updated_at      | timestamptz | auto-updated via trigger          |

**RLS**: users manage only their own rows.

---

### `monthly_expenses`
Recurring monthly expenses used in payoff projection.

| Column      | Type             | Notes                              |
|-------------|------------------|------------------------------------|
| id          | uuid (PK)        | `gen_random_uuid()`                |
| user_id     | uuid             | FK → auth.users(id)               |
| name        | text             | e.g. "Rent", "Netflix"            |
| amount      | numeric          | monthly cost                       |
| category    | expense_category | ENUM (housing, food, utilities…)  |
| due_day     | int              | day of month due (1–31), optional  |
| is_recurring| boolean          | default true                       |
| notes       | text             | optional                           |
| created_at  | timestamptz      |                                    |
| updated_at  | timestamptz      | auto-updated via trigger           |

**RLS**: users manage only their own rows.

---

### `prop_payouts`
Logs prop firm payout events; used to compute average monthly income for projection.

| Column      | Type        | Notes                                              |
|-------------|-------------|----------------------------------------------------|
| id          | uuid (PK)   | `gen_random_uuid()`                                |
| user_id     | uuid        | FK → auth.users(id)                               |
| firm_name   | text        | e.g. "FundedNext", "Apex", "Take Profit Trader"  |
| amount      | numeric     | payout amount                                      |
| payout_date | date        | date received, default CURRENT_DATE                |
| notes       | text        | optional                                           |
| created_at  | timestamptz |                                                    |
| updated_at  | timestamptz | auto-updated via trigger                           |

**RLS**: users manage only their own rows.

---

---

## P4 — Running / Garmin Tables

### `running_activities`
One row per uploaded Garmin .fit activity.

| Column                    | Type        | Notes                                                     |
|---------------------------|-------------|-----------------------------------------------------------|
| id                        | uuid (PK)   | `gen_random_uuid()`                                       |
| user_id                   | uuid        | FK → auth.users(id)                                      |
| started_at                | timestamptz | activity start time                                       |
| name                      | text        | auto-set from filename; editable                          |
| workout_type              | workout_type| ENUM: easy, long_run, tempo, threshold, interval, recovery, race, other |
| distance_meters           | numeric     | total distance                                            |
| duration_seconds          | int         | elapsed time in seconds                                   |
| avg_pace_sec_per_km       | numeric     | computed from avg_speed                                   |
| prescribed_pace_sec_per_km| numeric     | optional; set manually for pace comparison                |
| avg_hr                    | int         | average heart rate (bpm)                                  |
| max_hr                    | int         | max heart rate (bpm)                                      |
| resting_hr                | int         | overnight/morning resting HR if present in .fit           |
| elevation_gain_m          | numeric     | total ascent (m)                                          |
| elevation_loss_m          | numeric     | total descent (m)                                         |
| avg_cadence               | numeric     | full steps per minute (Garmin raw × 2)                    |
| avg_stride_length_m       | numeric     | optional                                                  |
| calories                  | int         | optional                                                  |
| notes                     | text        | optional user notes                                       |
| fit_filename              | text        | original uploaded filename                                |
| created_at                | timestamptz |                                                           |
| updated_at                | timestamptz | auto-updated via trigger                                  |

**RLS**: users manage only their own rows.
**Indexes**: `(user_id, started_at DESC)`

---

### `running_laps`
One row per lap within a running activity.

| Column              | Type        | Notes                              |
|---------------------|-------------|------------------------------------|
| id                  | uuid (PK)   | `gen_random_uuid()`                |
| user_id             | uuid        | FK → auth.users(id)               |
| activity_id         | uuid        | FK → running_activities(id) CASCADE|
| lap_number          | int         | 1-indexed                          |
| start_time          | timestamptz | optional                           |
| distance_meters     | numeric     |                                    |
| duration_seconds    | int         |                                    |
| avg_pace_sec_per_km | numeric     |                                    |
| avg_hr              | int         |                                    |
| max_hr              | int         |                                    |
| elevation_gain_m    | numeric     |                                    |
| avg_cadence         | numeric     | full SPM                           |
| created_at          | timestamptz |                                    |

**Constraint**: `UNIQUE (activity_id, lap_number)`
**RLS**: users manage only their own rows.

---

### `resting_hr_logs`
Daily resting HR extracted from Garmin or logged manually. Spike flag set when HR ≥ 7-day avg + 5 bpm.

| Column      | Type        | Notes                                   |
|-------------|-------------|-----------------------------------------|
| id          | uuid (PK)   | `gen_random_uuid()`                     |
| user_id     | uuid        | FK → auth.users(id)                    |
| logged_date | date        | calendar day                            |
| resting_hr  | int         | bpm                                     |
| source      | text        | `'garmin'` or `'manual'`               |
| is_spike    | boolean     | true when ≥5 bpm above 7-day rolling avg|
| notes       | text        | optional                                |
| created_at  | timestamptz |                                         |

**Constraint**: `UNIQUE (user_id, logged_date)`
**Baseline**: 42–49 bpm. Spike threshold: +5 bpm.
**RLS**: users manage only their own rows.

---

### `race_targets`
Upcoming and completed races with pace targets.

| Column                 | Type        | Notes                                        |
|------------------------|-------------|----------------------------------------------|
| id                     | uuid (PK)   | `gen_random_uuid()`                          |
| user_id                | uuid        | FK → auth.users(id)                         |
| race_name              | text        |                                              |
| location               | text        | optional                                     |
| race_date              | date        |                                              |
| distance_km            | numeric     |                                              |
| target_time_seconds    | int         | total target finish time                     |
| target_pace_sec_per_km | numeric     | GENERATED: target_time_seconds / distance_km |
| actual_time_seconds    | int         | optional; filled after race                  |
| activity_id            | uuid        | FK → running_activities(id) SET NULL         |
| notes                  | text        | optional                                     |
| created_at             | timestamptz |                                              |
| updated_at             | timestamptz | auto-updated via trigger                     |

**Known races**:
- Limassol Half Marathon — 2026-03-22 — 1:44:30 target (~4:57/km)
- Belgrade Marathon — 2026-04-19 — 3:32:00 target (~5:01/km)

**RLS**: users manage only their own rows.

---

_Future tables: books, projects_
