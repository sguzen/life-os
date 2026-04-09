'use server'

import { createClient } from '@/lib/supabase/server'

export interface MarathonSession {
  scheduled_date: string   // YYYY-MM-DD
  workout_type: string
  target_distance: number  // km (NUMERIC in DB)
  target_pace: string      // e.g. "5:01/km"
}

/**
 * Deletes all future scheduled sessions (>= today) for the authenticated user.
 */
export async function clearMarathonPlan() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('marathon_plan')
    .delete()
    .eq('user_id', user.id)
    .gte('scheduled_date', today)

  if (error) throw new Error(error.message)
  return { success: true }
}

/**
 * Inserts an array of drafted sessions into marathon_plan for the authenticated user.
 */
export async function saveMarathonPlan(sessions: MarathonSession[]) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const rows = sessions.map((s) => ({
    user_id: user.id,
    scheduled_date: s.scheduled_date,
    workout_type: s.workout_type,
    target_distance: s.target_distance,
    target_pace: s.target_pace,
  }))

  const { error } = await supabase.from('marathon_plan').insert(rows)
  if (error) throw new Error(error.message)
  return { success: true }
}
