// GET /api/ai/proactive-greeting
// Called once per day on dashboard load (client caches in sessionStorage).
// Returns check-in status + proactive flags derived from user data.

import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export type ProactiveFlag = 'unlogged_training' | 'alcohol_yesterday' | 'low_energy_pattern'

export interface ProactiveGreetingResponse {
  type: 'none' | 'needs_checkin' | 'complete_briefing'
  message?: string
  flags: ProactiveFlag[]
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  // Fetch all context in parallel
  const [logRes, sessionRes, yestSessionRes, yestNutritionRes, recentLogsRes] =
    await Promise.allSettled([
      supabase
        .from('morning_logs')
        .select('id, ai_briefing')
        .eq('user_id', user.id)
        .eq('log_date', todayStr)
        .maybeSingle(),

      supabase
        .from('training_sessions')
        .select('planned_type, planned_km, status')
        .eq('user_id', user.id)
        .eq('session_date', todayStr)
        .maybeSingle(),

      supabase
        .from('training_sessions')
        .select('flag')
        .eq('user_id', user.id)
        .eq('session_date', yesterdayStr)
        .maybeSingle(),

      supabase
        .from('nutrition_logs')
        .select('has_alcohol')
        .eq('user_id', user.id)
        .eq('log_date', yesterdayStr)
        .maybeSingle(),

      // Last 3 morning logs for energy pattern check
      supabase
        .from('morning_logs')
        .select('energy_level')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false })
        .limit(3),
    ])

  const todayLog = logRes.status === 'fulfilled' ? logRes.value.data : null
  const todaySession = sessionRes.status === 'fulfilled' ? sessionRes.value.data : null
  const yestSession = yestSessionRes.status === 'fulfilled' ? yestSessionRes.value.data : null
  const yestNutrition = yestNutritionRes.status === 'fulfilled' ? yestNutritionRes.value.data : null
  const recentLogs = recentLogsRes.status === 'fulfilled' ? (recentLogsRes.value.data ?? []) : []

  // ── Determine check-in type ─────────────────────────────────────────────
  let type: ProactiveGreetingResponse['type'] = 'none'
  let message: string | undefined

  if (!todayLog) {
    type = 'needs_checkin'

    // Generate personalised nudge via Gemini
    const sessionStr = todaySession
      ? `Today has a ${todaySession.planned_type} session${todaySession.planned_km ? ` (${todaySession.planned_km}km)` : ''} planned.`
      : 'No training session planned today.'

    const yesterdayFlagStr = yestSession?.flag
      ? `Yesterday's session flag: ${yestSession.flag}.`
      : ''

    try {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        system:
          'Write a one-sentence morning greeting (max 80 chars) nudging the user to log their morning check-in. Reference today\'s planned training if relevant. Be direct, no fluff. Example: "Tempo today — log your morning vitals before heading out."',
        prompt: [sessionStr, yesterdayFlagStr].filter(Boolean).join(' '),
        maxTokens: 40,
        temperature: 0.5,
      })
      message = text.trim().slice(0, 80)
    } catch {
      message = todaySession
        ? `${todaySession.planned_type} planned today — log your morning vitals first.`
        : 'Log your morning check-in to start your day.'
    }
  } else if (!todayLog.ai_briefing) {
    type = 'complete_briefing'
  }

  // ── Build proactive flags ───────────────────────────────────────────────
  const flags: ProactiveFlag[] = []

  // Unlogged training: has session today, past 06:00 UTC (~08:00 Cyprus), not completed
  if (
    todaySession &&
    todaySession.planned_type !== 'REST' &&
    todaySession.status !== 'completed' &&
    todaySession.status !== 'modified' &&
    new Date().getUTCHours() >= 6
  ) {
    flags.push('unlogged_training')
  }

  // Alcohol yesterday
  if (yestNutrition?.has_alcohol === true) {
    flags.push('alcohol_yesterday')
  }

  // Low energy pattern: last 3 logs all have energy_level < 3
  if (
    recentLogs.length >= 3 &&
    recentLogs.every((l) => l.energy_level != null && l.energy_level < 3)
  ) {
    flags.push('low_energy_pattern')
  }

  const response: ProactiveGreetingResponse = { type, flags }
  if (message) response.message = message

  return NextResponse.json(response)
}
