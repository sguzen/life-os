// Trading Accountability System — Supabase query functions

import { createClient } from './client'
import type {
  TradingChallenge,
  TradingChallengeInput,
  AccountabilitySession_DB,
  AccountabilitySessionInput,
  TradePlan,
  TradePlanInput,
  TradeReview,
  TradeReviewInput,
  SessionWithPlans,
} from '@/lib/types/accountability'

// ── Trading Challenges ────────────────────────────────────────────────────────

export async function getChallenges(): Promise<TradingChallenge[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trading_challenges')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getActiveChallenge(): Promise<TradingChallenge | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trading_challenges')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createChallenge(input: TradingChallengeInput): Promise<TradingChallenge> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('trading_challenges')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateChallenge(
  id: string,
  input: Partial<TradingChallengeInput>
): Promise<TradingChallenge> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trading_challenges')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteChallenge(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('trading_challenges').delete().eq('id', id)
  if (error) throw error
}

/** Deactivates all challenges, then activates the given one */
export async function setActiveChallenge(id: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Deactivate all
  await supabase
    .from('trading_challenges')
    .update({ is_active: false })
    .eq('user_id', user.id)

  // Activate target
  const { error } = await supabase
    .from('trading_challenges')
    .update({ is_active: true })
    .eq('id', id)
  if (error) throw error
}

// ── Accountability Sessions ───────────────────────────────────────────────────

export async function getAccountabilitySession(date: string): Promise<AccountabilitySession_DB | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accountability_sessions')
    .select('*')
    .eq('session_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertAccountabilitySession(
  input: AccountabilitySessionInput
): Promise<AccountabilitySession_DB> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('accountability_sessions')
    .upsert(
      { ...input, user_id: user.id },
      { onConflict: 'user_id,session_date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/** Load today's session with all plans and reviews */
export async function getSessionWithPlans(date: string): Promise<SessionWithPlans | null> {
  const supabase = createClient()

  const { data: session, error: sErr } = await supabase
    .from('accountability_sessions')
    .select('*')
    .eq('session_date', date)
    .maybeSingle()
  if (sErr) throw sErr
  if (!session) return null

  // Load active challenge
  const { data: challenge } = await supabase
    .from('trading_challenges')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  // Load plans + reviews for this session
  const { data: plans, error: pErr } = await supabase
    .from('trade_plans')
    .select('*, trade_reviews(*)')
    .eq('session_id', session.id)
    .order('plan_number')
  if (pErr) throw pErr

  const plansWithReviews = (plans ?? []).map((p: TradePlan & { trade_reviews?: TradeReview[] }) => ({
    ...p,
    review: p.trade_reviews?.[0] ?? null,
  }))

  return {
    ...session,
    challenge: challenge ?? null,
    plans: plansWithReviews,
  }
}

// ── Trade Plans ───────────────────────────────────────────────────────────────

export async function getTradePlans(sessionId: string): Promise<TradePlan[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trade_plans')
    .select('*')
    .eq('session_id', sessionId)
    .order('plan_number')
  if (error) throw error
  return data ?? []
}

export async function getTradePlanById(id: string): Promise<TradePlan | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trade_plans')
    .select('*')
    .eq('id', id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function createTradePlan(input: TradePlanInput): Promise<TradePlan> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('trade_plans')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTradePlan(
  id: string,
  input: Partial<Omit<TradePlanInput, 'session_id' | 'plan_number'>>
): Promise<TradePlan> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trade_plans')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Trade Reviews ─────────────────────────────────────────────────────────────

export async function getTradeReviewByPlanId(planId: string): Promise<TradeReview | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trade_reviews')
    .select('*')
    .eq('plan_id', planId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createTradeReview(input: TradeReviewInput): Promise<TradeReview> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('trade_reviews')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

/** After a review is submitted, update consecutive_losses and revenge_lock on the session */
export async function updateSessionGuardrails(
  sessionId: string,
  outcome: string,
  externalInfluence: boolean
): Promise<AccountabilitySession_DB> {
  const supabase = createClient()

  // Get current session
  const { data: session, error: sErr } = await supabase
    .from('accountability_sessions')
    .select('consecutive_losses, external_influence_flagged')
    .eq('id', sessionId)
    .single()
  if (sErr) throw sErr

  const isLoss = outcome === 'Loss'
  const newConsecutiveLosses = isLoss ? (session.consecutive_losses ?? 0) + 1 : 0
  const revengeLock = newConsecutiveLosses >= 2

  const { data, error } = await supabase
    .from('accountability_sessions')
    .update({
      consecutive_losses: newConsecutiveLosses,
      revenge_lock_triggered: revengeLock,
      external_influence_flagged: externalInfluence || session.external_influence_flagged,
    })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}
