// Nutrition Tracking — Supabase query functions

import { createClient } from './client'
import type {
  NutritionLog,
  NutritionLogInput,
  SupplementLog,
  SupplementLogInput,
  BodyMeasurement,
  BodyMeasurementInput,
  MealStatus,
} from '@/lib/types/nutrition'
import { calculateAdherence } from '@/lib/types/nutrition'

// ── Nutrition Logs ────────────────────────────────────────────────────────────

export async function getNutritionLog(date: string): Promise<NutritionLog | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('log_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertNutritionLog(
  logDate: string,
  input: NutritionLogInput
): Promise<NutritionLog> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Compute adherence score from merged state
  const { data: existing } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('log_date', logDate)
    .eq('user_id', user.id)
    .maybeSingle()

  const merged = { ...(existing ?? {}), ...input }
  const adherence_score = calculateAdherence(merged as Partial<NutritionLog>)

  const { data, error } = await supabase
    .from('nutrition_logs')
    .upsert(
      {
        user_id: user.id,
        log_date: logDate,
        ...input,
        adherence_score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,log_date' }
    )
    .select()
    .single()

  if (error) throw error

  // Cross-reference: if alcohol flagged, block tomorrow's trading gate
  if (input.alcohol_consumed === true) {
    const tomorrow = new Date(logDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    await blockTradingGate(user.id, tomorrowStr)
  }

  return data
}

async function blockTradingGate(userId: string, sessionDate: string) {
  const supabase = createClient()
  try {
    await supabase.from('accountability_sessions').upsert(
      {
        user_id: userId,
        session_date: sessionDate,
        gate_pre_blocked: true,
        gate_block_reason: 'Alcohol logged last night via nutrition tracker',
      },
      { onConflict: 'user_id,session_date' }
    )
  } catch {
    // Non-fatal — trading gate cross-reference is best-effort
  }
}

export async function getNutritionHistory(
  limit = 30
): Promise<Array<{ log_date: string; adherence_score: number | null; alcohol_consumed: boolean }>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('log_date, adherence_score, alcohol_consumed')
    .order('log_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ── Supplement Logs ───────────────────────────────────────────────────────────

export async function getSupplementLog(date: string): Promise<SupplementLog | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('log_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertSupplementLog(
  logDate: string,
  input: SupplementLogInput
): Promise<SupplementLog> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('supplement_logs')
    .upsert(
      {
        user_id: user.id,
        log_date: logDate,
        ...input,
      },
      { onConflict: 'user_id,log_date' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSupplementWeeklyCount(
  supplement: 'vitamin_d3_taken' | 'b12_taken'
): Promise<number> {
  const supabase = createClient()
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))

  const { data, error } = await supabase
    .from('supplement_logs')
    .select(supplement)
    .gte('log_date', monday.toISOString().slice(0, 10))
    .lte('log_date', today.toISOString().slice(0, 10))

  if (error) return 0
  return (data ?? []).filter((row) => row[supplement] === true).length
}

// ── Body Measurements ─────────────────────────────────────────────────────────

export async function getBodyMeasurements(limit = 50): Promise<BodyMeasurement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .order('measured_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function insertBodyMeasurement(
  input: BodyMeasurementInput
): Promise<BodyMeasurement> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('body_measurements')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Iron Frequency Logic ──────────────────────────────────────────────────────

export async function isBloodDonationRecovery(): Promise<boolean> {
  const supabase = createClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 14)

  const { data } = await supabase
    .from('running_activities')
    .select('id')
    .eq('blood_donation_recovery', true)
    .gte('started_at', cutoff.toISOString())
    .limit(1)
    .maybeSingle()

  return !!data
}

// ── Supplement compliance count (for dashboard widget) ───────────────────────

export function countSupplementsTaken(log: SupplementLog | null): number {
  if (!log) return 0
  const fields: Array<keyof SupplementLog> = [
    'no3_taken',
    'zentius_taken',
    'zinc_taken',
    'folic_acid_taken',
    'mg_bisglycinate_taken',
    'mg_melatonin_taken',
    'se_ace_zinc_taken',
    'iron_taken',
  ]
  return fields.filter((f) => log[f] === true).length
}

// ── Server-side helpers (for server components) ───────────────────────────────

export async function getServerNutritionLog(
  supabase: ReturnType<typeof import('./server').createClient>,
  date: string
): Promise<NutritionLog | null> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('log_date', date)
    .maybeSingle()
  if (error) return null
  return data
}

export async function getServerSupplementLog(
  supabase: ReturnType<typeof import('./server').createClient>,
  date: string
): Promise<SupplementLog | null> {
  const { data, error } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('log_date', date)
    .maybeSingle()
  if (error) return null
  return data
}

export async function getServerBodyMeasurements(
  supabase: ReturnType<typeof import('./server').createClient>
): Promise<BodyMeasurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .order('measured_at', { ascending: true })
  if (error) return []
  return data ?? []
}

export async function getServerNutritionHistory(
  supabase: ReturnType<typeof import('./server').createClient>,
  limit = 90
): Promise<Array<{ log_date: string; adherence_score: number | null; alcohol_consumed: boolean }>> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('log_date, adherence_score, alcohol_consumed')
    .order('log_date', { ascending: false })
    .limit(limit)
  if (error) return []
  return data ?? []
}
