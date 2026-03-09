// Supabase queries for marathon training module

import { createClient } from './server'
import { TRAINING_PLAN } from '@/lib/marathon/plan'

// ── Types ─────────────────────────────────────────────────────

export interface TrainingWeekRow {
  id: string
  user_id: string
  week_number: number
  week_label: string
  week_type: string
  planned_km: number | null
  actual_km: number | null
  status: 'upcoming' | 'in_progress' | 'completed'
  blood_donation_recovery: boolean
  notes: string | null
  created_at: string
}

export interface TrainingSessionRow {
  id: string
  user_id: string
  session_date: string
  week_number: number
  day_of_week: string
  planned_type: string
  planned_description: string | null
  planned_km: number | null
  planned_pace_min: string | null
  planned_pace_max: string | null
  has_strength: boolean
  strength_workout: string | null
  status: 'pending' | 'completed' | 'skipped' | 'modified'
  actual_km: number | null
  actual_avg_pace: string | null
  actual_avg_hr: number | null
  actual_duration_min: number | null
  pace_target_met: boolean | null
  pace_deviation_sec: number | null
  warmup_done: boolean | null
  post_fuel_done: boolean | null
  perceived_effort: number | null
  went_too_fast: boolean
  skipped_warmup: boolean
  notes: string | null
  ai_feedback: string | null
  coach_notes: string | null
  flag: 'ok' | 'warning' | 'rest' | null
  resting_hr: number | null
  created_at: string
  updated_at: string
}

export interface RaceResultRow {
  id: string
  user_id: string
  race_date: string
  race_name: string
  distance_km: number | null
  finish_time: string | null
  finish_time_seconds: number | null
  avg_pace: string | null
  official: boolean
  notes: string | null
  ai_debrief: string | null
  created_at: string
}

// ── Training Weeks ────────────────────────────────────────────

export async function getTrainingWeeks(): Promise<TrainingWeekRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('training_weeks')
    .select('*')
    .order('week_number', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getTrainingWeek(weekNumber: number): Promise<TrainingWeekRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('training_weeks')
    .select('*')
    .eq('week_number', weekNumber)
    .single()
  if (error) return null
  return data
}

export async function upsertTrainingWeek(
  weekNumber: number,
  updates: Partial<Pick<TrainingWeekRow, 'actual_km' | 'status' | 'notes'>>,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const plan = TRAINING_PLAN.find((w) => w.weekNumber === weekNumber)
  if (!plan) throw new Error(`Week ${weekNumber} not in plan`)

  const { error } = await supabase.from('training_weeks').upsert({
    user_id: user.id,
    week_number: weekNumber,
    week_label: plan.label,
    week_type: plan.weekType,
    planned_km: plan.plannedKm,
    blood_donation_recovery: plan.bloodDonationRecovery,
    ...updates,
  }, { onConflict: 'user_id,week_number' })
  if (error) throw error
}

// ── Training Sessions ─────────────────────────────────────────

export async function getSessionsForWeek(weekNumber: number): Promise<TrainingSessionRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('week_number', weekNumber)
    .order('session_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getSessionForDate(dateStr: string): Promise<TrainingSessionRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('session_date', dateStr)
    .single()
  if (error) return null
  return data
}

export async function getRecentSessions(limit = 10): Promise<TrainingSessionRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .neq('status', 'pending')
    .order('session_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function upsertSession(
  sessionDate: string,
  payload: Omit<TrainingSessionRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
): Promise<TrainingSessionRow> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('training_sessions')
    .upsert({ ...payload, user_id: user.id, session_date: sessionDate }, { onConflict: 'user_id,session_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSession(
  sessionDate: string,
  updates: Partial<Omit<TrainingSessionRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('training_sessions')
    .update(updates)
    .eq('session_date', sessionDate)
  if (error) throw error
}

// ── Race Results ──────────────────────────────────────────────

export async function getRaceResults(): Promise<RaceResultRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('race_results')
    .select('*')
    .order('race_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getRaceResult(raceName: string): Promise<RaceResultRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('race_results')
    .select('*')
    .eq('race_name', raceName)
    .single()
  if (error) return null
  return data
}

export async function upsertRaceResult(payload: Omit<RaceResultRow, 'id' | 'user_id' | 'created_at'>): Promise<RaceResultRow> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('race_results')
    .upsert({ ...payload, user_id: user.id }, { onConflict: 'user_id,race_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Dashboard summary ─────────────────────────────────────────

export async function getMarathonDashboardData() {
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const [weeksRes, sessionsRes, todaySessionRes, flaggedRes] = await Promise.all([
    supabase.from('training_weeks').select('*').order('week_number'),
    supabase
      .from('training_sessions')
      .select('*')
      .gte('session_date', today.slice(0, 8) + '01')  // this month
      .order('session_date', { ascending: false })
      .limit(20),
    supabase
      .from('training_sessions')
      .select('*')
      .eq('session_date', today)
      .single(),
    supabase
      .from('training_sessions')
      .select('session_date, went_too_fast, pace_deviation_sec, planned_type')
      .eq('went_too_fast', true)
      .order('session_date', { ascending: false })
      .limit(1),
  ])

  return {
    weeks: weeksRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    todaySession: todaySessionRes.data ?? null,
    lastFlag: flaggedRes.data?.[0] ?? null,
  }
}
