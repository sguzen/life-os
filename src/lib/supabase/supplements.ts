// Supplement Manager — Supabase query functions

import { createClient } from './client'
import type {
  Supplement,
  SupplementUpdate,
  SupplementLogEntry,
} from '@/lib/types/supplements'

// ── Read ──────────────────────────────────────────────────────

export async function getSupplements(): Promise<Supplement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getAllSupplements(): Promise<Supplement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getSupplementById(id: string): Promise<Supplement | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// ── Create / Update / Delete ──────────────────────────────────

export async function createSupplement(input: SupplementUpdate): Promise<Supplement> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('supplements')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSupplement(
  id: string,
  updates: SupplementUpdate,
  reason?: string,
  changedBy: 'user' | 'ai_coach' = 'user'
): Promise<Supplement> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Snapshot current for audit
  const { data: current } = await supabase
    .from('supplements')
    .select('*')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('supplements')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) throw error

  // Record change
  await supabase.from('supplement_changes').insert({
    supplement_id: id,
    user_id: user.id,
    change_type: 'update',
    previous_value: current as Record<string, unknown>,
    new_value: updates as Record<string, unknown>,
    reason: reason ?? null,
    changed_by: changedBy,
  })

  return data
}

export async function pauseSupplement(id: string, reason: string, resumeAt?: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const today = new Date().toISOString().slice(0, 10)
  await supabase.from('supplements').update({
    is_paused: true,
    pause_reason: reason,
    paused_at: today,
    resume_at: resumeAt ?? null,
  }).eq('id', id).eq('user_id', user.id)

  await supabase.from('supplement_changes').insert({
    supplement_id: id,
    user_id: user.id,
    change_type: 'pause',
    new_value: { reason, resume_at: resumeAt },
    changed_by: 'user',
  })
}

export async function resumeSupplement(id: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  await supabase.from('supplements').update({
    is_paused: false,
    pause_reason: null,
    paused_at: null,
    resume_at: null,
  }).eq('id', id).eq('user_id', user.id)

  await supabase.from('supplement_changes').insert({
    supplement_id: id,
    user_id: user.id,
    change_type: 'resume',
    changed_by: 'user',
  })
}

export async function endSupplementCourse(id: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const today = new Date().toISOString().slice(0, 10)
  await supabase.from('supplements').update({
    is_active: false,
    end_date: today,
  }).eq('id', id).eq('user_id', user.id)

  await supabase.from('supplement_changes').insert({
    supplement_id: id,
    user_id: user.id,
    change_type: 'end_course',
    new_value: { end_date: today },
    changed_by: 'user',
  })
}

// ── Daily Logs ────────────────────────────────────────────────

export async function getSupplementLogsForDate(date: string): Promise<SupplementLogEntry[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplement_log_entries')
    .select('*')
    .eq('log_date', date)
  if (error) throw error
  return data ?? []
}

export async function upsertSupplementLog(
  supplementId: string,
  date: string,
  taken: boolean,
  skippedReason?: string
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await supabase.from('supplement_log_entries').upsert(
    {
      user_id: user.id,
      supplement_id: supplementId,
      log_date: date,
      taken,
      taken_at: taken ? new Date().toISOString() : null,
      skipped_reason: skippedReason ?? null,
    },
    { onConflict: 'user_id,supplement_id,log_date' }
  )
}

// ── Seed default supplements if none exist ────────────────────

