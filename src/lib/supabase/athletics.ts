// Athletics module — DB layer for training_schedule and cross-module queries
// The training_schedule table mirrors the 9-week plan from lib/marathon/plan.ts
// but is stored per-user in Supabase so it can be extended or modified.

import { createClient } from './server'
import { TRAINING_PLAN, type SessionType } from '@/lib/marathon/plan'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TrainingScheduleRow {
  id: string
  user_id: string
  date: string              // YYYY-MM-DD
  title: string
  description: string | null
  target_distance: number | null  // km
  target_pace: string | null      // "6:20/km"
  type: 'base' | 'interval' | 'long' | 'rest' | 'race'
  week_number: number | null
  day_of_week: string | null
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Map from the plan's SessionType to the four canonical types stored in DB */
function mapSessionType(type: SessionType): TrainingScheduleRow['type'] {
  switch (type) {
    case 'EASY':
    case 'SHAKEOUT': return 'base'
    case 'VO2_MAX':
    case 'TEMPO':
    case 'HILLS':    return 'interval'
    case 'LONG_RUN': return 'long'
    case 'REST':     return 'rest'
    case 'RACE':     return 'race'
    default:         return 'base'
  }
}

const SESSION_TITLES: Record<SessionType, string> = {
  EASY:      'Easy Run',
  VO2_MAX:   'VO2 Max',
  TEMPO:     'Tempo Run',
  HILLS:     'Hill Repeats',
  LONG_RUN:  'Long Run',
  REST:      'Rest Day',
  RACE:      'Race',
  SHAKEOUT:  'Shakeout',
}

// ── Seeding ────────────────────────────────────────────────────────────────

/**
 * Idempotently seeds the full 9-week training plan into training_schedule
 * for the authenticated user. Skips if any rows already exist.
 */
export async function seedTrainingSchedule(): Promise<{ seeded: number; skipped: boolean }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { seeded: 0, skipped: true }

  const { count } = await supabase
    .from('training_schedule')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) > 0) return { seeded: 0, skipped: true }

  const rows: Omit<TrainingScheduleRow, 'id' | 'created_at'>[] = []

  for (const week of TRAINING_PLAN) {
    const startDate = new Date(week.dateRange.start + 'T12:00:00')

    for (let i = 0; i < week.sessions.length; i++) {
      const session = week.sessions[i]
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]

      rows.push({
        user_id: user.id,
        date: dateStr,
        title: SESSION_TITLES[session.type] ?? session.type,
        description: session.description || null,
        target_distance: session.plannedKm,
        target_pace: session.paceMin ? `${session.paceMin}/km` : null,
        type: mapSessionType(session.type),
        week_number: week.weekNumber,
        day_of_week: session.dayOfWeek,
      })
    }
  }

  const { error } = await supabase.from('training_schedule').insert(rows)
  if (error) throw error

  return { seeded: rows.length, skipped: false }
}

// ── Queries ────────────────────────────────────────────────────────────────

/** Today's scheduled workout for the authenticated user (null if none / rest) */
export async function getScheduledWorkout(date: string): Promise<TrainingScheduleRow | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('training_schedule')
    .select('*')
    .eq('date', date)
    .single()
  return data ?? null
}

/** Schedule rows for a date range (inclusive) */
export async function getScheduleForDateRange(
  start: string,
  end: string
): Promise<TrainingScheduleRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('training_schedule')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** This calendar week's schedule (Monday–Sunday of the current week) */
export async function getThisWeekSchedule(): Promise<TrainingScheduleRow[]> {
  const today = new Date()
  const dow = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return getScheduleForDateRange(
    monday.toISOString().split('T')[0],
    sunday.toISOString().split('T')[0]
  )
}

/** Most recent activity uploaded today, if any */
export async function getTodayActivity() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('running_activities')
    .select('*')
    .gte('started_at', today + 'T00:00:00+00:00')
    .lt('started_at', today + 'T23:59:59+00:00')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
  return data ?? null
}
