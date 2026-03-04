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

export type Instrument = "NQ" | "Gold" | "CL" | "6E";
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

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
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
