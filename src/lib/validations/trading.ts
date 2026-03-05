import { z } from "zod";

export const INSTRUMENTS = ["NQ", "Gold", "CL", "6E"] as const;
export const PROP_FIRMS = ["FundedNext", "AlphaFutures", "TakeProfitTrader", "YRM"] as const;
export const TRADE_DIRECTIONS = ["long", "short"] as const;
export const TRADE_OUTCOMES = ["win", "loss", "break_even", "open"] as const;
export const TRADING_SESSIONS = ["london", "new_york_am", "new_york_pm", "overnight", "asia"] as const;
export const MOOD_RATINGS = ["1", "2", "3", "4", "5"] as const;

export const INSTRUMENT_LABELS: Record<string, string> = {
  NQ: "NQ (NASDAQ Futures)",
  Gold: "Gold (GC)",
  CL: "CL (Crude Oil)",
  "6E": "6E (Euro/USD)",
};

export const PROP_FIRM_LABELS: Record<string, string> = {
  FundedNext: "FundedNext",
  AlphaFutures: "AlphaFutures",
  TakeProfitTrader: "Take Profit Trader",
  YRM: "YRM",
};

export const SESSION_LABELS: Record<string, string> = {
  london: "London",
  new_york_am: "New York AM",
  new_york_pm: "New York PM",
  overnight: "Overnight",
  asia: "Asia",
};

// ---- Prop Account ----

export const propAccountSchema = z.object({
  firm: z.enum(PROP_FIRMS),
  account_label: z.string().min(1, "Label is required").max(100),
  account_size: z.number({ error: "Required" }).positive("Must be positive"),
  balance: z.number().nullable().optional(),
  daily_loss_limit: z.number().positive().nullable().optional(),
  max_drawdown: z.number().positive().nullable().optional(),
  profit_target: z.number().positive().nullable().optional(),
  is_active: z.boolean().default(true),
  is_funded: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export type PropAccountFormValues = z.infer<typeof propAccountSchema>;

// ---- Strategy ----

export const strategySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
  instruments: z.array(z.enum(INSTRUMENTS)).nullable().optional(),
  timeframes: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  is_active: z.boolean().default(true),
});

export type StrategyFormValues = z.infer<typeof strategySchema>;

// ---- Trade ----

export const tradeSchema = z.object({
  instrument: z.enum(INSTRUMENTS),
  direction: z.enum(TRADE_DIRECTIONS),
  entry_price: z.number({ error: "Required" }).positive(),
  exit_price: z.number().positive().nullable().optional(),
  contracts: z.number({ error: "Required" }).positive().default(1),
  entry_time: z.string().min(1, "Entry time is required"),
  exit_time: z.string().nullable().optional(),
  gross_pnl: z.number().nullable().optional(),
  fees: z.number().min(0).default(0),
  outcome: z.enum(TRADE_OUTCOMES).default("open"),
  prop_account_id: z.string().uuid().nullable().optional(),
  strategy_id: z.string().uuid().nullable().optional(),
  session: z.enum(TRADING_SESSIONS).nullable().optional(),
  setup_tags: z.array(z.string()).nullable().optional(),
  confluence_notes: z.string().nullable().optional(),
  entry_notes: z.string().nullable().optional(),
  exit_notes: z.string().nullable().optional(),
  lessons: z.string().nullable().optional(),
  screenshots: z.array(z.string().url()).nullable().optional(),
  pre_emotion: z.string().nullable().optional(),
  post_emotion: z.string().nullable().optional(),
  followed_rules: z.boolean().nullable().optional(),
  is_reviewed: z.boolean().default(false),
});

export type TradeFormValues = z.infer<typeof tradeSchema>;

// ---- Trading Session Journal ----

export const tradingSessionSchema = z.object({
  session_date: z.string().min(1, "Date is required"),
  pre_market_notes: z.string().nullable().optional(),
  mood_before: z.enum(MOOD_RATINGS).nullable().optional(),
  plan: z.string().nullable().optional(),
  post_market_notes: z.string().nullable().optional(),
  mood_after: z.enum(MOOD_RATINGS).nullable().optional(),
  lessons: z.string().nullable().optional(),
  followed_plan: z.boolean().nullable().optional(),
});

export type TradingSessionFormValues = z.infer<typeof tradingSessionSchema>;
