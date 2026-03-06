// Supabase queries for the Adaptive Replanning Engine

import { createClient } from './server'
import type {
  AdaptationEvent,
  AdaptationAdjustment,
  RecoveryCheckin,
  AdaptationProposals,
  AdaptModule,
} from '@/lib/types'

// ── Adaptation Events ─────────────────────────────────────────

export async function getActiveAdaptationEvent(): Promise<AdaptationEvent | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('adaptation_events')
    .select('*')
    .in('status', ['pending', 'adjustments_proposed', 'approved'])
    .order('reported_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as AdaptationEvent | null
}

export async function getAdaptationEvent(eventId: string): Promise<AdaptationEvent | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('adaptation_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  return data as AdaptationEvent | null
}

export async function getAllAdaptationEvents(): Promise<AdaptationEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('adaptation_events')
    .select('*')
    .order('reported_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdaptationEvent[]
}

export interface CreateAdaptationEventInput {
  trigger_type: string
  severity: number
  symptoms?: string | null
  affected_body_part?: string | null
  sleep_hours?: number | null
  resting_hr?: number | null
  estimated_days?: number | null
  notes?: string | null
}

export async function createAdaptationEvent(
  input: CreateAdaptationEventInput
): Promise<AdaptationEvent> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('adaptation_events')
    .insert({
      user_id: user.id,
      trigger_type: input.trigger_type,
      severity: input.severity,
      symptoms: input.symptoms ?? null,
      affected_body_part: input.affected_body_part ?? null,
      sleep_hours: input.sleep_hours ?? null,
      resting_hr: input.resting_hr ?? null,
      estimated_days: input.estimated_days ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as AdaptationEvent
}

export async function updateAdaptationEventTriage(
  eventId: string,
  aiTriage: string
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('adaptation_events')
    .update({
      ai_triage: aiTriage,
      ai_generated_at: new Date().toISOString(),
      status: 'adjustments_proposed',
    })
    .eq('id', eventId)
  if (error) throw error
}

export async function updateAdaptationEventStatus(
  eventId: string,
  status: string,
  extra?: { recovery_confirmed_at?: string }
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('adaptation_events')
    .update({ status, ...extra })
    .eq('id', eventId)
  if (error) throw error
}

// ── Adaptation Adjustments ────────────────────────────────────

export async function getAdjustmentsForEvent(
  eventId: string
): Promise<AdaptationAdjustment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('adaptation_adjustments')
    .select('*')
    .eq('event_id', eventId)
    .order('target_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as AdaptationAdjustment[]
}

interface AdjustmentInsert {
  event_id: string
  module: AdaptModule
  target_date: string
  target_description?: string | null
  change_type: string
  original_value?: Record<string, unknown> | null
  adjusted_value?: Record<string, unknown> | null
  reasoning?: string | null
}

export async function insertAdjustments(
  adjustments: AdjustmentInsert[]
): Promise<void> {
  if (adjustments.length === 0) return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const rows = adjustments.map((a) => ({ ...a, user_id: user.id }))
  const { error } = await supabase.from('adaptation_adjustments').insert(rows)
  if (error) throw error
}

export async function updateAdjustmentApproval(
  adjustmentId: string,
  approved: boolean,
  userOverride?: string
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('adaptation_adjustments')
    .update({ approved, user_override: userOverride ?? null })
    .eq('id', adjustmentId)
  if (error) throw error
}

export async function markAdjustmentApplied(adjustmentId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('adaptation_adjustments')
    .update({ applied_at: new Date().toISOString() })
    .eq('id', adjustmentId)
  if (error) throw error
}

// Apply approved marathon adjustments to training_sessions
export async function applyMarathonAdjustments(
  eventId: string,
  adjustments: AdaptationAdjustment[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  for (const adj of adjustments) {
    if (adj.module !== 'marathon' || adj.approved !== true) continue
    const val = adj.adjusted_value as Record<string, unknown> | null
    if (!val) continue

    await supabase.from('training_sessions').upsert({
      user_id: user.id,
      session_date: adj.target_date,
      week_number: (val.week_number as number) ?? 0,
      day_of_week: (val.day_of_week as string) ?? '',
      planned_type: (val.adjusted_type as string) ?? 'REST',
      planned_description: (val.adjusted_description as string) ?? null,
      planned_km: (val.adjusted_km as number) ?? 0,
      notes: `[Adapted] ${adj.reasoning ?? ''}`,
    }, { onConflict: 'user_id,session_date' })

    await markAdjustmentApplied(adj.id)
  }
}

// Apply approved nutrition adjustments to nutrition_logs
export async function applyNutritionAdjustments(
  eventId: string,
  adjustments: AdaptationAdjustment[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  for (const adj of adjustments) {
    if (adj.module !== 'nutrition' || adj.approved !== true) continue
    const val = adj.adjusted_value as Record<string, unknown> | null
    if (!val) continue

    await supabase.from('nutrition_logs').upsert({
      user_id: user.id,
      log_date: adj.target_date,
      water_target_ml: val.water_target_ml ?? null,
      calorie_modifier: val.calorie_modifier ?? null,
      adaptation_meal_notes: val.meal_modifications
        ? JSON.stringify(val.meal_modifications)
        : null,
      adaptation_supplements: val.supplement_additions ?? null,
      adaptation_foods_prioritise: val.foods_to_prioritise ?? null,
      adaptation_foods_avoid: val.foods_to_avoid ?? null,
      adaptation_event_id: eventId,
    }, { onConflict: 'user_id,log_date' })

    await markAdjustmentApplied(adj.id)
  }
}

// Apply approved trading adjustments to trading_sessions
export async function applyTradingAdjustments(
  eventId: string,
  adjustments: AdaptationAdjustment[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  for (const adj of adjustments) {
    if (adj.module !== 'trading' || adj.approved !== true) continue
    const val = adj.adjusted_value as Record<string, unknown> | null
    if (!val) continue

    await supabase.from('trading_sessions').upsert({
      user_id: user.id,
      session_date: adj.target_date,
      gate_recommendation_override: val.gate_recommendation ?? null,
      gate_override_reason: adj.reasoning ?? null,
      adaptation_event_id: eventId,
    }, { onConflict: 'user_id,session_date' })

    await markAdjustmentApplied(adj.id)
  }
}

// ── Recovery Check-ins ────────────────────────────────────────

export async function getCheckinsForEvent(
  eventId: string
): Promise<RecoveryCheckin[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recovery_checkins')
    .select('*')
    .eq('event_id', eventId)
    .order('checkin_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as RecoveryCheckin[]
}

export async function getTodayCheckin(
  eventId: string,
  today: string
): Promise<RecoveryCheckin | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recovery_checkins')
    .select('*')
    .eq('event_id', eventId)
    .eq('checkin_date', today)
    .maybeSingle()
  if (error) throw error
  return data as RecoveryCheckin | null
}

export interface CreateCheckinInput {
  event_id: string
  checkin_date: string
  feeling_score: number
  symptoms_present: boolean
  resting_hr?: number | null
  notes?: string | null
  ai_recommendation?: string | null
}

export async function createRecoveryCheckin(
  input: CreateCheckinInput
): Promise<RecoveryCheckin> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recovery_checkins')
    .upsert({
      user_id: user.id,
      event_id: input.event_id,
      checkin_date: input.checkin_date,
      feeling_score: input.feeling_score,
      symptoms_present: input.symptoms_present,
      resting_hr: input.resting_hr ?? null,
      notes: input.notes ?? null,
      ai_recommendation: input.ai_recommendation ?? null,
    }, { onConflict: 'event_id,checkin_date' })
    .select()
    .single()
  if (error) throw error
  return data as RecoveryCheckin
}

// ── Proposal → Adjustment conversion ─────────────────────────

export async function saveProposalsAsAdjustments(
  eventId: string,
  proposals: AdaptationProposals
): Promise<void> {
  const rows: AdjustmentInsert[] = []

  for (const m of proposals.marathon_adjustments) {
    rows.push({
      event_id: eventId,
      module: 'marathon',
      target_date: m.date,
      target_description: `${m.original_type} ${m.original_description}`,
      change_type: m.adjusted_type === 'REST' ? 'convert_to_rest'
        : m.adjusted_km < m.original_km ? 'reduce_volume'
        : 'convert_to_easy',
      original_value: {
        type: m.original_type,
        description: m.original_description,
        km: m.original_km,
      },
      adjusted_value: {
        adjusted_type: m.adjusted_type,
        adjusted_description: m.adjusted_description,
        adjusted_km: m.adjusted_km,
      },
      reasoning: m.reasoning,
    })
  }

  for (const n of proposals.nutrition_adjustments) {
    rows.push({
      event_id: eventId,
      module: 'nutrition',
      target_date: n.date,
      target_description: `Nutrition ${n.date}`,
      change_type: 'increase_calories',
      original_value: null,
      adjusted_value: {
        water_target_ml: n.water_target_ml,
        calorie_modifier: n.calorie_modifier,
        meal_modifications: n.meal_modifications,
        supplement_additions: n.supplement_additions,
        foods_to_prioritise: n.foods_to_prioritise,
        foods_to_avoid: n.foods_to_avoid,
      },
      reasoning: n.reasoning,
    })
  }

  for (const t of proposals.trading_adjustments) {
    rows.push({
      event_id: eventId,
      module: 'trading',
      target_date: t.date,
      target_description: `Trading gate ${t.date}`,
      change_type: t.gate_recommendation,
      original_value: { gate_recommendation: 'trade_normally' },
      adjusted_value: { gate_recommendation: t.gate_recommendation },
      reasoning: t.reasoning,
    })
  }

  await insertAdjustments(rows)
}
