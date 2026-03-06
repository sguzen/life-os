export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  dueDate?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ---- Habits (matches DB schema) ----

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  frequency: "daily" | "weekly";
  target_count: number;
  color: string;
  icon: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  logged_at: string; // ISO date string YYYY-MM-DD
  count: number;
  created_at: string;
}

export interface HabitWithLogs extends Habit {
  logs: HabitLog[];
  /** Consecutive-day streak ending today */
  streak: number;
  /** Whether today already has a log entry */
  logged_today: boolean;
}

// ---- Trading Journal (P2) ----

export type Instrument = "NQ" | "Gold" | "CL" | "6E" | "ES";
export type TradeDirection = "long" | "short";
export type TradeOutcome = "win" | "loss" | "break_even" | "open";
export type PropFirm = "FundedNext" | "AlphaFutures" | "TakeProfitTrader" | "YRM";
export type TradingSession = "london" | "new_york_am" | "new_york_pm" | "overnight" | "asia";
export type MoodRating = "1" | "2" | "3" | "4" | "5";

export interface PropAccount {
  id: string;
  user_id: string;
  firm: PropFirm;
  account_label: string;
  account_size: number;
  balance: number | null;
  daily_loss_limit: number | null;
  max_drawdown: number | null;
  profit_target: number | null;
  is_active: boolean;
  is_funded: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  rules: string | null;
  instruments: Instrument[] | null;
  timeframes: string[] | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  prop_account_id: string | null;
  strategy_id: string | null;
  instrument: Instrument;
  direction: TradeDirection;
  entry_price: number;
  exit_price: number | null;
  contracts: number;
  entry_time: string;
  exit_time: string | null;
  gross_pnl: number | null;
  fees: number;
  net_pnl: number | null;           // generated column
  outcome: TradeOutcome;
  session: TradingSession | null;
  setup_tags: string[] | null;
  confluence_notes: string | null;
  entry_notes: string | null;
  exit_notes: string | null;
  lessons: string | null;
  screenshots: string[] | null;
  pre_emotion: string | null;
  post_emotion: string | null;
  followed_rules: boolean | null;
  is_reviewed: boolean;
  // Tradovate Position_History.csv import identifiers
  position_id: string | null;
  pair_id: string | null;
  created_at: string;
  updated_at: string;
  // joined relations (optional)
  prop_accounts?: Pick<PropAccount, "id" | "firm" | "account_label"> | null;
  strategies?: Pick<Strategy, "id" | "name"> | null;
}

export interface TradingSessionJournal {
  id: string;
  user_id: string;
  session_date: string;             // ISO date YYYY-MM-DD
  pre_market_notes: string | null;
  mood_before: MoodRating | null;
  plan: string | null;
  post_market_notes: string | null;
  mood_after: MoodRating | null;
  lessons: string | null;
  followed_plan: boolean | null;
  created_at: string;
  updated_at: string;
}

// ---- Analytics helpers ----

export interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;                  // 0-100
  totalNetPnl: number;
  totalGrossPnl: number;
  totalFees: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  avgRR: number | null;
}

export interface DailyPnl {
  date: string;                     // YYYY-MM-DD
  net_pnl: number;
  cumulative_pnl: number;
  trade_count: number;
}

// ---- Financial Dashboard (P3) ----

export type ExpenseCategory =
  | "housing"
  | "transportation"
  | "food"
  | "utilities"
  | "insurance"
  | "subscriptions"
  | "health"
  | "entertainment"
  | "other";

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  total_amount: number;
  current_balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number | null;
  notes: string | null;
  is_paid_off: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  due_day: number | null;
  is_recurring: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropPayout {
  id: string;
  user_id: string;
  firm_name: string;
  amount: number;
  payout_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoffProjectionPoint {
  month: string;    // e.g. "Mar 2026"
  balance: number;  // remaining debt balance
}

// ---- Bookshelf (P6) ----

export type BookStatus = "want-to-read" | "reading" | "done" | "abandoned";

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  status: BookStatus;
  rating: number | null;  // 1-5
  notes: string | null;
  started_at: string | null;   // YYYY-MM-DD
  finished_at: string | null;  // YYYY-MM-DD
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Projects (P6) ----

export type ProjectStatus = "active" | "paused" | "done" | "abandoned";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  status: TaskStatus;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithTasks extends Project {
  tasks: ProjectTask[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ---- Adaptive Replanning Engine ----

export type AdaptTriggerType = 'illness' | 'injury' | 'fatigue' | 'poor_sleep'
export type AdaptEventStatus = 'pending' | 'adjustments_proposed' | 'approved' | 'rejected' | 'recovered'
export type AdaptModule = 'marathon' | 'nutrition' | 'trading'

export interface AdaptationEvent {
  id: string
  user_id: string
  reported_at: string
  event_date: string
  trigger_type: AdaptTriggerType
  severity: number
  symptoms: string | null
  affected_body_part: string | null
  sleep_hours: number | null
  resting_hr: number | null
  estimated_days: number | null
  status: AdaptEventStatus
  ai_triage: string | null
  ai_generated_at: string | null
  recovery_confirmed_at: string | null
  notes: string | null
  created_at: string
}

export interface AdaptationAdjustment {
  id: string
  event_id: string
  user_id: string
  module: AdaptModule
  target_date: string
  target_id: string | null
  target_description: string | null
  change_type: string
  original_value: Record<string, unknown> | null
  adjusted_value: Record<string, unknown> | null
  reasoning: string | null
  approved: boolean | null
  applied_at: string | null
  user_override: string | null
  created_at: string
}

export interface RecoveryCheckin {
  id: string
  event_id: string
  user_id: string
  checkin_date: string
  feeling_score: number
  symptoms_present: boolean | null
  resting_hr: number | null
  notes: string | null
  ai_recommendation: string | null
  created_at: string
}

// AI-generated adjustment proposals (before DB insertion)
export interface MarathonAdjustmentProposal {
  date: string
  original_type: string
  original_description: string
  original_km: number
  adjusted_type: string
  adjusted_description: string
  adjusted_km: number
  reasoning: string
}

export interface NutritionAdjustmentProposal {
  date: string
  water_target_ml: number
  calorie_modifier: string
  meal_modifications: {
    breakfast: string | null
    lunch: string | null
    snack1: string | null
    snack2: string | null
    snack3: string | null
    snack4: string | null
  }
  supplement_additions: string[]
  foods_to_prioritise: string[]
  foods_to_avoid: string[]
  reasoning: string
}

export interface TradingAdjustmentProposal {
  date: string
  gate_recommendation: 'trade_normally' | 'reduced_size' | 'observation_only' | 'no_trading'
  reasoning: string
}

export interface AdaptationProposals {
  summary: string
  marathon_adjustments: MarathonAdjustmentProposal[]
  nutrition_adjustments: NutritionAdjustmentProposal[]
  trading_adjustments: TradingAdjustmentProposal[]
  recovery_plan: {
    daily_checkin_required: boolean
    return_to_normal_criteria: string
    estimated_return_date: string
  }
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: Date;
  progress: number;
  milestones: Milestone[];
  createdAt: Date;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}
