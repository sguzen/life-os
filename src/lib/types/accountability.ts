// Trading Accountability System — TypeScript types

export type AccountabilityInstrument = 'MNQ' | 'MGC' | 'MES'
export type AccountabilityDirection = 'Long' | 'Short'
export type AccountabilitySession = 'London' | 'NY_AM' | 'NY_PM'
export type SetupType = 'FVG' | 'IFVG' | 'Order Block' | 'Breaker Block' | 'CSD' | 'Liquidity Grab' | 'Other'
export type TradeOutcomeAcc = 'Win' | 'Loss' | 'Breakeven' | 'Partial'
export type SessionGrade = 'A' | 'B' | 'C' | 'D' | 'F'

// ── Challenge Config ──────────────────────────────────────────────────────────

export interface TradingChallenge {
  id: string
  user_id: string
  name: string
  account_size: number
  daily_loss_limit: number
  max_drawdown: number
  profit_target: number
  trailing_drawdown: boolean
  is_active: boolean
  notes: string | null
  created_at: string
}

export type TradingChallengeInput = Omit<TradingChallenge, 'id' | 'user_id' | 'created_at'>

// ── Accountability Session ────────────────────────────────────────────────────

export interface AccountabilitySession_DB {
  id: string
  user_id: string
  session_date: string           // YYYY-MM-DD
  challenge_id: string | null

  // Pre-session gate
  sleep_hours: number | null
  physical_score: number | null  // 1-10
  emotional_score: number | null // 1-10
  alcohol_last_night: boolean | null
  gate_passed: boolean | null
  gate_ai_response: string | null

  // Guardrails
  consecutive_losses: number
  revenge_lock_triggered: boolean
  external_influence_flagged: boolean

  // EOD
  net_pnl: number | null
  eod_ai_response: string | null
  eod_notes: string | null

  created_at: string
}

export type AccountabilitySessionInput = Partial<
  Omit<AccountabilitySession_DB, 'id' | 'user_id' | 'created_at'>
> & { session_date: string }

// ── Trade Plan ───────────────────────────────────────────────────────────────

export interface TradePlan {
  id: string
  session_id: string
  user_id: string
  plan_number: number            // 1 or 2

  instrument: AccountabilityInstrument
  direction: AccountabilityDirection
  session_window: AccountabilitySession

  // ICT setup
  htf_bias: string
  setup_type: SetupType
  pd_array: string
  confluence: string
  entry_price: number | null
  stop_loss: number | null
  target_1: number | null
  target_2: number | null
  risk_dollars: number | null

  // AI + conviction
  plan_ai_response: string | null
  conviction_lock: boolean

  created_at: string
}

export type TradePlanInput = Omit<TradePlan, 'id' | 'user_id' | 'created_at'>

// ── Trade Review ─────────────────────────────────────────────────────────────

export interface TradeReview {
  id: string
  plan_id: string
  session_id: string
  user_id: string

  outcome: TradeOutcomeAcc
  actual_entry: number | null
  actual_exit: number | null
  actual_pnl: number | null
  execution_quality: number | null // 1-10

  // Guardrails
  followed_plan: boolean
  external_influence: boolean
  external_influence_details: string | null

  // Notes
  what_went_right: string | null
  what_went_wrong: string | null
  lesson: string | null

  review_ai_response: string | null
  created_at: string
}

export type TradeReviewInput = Omit<TradeReview, 'id' | 'user_id' | 'created_at'>

// ── EOD Debrief form data (stored in session) ─────────────────────────────────

export interface EodDebriefData {
  net_pnl: number
  trade_management_review: string
  emotional_state_score: number    // 1-10
  emotional_state_notes: string
  best_decision: string
  worst_decision: string
  rule_violations: string
  session_grade: SessionGrade
  tomorrows_focus: string
}

// ── Combined session view (for hub / AI context) ──────────────────────────────

export interface SessionWithPlans extends AccountabilitySession_DB {
  challenge: TradingChallenge | null
  plans: (TradePlan & { review: TradeReview | null })[]
}
