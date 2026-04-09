'use server'

import { createClient } from '@/lib/supabase/server'
import type { MorningLog, MorningLogInput } from '@/lib/types/morning-log'

export async function submitMorningLog(
  data: MorningLogInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const log_date = data.log_date ?? new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('morning_logs')
    .upsert({ ...data, log_date, user_id: user.id }, { onConflict: 'user_id,log_date' })

  if (error) return { success: false, error: error.message }
  return { success: true }
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
