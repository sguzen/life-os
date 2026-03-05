// P4-05: Resting HR spike detection
// A spike is defined as: today's resting HR ≥ 7-day rolling average + 5 bpm.
// Baseline range: 42–49 bpm (user's normal resting HR).

import type { SupabaseClient } from '@supabase/supabase-js'

export const RESTING_HR_BASELINE_LOW = 42
export const RESTING_HR_BASELINE_HIGH = 49
export const SPIKE_THRESHOLD_BPM = 5
export const ROLLING_WINDOW_DAYS = 7

/**
 * Returns true if `todayHr` is ≥ 5 bpm above the 7-day rolling average
 * (excluding today so we don't contaminate the baseline).
 */
export async function detectRestingHrSpike(
  supabase: SupabaseClient,
  userId: string,
  todayHr: number,
): Promise<boolean> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - ROLLING_WINDOW_DAYS)
  const fromDate = sevenDaysAgo.toISOString().split('T')[0]
  const todayDate = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('resting_hr_logs')
    .select('resting_hr')
    .eq('user_id', userId)
    .gte('logged_date', fromDate)
    .lt('logged_date', todayDate)  // exclude today
    .order('logged_date', { ascending: false })

  if (error || !data || data.length === 0) {
    // Not enough history — use the baseline midpoint (45.5) as the reference
    const baseline = (RESTING_HR_BASELINE_LOW + RESTING_HR_BASELINE_HIGH) / 2
    return todayHr >= baseline + SPIKE_THRESHOLD_BPM
  }

  const avg = data.reduce((sum, r) => sum + r.resting_hr, 0) / data.length
  return todayHr >= avg + SPIKE_THRESHOLD_BPM
}

/**
 * Client-side helper: compute rolling average from a sorted array of HR logs.
 * Used to annotate the chart without a server round-trip.
 */
export function computeRollingAvg(
  logs: Array<{ logged_date: string; resting_hr: number }>,
  windowDays: number = ROLLING_WINDOW_DAYS,
): Array<{ logged_date: string; resting_hr: number; rolling_avg: number; is_spike: boolean }> {
  return logs.map((log, i) => {
    const windowStart = Math.max(0, i - windowDays + 1)
    const window = logs.slice(windowStart, i) // exclude self (same as server logic)
    const avg =
      window.length > 0
        ? window.reduce((s, r) => s + r.resting_hr, 0) / window.length
        : (RESTING_HR_BASELINE_LOW + RESTING_HR_BASELINE_HIGH) / 2
    return {
      ...log,
      rolling_avg: Math.round(avg * 10) / 10,
      is_spike: log.resting_hr >= avg + SPIKE_THRESHOLD_BPM,
    }
  })
}
