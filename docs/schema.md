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

_Future tables: runs, books, projects_
