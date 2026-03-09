// Shared training session evaluation logic
// Called by both /api/ai/training-eval (post-session flow) and the coach evaluate_training_session tool.

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'

const EVAL_SYSTEM_PROMPT = `You are the training coach for a 43yo female marathon runner (Belfast Marathon April 19, goal 3:32). She trains fasted at 4-5am. Key problem: going too fast on easy runs.

You receive one completed training session + 14-day context. Write a concise post-session evaluation in exactly three sections:

## Verdict
One sentence: overall quality assessment. Include flag: OK ✅ / WARNING ⚠️ / REST 🔴.

## Analysis
3-5 bullets. Be specific — reference actual numbers. Flag: pace discipline, HR response, RPE vs effort type, warmup/fuel compliance, any deviation from plan. Cross-reference morning readiness if provided.

## Next 24h
2-3 bullets. Concrete recovery or adaptation actions: sleep, nutrition, tomorrow's session adjustments, supplement timing. If this was a high-load session or RPE ≥ 7, specify recovery actions explicitly.

Rules:
- No fluff. No "great job". Be a coach, not a cheerleader.
- If she went too fast, say it directly and tell her what to do next time.
- Keep total response under 300 words.`

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

export async function evaluateTrainingSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<{ evaluation: string; flag: string }> {
  // ── 1. Fetch session ────────────────────────────────────────────────────
  const { data: session, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (error || !session) throw new Error('Session not found or not owned by user')

  // Return cached evaluation
  if (session.coach_notes) {
    return { evaluation: session.coach_notes, flag: session.flag ?? 'ok' }
  }

  // ── 2. Determine flag ───────────────────────────────────────────────────
  let flag = 'ok'
  if (session.planned_type === 'REST' || session.status === 'skipped') {
    flag = 'rest'
  } else {
    const highEffort = session.perceived_effort != null && session.perceived_effort >= 7
    const tooFast = session.went_too_fast === true
    const bigDeviation =
      session.planned_km && session.actual_km
        ? Math.abs(session.actual_km - session.planned_km) / session.planned_km > 0.2
        : false
    if (highEffort || tooFast || bigDeviation) flag = 'warning'
  }

  // ── 3. Calculate pace ───────────────────────────────────────────────────
  let computedPace: string | null = null
  if (session.actual_km && session.actual_duration_min && session.actual_km > 0) {
    const secPerKm = (session.actual_duration_min * 60) / session.actual_km
    computedPace = formatPace(secPerKm)
  }

  // ── 4. Fetch supporting data in parallel ────────────────────────────────
  const [configsRes, morningRes, recentRes] = await Promise.allSettled([
    supabase
      .from('plan_configs')
      .select('config_key, config_value, config_label')
      .eq('user_id', userId)
      .in('module', ['running', 'marathon']),

    supabase
      .from('morning_logs')
      .select('resting_hr_bpm, sleep_hours, sleep_quality, energy_level, mood, body_readiness')
      .eq('user_id', userId)
      .eq('log_date', session.session_date)
      .maybeSingle(),

    supabase
      .from('training_sessions')
      .select('session_date, planned_type, status, actual_km, actual_duration_min, perceived_effort, went_too_fast')
      .eq('user_id', userId)
      .neq('status', 'pending')
      .neq('id', sessionId)
      .order('session_date', { ascending: false })
      .limit(7),
  ])

  // ── 5. Build prompt ─────────────────────────────────────────────────────
  const sessionBlock = [
    `Date: ${session.session_date}`,
    `Type: ${session.planned_type}`,
    `Status: ${session.status}`,
    session.planned_km ? `Planned distance: ${session.planned_km}km` : null,
    session.actual_km ? `Actual distance: ${session.actual_km}km` : null,
    computedPace ? `Computed pace: ${computedPace}` : session.actual_avg_pace ? `Pace: ${session.actual_avg_pace}/km` : null,
    session.actual_avg_hr ? `Avg HR: ${session.actual_avg_hr} bpm` : null,
    session.actual_duration_min ? `Duration: ${session.actual_duration_min} min` : null,
    session.perceived_effort != null ? `RPE: ${session.perceived_effort}/10` : null,
    session.went_too_fast ? `⚠️ Went too fast (deviation: +${session.pace_deviation_sec}s/km from plan)` : null,
    session.skipped_warmup ? `⚠️ Warmup skipped` : null,
    session.warmup_done === true ? `Warmup completed` : null,
    session.post_fuel_done === true ? `Post-run fuelling done within 30 min` : null,
    session.resting_hr ? `Morning RHR: ${session.resting_hr} bpm` : null,
    session.notes ? `Athlete notes: ${session.notes}` : null,
  ].filter(Boolean).join('\n')

  const morningLog =
    morningRes.status === 'fulfilled' && morningRes.value.data
      ? morningRes.value.data
      : null

  const morningBlock = morningLog
    ? [
        `## Morning Readiness (same day)`,
        morningLog.resting_hr_bpm != null ? `RHR: ${morningLog.resting_hr_bpm} bpm` : null,
        morningLog.sleep_hours != null ? `Sleep: ${morningLog.sleep_hours}h (quality ${morningLog.sleep_quality ?? '?'}/5)` : null,
        morningLog.energy_level != null ? `Energy: ${morningLog.energy_level}/5` : null,
        morningLog.mood != null ? `Mood: ${morningLog.mood}/5` : null,
        morningLog.body_readiness != null ? `Body readiness: ${morningLog.body_readiness}/5` : null,
      ].filter(Boolean).join('\n')
    : null

  const configs =
    configsRes.status === 'fulfilled' ? configsRes.value.data ?? [] : []
  const configBlock = configs.length
    ? `## Target Paces / Plan Config\n` +
      configs.map((c) => `- ${c.config_label}: ${c.config_value}`).join('\n')
    : null

  const recentSessions =
    recentRes.status === 'fulfilled' ? recentRes.value.data ?? [] : []
  const recentBlock = recentSessions.length
    ? `## Recent Sessions (last 7)\n` +
      recentSessions
        .map((s: { session_date: string; planned_type: string; status: string; actual_km: number | null; perceived_effort: number | null; went_too_fast: boolean }) => {
          const km = s.actual_km ? ` ${s.actual_km}km` : ''
          const rpe = s.perceived_effort ? ` RPE:${s.perceived_effort}` : ''
          const fast = s.went_too_fast ? ' ⚠️too fast' : ''
          return `- ${s.session_date} ${s.planned_type} (${s.status})${km}${rpe}${fast}`
        })
        .join('\n')
    : null

  const prompt = [
    `## Session to Evaluate`,
    sessionBlock,
    morningBlock,
    configBlock,
    recentBlock,
  ].filter(Boolean).join('\n\n')

  // ── 6. Generate evaluation ──────────────────────────────────────────────
  const { text: evaluation } = await generateText({
    model: google('gemini-2.5-flash'),
    system: EVAL_SYSTEM_PROMPT,
    prompt,
    maxTokens: 600,
    temperature: 0.35,
  })

  // ── 7. Persist to session row ───────────────────────────────────────────
  await supabase
    .from('training_sessions')
    .update({ coach_notes: evaluation, flag })
    .eq('id', sessionId)
    .eq('user_id', userId)

  return { evaluation, flag }
}