const DEFAULT_SUPPLEMENTS: Omit<Supplement, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'NO 3', brand: null,
    dose_amount: null, dose_unit: 'tablet', dose_count: 15,
    frequency: 'daily', frequency_days: null, frequency_times_per_week: null,
    timing: null, timing_notes: 'Dissolve in mouth, 5-5-5 pattern', take_with_food: false,
    has_duration: true, start_date: null, end_date: null, duration_days: 90, duration_notes: null,
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: null, notes: null, blood_donation_override: false,
  },
  {
    name: 'Vitamin D3', brand: 'Health Aid',
    dose_amount: 50000, dose_unit: 'IU', dose_count: 1,
    frequency: 'weekly', frequency_days: null, frequency_times_per_week: 1,
    timing: 'with_food', timing_notes: null, take_with_food: true,
    has_duration: true, start_date: null, end_date: null, duration_days: 91, duration_notes: 'Test at week 13',
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: 'Vitamin D deficiency', notes: null, blood_donation_override: false,
  },
  {
    name: 'Zentius Flash', brand: null,
    dose_amount: null, dose_unit: 'tablet', dose_count: 2,
    frequency: 'daily', frequency_days: null, frequency_times_per_week: null,
    timing: null, timing_notes: 'Dissolve in mouth. Switch to NO 2 when finished.', take_with_food: false,
    has_duration: false, start_date: null, end_date: null, duration_days: null, duration_notes: null,
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: null, notes: null, blood_donation_override: false,
  },
  {
    name: 'Zinc Bisglycinate', brand: null,
    dose_amount: 25, dose_unit: 'mg', dose_count: 1,
    frequency: 'daily', frequency_days: null, frequency_times_per_week: null,
    timing: null, timing_notes: null, take_with_food: false,
    has_duration: false, start_date: null, end_date: null, duration_days: null, duration_notes: 'Stop when bottle finished',
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: null, notes: null, blood_donation_override: false,
  },
  {
    name: 'B12', brand: null,
    dose_amount: 5000, dose_unit: 'mcg', dose_count: 1,
    frequency: 'twice_weekly', frequency_days: null, frequency_times_per_week: 2,
    timing: null, timing_notes: 'Chewable. Switch to NOW 1000mcg sublingual after.', take_with_food: false,
    has_duration: false, start_date: null, end_date: null, duration_days: null, duration_notes: null,
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: 'B12 history: 741/862/368/724/611/450', notes: null, blood_donation_override: false,
  },
  {
    name: 'Folic Acid', brand: null,
    dose_amount: 5, dose_unit: 'mg', dose_count: 1,
    frequency: 'daily', frequency_days: null, frequency_times_per_week: null,
    timing: 'with_food', timing_notes: null, take_with_food: true,
    has_duration: true, start_date: null, end_date: null, duration_days: 30, duration_notes: 'Daily for 1 month, then switch to 3x/week',
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: null, notes: null, blood_donation_override: false,
  },
  {
    name: 'Magnesium Bisglycinate', brand: null,
    dose_amount: null, dose_unit: 'tablet', dose_count: null,
    frequency: 'daily', frequency_days: null, frequency_times_per_week: null,
    timing: null, timing_notes: null, take_with_food: false,
    has_duration: false, start_date: null, end_date: null, duration_days: null, duration_notes: null,
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: null, notes: null, blood_donation_override: false,
  },
  {
    name: 'Magnesium Diasporal + Melatonin', brand: null,
    dose_amount: null, dose_unit: 'sachet', dose_count: 1,
    frequency: 'daily', frequency_days: null, frequency_times_per_week: null,
    timing: 'before_bed', timing_notes: 'Dissolve in mouth every night', take_with_food: false,
    has_duration: false, start_date: null, end_date: null, duration_days: null, duration_notes: null,
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: null, notes: null, blood_donation_override: false,
  },
  {
    name: 'Se ACE Zinc', brand: 'Health Aid',
    dose_amount: null, dose_unit: 'tablet', dose_count: 1,
    frequency: 'daily', frequency_days: null, frequency_times_per_week: null,
    timing: 'with_food', timing_notes: null, take_with_food: true,
    has_duration: true, start_date: null, end_date: null, duration_days: 120, duration_notes: null,
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: null, notes: null, blood_donation_override: false,
  },
  {
    name: 'Iron', brand: null,
    dose_amount: null, dose_unit: null, dose_count: null,
    frequency: 'every_other_day', frequency_days: null, frequency_times_per_week: null,
    timing: null, timing_notes: null, take_with_food: false,
    has_duration: false, start_date: null, end_date: null, duration_days: null, duration_notes: null,
    is_active: true, is_paused: false, pause_reason: null, paused_at: null, resume_at: null,
    prescribed_by: 'Emine Ömerağa', prescribed_for: 'Ferritin history: 33.71/32.7/9.5/13.62/16', notes: null, blood_donation_override: true,
  },
]

export async function seedDefaultSupplements(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase
    .from('supplements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) > 0) return // already seeded

  const today = new Date().toISOString().slice(0, 10)
  await supabase.from('supplements').insert(
    DEFAULT_SUPPLEMENTS.map((s) => ({
      ...s,
      user_id: user.id,
      start_date: s.has_duration ? today : null,
      end_date: s.has_duration && s.duration_days
        ? new Date(Date.now() + s.duration_days * 86400000).toISOString().slice(0, 10)
        : null,
    }))
  )
}
