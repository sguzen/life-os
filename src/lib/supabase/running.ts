// P4: Supabase queries for running module

import { createClient } from './server'
import type { RunningActivity, RunningLap, RestingHrLog, RaceTarget } from '@/lib/types/running'

// ── Activities ────────────────────────────────────────────────

export async function getActivities(limit = 20): Promise<RunningActivity[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('running_activities')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getActivityById(id: string): Promise<RunningActivity | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('running_activities')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function updateActivity(
  id: string,
  updates: Partial<Pick<RunningActivity, 'name' | 'workout_type' | 'notes' | 'prescribed_pace_sec_per_km'>>,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('running_activities')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteActivity(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('running_activities')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Laps ─────────────────────────────────────────────────────

export async function getLapsForActivity(activityId: string): Promise<RunningLap[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('running_laps')
    .select('*')
    .eq('activity_id', activityId)
    .order('lap_number', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Resting HR ───────────────────────────────────────────────

export async function getRestingHrLogs(days = 30): Promise<RestingHrLog[]> {
  const supabase = await createClient()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const { data, error } = await supabase
    .from('resting_hr_logs')
    .select('*')
    .gte('logged_date', from.toISOString().split('T')[0])
    .order('logged_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertRestingHr(
  loggedDate: string,
  restingHr: number,
  source: 'garmin' | 'manual' = 'manual',
  notes?: string,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Compute spike client-side (same logic, reused from lib)
  const { detectRestingHrSpike } = await import('@/lib/running/hr-spike')
  const isSpike = await detectRestingHrSpike(supabase, user.id, restingHr)

  const { error } = await supabase.from('resting_hr_logs').upsert({
    user_id: user.id,
    logged_date: loggedDate,
    resting_hr: restingHr,
    source,
    is_spike: isSpike,
    notes: notes ?? null,
  }, { onConflict: 'user_id,logged_date' })
  if (error) throw error
}

// ── Race Targets ─────────────────────────────────────────────

export async function getRaceTargets(): Promise<RaceTarget[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('race_targets')
    .select('*')
    .order('race_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createRaceTarget(
  payload: Omit<RaceTarget, 'id' | 'user_id' | 'target_pace_sec_per_km' | 'created_at' | 'updated_at'>,
): Promise<RaceTarget> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('race_targets')
    .insert({ ...payload, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRaceTarget(
  id: string,
  updates: Partial<Pick<RaceTarget, 'race_name' | 'location' | 'race_date' | 'distance_km' | 'target_time_seconds' | 'actual_time_seconds' | 'activity_id' | 'notes'>>,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('race_targets')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteRaceTarget(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('race_targets')
    .delete()
    .eq('id', id)
  if (error) throw error
}
