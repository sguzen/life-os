import type { SupabaseClient } from '@supabase/supabase-js'

export type GoalCategory = 'training' | 'nutrition' | 'work' | 'hobby' | 'morning'

export interface UserGoal {
  id: string
  category: GoalCategory
  title: string
  description: string | null
  target_metrics: Record<string, unknown>
  is_active: boolean
}

export interface DailyLog {
  id: string
  category: GoalCategory
  date: string
  metrics: Record<string, unknown>
  journal_notes: string | null
  created_at: string
}

export async function getActiveGoals(
  supabase: SupabaseClient,
  category: GoalCategory
): Promise<UserGoal[]> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('id, category, title, description, target_metrics, is_active')
    .eq('category', category)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) return []
  return data ?? []
}

export async function getRecentLogs(
  supabase: SupabaseClient,
  category: GoalCategory,
  limit = 7
): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('id, category, date, metrics, journal_notes, created_at')
    .eq('category', category)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) return []
  return data ?? []
}

export async function upsertDailyLog(
  supabase: SupabaseClient,
  userId: string,
  category: GoalCategory,
  date: string,
  metrics: Record<string, unknown>,
  journalNotes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('daily_logs')
    .upsert(
      {
        user_id: userId,
        category,
        date,
        metrics,
        journal_notes: journalNotes ?? null,
      },
      { onConflict: 'user_id,category,date' }
    )

  return { error: error?.message ?? null }
}
