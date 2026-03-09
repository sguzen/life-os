'use server'

import { createClient } from '@/lib/supabase/server'
import type { MorningLogInput, MorningLog } from '@/lib/types/morning-log'

export async function saveMorningLog(
  data: MorningLogInput
): Promise<{ id: string; isNew: boolean }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const log_date = data.log_date ?? new Date().toISOString().slice(0, 10)

  // Check if a row already exists for today
  const { data: existing } = await supabase
    .from('morning_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('log_date', log_date)
    .maybeSingle()

  const payload = { ...data, log_date, user_id: user.id }

  const { data: row, error } = await supabase
    .from('morning_logs')
    .upsert(payload, { onConflict: 'user_id,log_date' })
    .select('id')
    .single()

  if (error || !row) throw new Error(error?.message ?? 'Failed to save morning log')

  return { id: row.id, isNew: !existing }
}

export async function getTodaysMorningLog(): Promise<MorningLog | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('morning_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .maybeSingle()

  return data as MorningLog | null
}

export async function getRecentMorningLogs(days: number): Promise<MorningLog[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data } = await supabase
    .from('morning_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('log_date', cutoffStr)
    .order('log_date', { ascending: false })

  return (data ?? []) as MorningLog[]
}
