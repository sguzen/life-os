// Morning Briefing — shared logic called by the API route and the coach tool.
// Generates (or returns cached) AI briefing for a morning_logs row.

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { maybeFireAdaptEvent } from '@/lib/adapt/trigger'

const SYSTEM_PROMPT = `You are the Life OS Morning Briefing coach for a 43yo female marathon runner and prop trader. She trains fasted at 4-5am. Belgrade Marathon April 19 goal 3:32. Limassol Half March 22 is the next checkpoint.

You receive her morning vitals and the last 14 days of morning logs.

Your response has EXACTLY four sections, no more:

## Readiness: [🟢 Green / 🟡 Amber / 🔴 Red]
One sentence verdict based on sleep, HR, energy, mood, body.

## Patterns
2-3 bullets from the 14-day history. Only real patterns — do not invent.
Skip this section if fewer than 3 days of history exist.

## Today's Focus
- Training: [what's planned today, or rest day]
- Recovery: [reference yesterday's session if warning/rest flag, or high RPE, e.g. "Yesterday's tempo was hard (RPE 8) — prioritise easy effort today"]
- Tasks: [list any due tasks, or "Nothing scheduled"]
- Nutrition: [any flag based on yesterday, e.g. "alcohol yesterday — hydrate well"]

## Recommendations
Max 4 bullets. Cross-module and specific:
- If Red/Amber sleep → suggest smaller trading size
- If body_readiness ≤ 2 → suggest modifying training session
- Supplement timing reminders if relevant
- One actionable thing to set the day up well`

export async function generateMorningBriefing(
  supabase: SupabaseClient,
  logId: string,
  userId: string,
): Promise<{ briefing: string }> {
  // ── 1. Fetch today's log (verify ownership) ──────────────────────────────
  const { data: log } = await supabase
    .from('morning_logs')
    .select('*')
    .eq('id', logId)
    .eq('user_id', userId)
    .single()

  if (!log) throw new Error('Morning log not found')

  // Return cached briefing if it already exists
  if (log.ai_briefing) return { briefing: log.ai_briefing }

  // ── 2. Fetch last 14 days for pattern analysis ───────────────────────────
  const cutoff14 = new Date()
  cutoff14.setDate(cutoff14.getDate() - 14)
  const { data: recentLogs } = await supabase
    .from('morning_logs')
    .select('log_date, resting_hr_bpm, sleep_hours, sleep_quality, energy_level, mood, body_readiness, woke_easily, had_dreams, dream_quality, notes')
    .eq('user_id', userId)
    .gte('log_date', cutoff14.toISOString().slice(0, 10))
    .neq('id', logId)
    .order('log_date', { ascending: false })

  // ── 3. Fetch today's planned session + yesterday's completed session ──────
  const todayStr = log.log_date
  const yesterday = new Date(todayStr)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const [trainSessionRes, yesterdaySessionRes, nutritionRes, tasksRes] =
    await Promise.allSettled([
      supabase
        .from('training_sessions')
        .select('planned_type, planned_description, status')
        .eq('user_id', userId)
        .eq('session_date', todayStr)
        .maybeSingle(),

      supabase
        .from('training_sessions')
        .select('planned_type, status, actual_km, actual_duration_min, perceived_effort, went_too_fast, coach_notes, flag')
        .eq('user_id', userId)
        .eq('session_date', yesterdayStr)
        .neq('status', 'pending')
        .maybeSingle(),

      supabase
        .from('nutrition_logs')
        .select('adherence_score, has_alcohol')
        .eq('user_id', userId)
        .eq('log_date', yesterdayStr)
        .maybeSingle(),

      supabase
        .from('coach_tasks')
        .select('title, module')
        .eq('user_id', userId)
        .eq('due_date', todayStr)
        .is('completed_at', null),
    ])

  const trainSession = trainSessionRes.status === 'fulfilled' ? trainSessionRes.value.data : null
  const yesterdaySession = yesterdaySessionRes.status === 'fulfilled' ? yesterdaySessionRes.value.data : null
  const nutritionYesterday = nutritionRes.status === 'fulfilled' ? nutritionRes.value.data : null
  const pendingTasks = tasksRes.status === 'fulfilled' ? (tasksRes.value.data ?? []) : []

  // ── 4. Build prompt ─────────────────────────────────────────────────────
  const todaySection = [
    `## Today's Morning Log (${log.log_date})`,
    log.resting_hr_bpm != null ? `Resting HR: ${log.resting_hr_bpm} bpm` : null,
    log.sleep_hours != null ? `Sleep: ${log.sleep_hours}h` : null,
    log.sleep_quality != null ? `Sleep quality: ${log.sleep_quality}/5` : null,
    log.energy_level != null ? `Energy: ${log.energy_level}/5` : null,
    log.mood != null ? `Mood: ${log.mood}/5` : null,
    log.body_readiness != null ? `Body readiness: ${log.body_readiness}/5` : null,
    log.woke_easily != null ? `Woke easily: ${log.woke_easily ? 'yes' : 'no'}` : null,
    log.had_dreams != null ? `Dreams: ${log.had_dreams ? log.dream_quality ?? 'yes' : 'no'}` : null,
    log.notes ? `Notes: ${log.notes}` : null,
  ].filter(Boolean).join('\n')

  const historySection =
    recentLogs && recentLogs.length > 0
      ? `## Last ${recentLogs.length} Days of Morning Logs\n` +
        recentLogs.map((r) => {
          const parts = [
            r.log_date,
            r.resting_hr_bpm != null ? `HR:${r.resting_hr_bpm}bpm` : null,
            r.sleep_hours != null ? `Sleep:${r.sleep_hours}h` : null,
            r.sleep_quality != null ? `Q:${r.sleep_quality}/5` : null,
            r.energy_level != null ? `Energy:${r.energy_level}/5` : null,
            r.mood != null ? `Mood:${r.mood}/5` : null,
            r.body_readiness != null ? `Body:${r.body_readiness}/5` : null,
            r.had_dreams && r.dream_quality ? `Dreams:${r.dream_quality}` : null,
            r.notes ? `Notes: ${r.notes}` : null,
          ].filter(Boolean)
          return `- ${parts.join(' | ')}`
        }).join('\n')
      : '## History\nNo previous logs available.'

  const trainingSection = trainSession
    ? `## Planned Training Today\nType: ${trainSession.planned_type}\nDescription: ${trainSession.planned_description ?? 'N/A'}\nStatus: ${trainSession.status === 'completed' || trainSession.status === 'modified' ? 'already completed' : 'not yet done'}`
    : `## Planned Training Today\nNo session planned (rest day or not scheduled).`

  const yesterdaySessionSection = yesterdaySession
    ? (() => {
        const km = yesterdaySession.actual_km ? ` ${yesterdaySession.actual_km}km` : ''
        const rpe = yesterdaySession.perceived_effort ? ` RPE:${yesterdaySession.perceived_effort}/10` : ''
        const fast = yesterdaySession.went_too_fast ? ` ⚠️ went too fast` : ''
        const flagStr = yesterdaySession.flag ? ` | Flag: ${yesterdaySession.flag}` : ''
        const notes = yesterdaySession.coach_notes
          ? `\nCoach evaluation: ${yesterdaySession.coach_notes.slice(0, 200)}${yesterdaySession.coach_notes.length > 200 ? '…' : ''}`
          : ''
        return `## Yesterday's Training Session\nType: ${yesterdaySession.planned_type} | Status: ${yesterdaySession.status}${km}${rpe}${fast}${flagStr}${notes}`
      })()
    : `## Yesterday's Training Session\nNo completed session recorded.`

  const nutritionSection = nutritionYesterday
    ? `## Yesterday's Nutrition\nAdherence score: ${nutritionYesterday.adherence_score ?? 'N/A'}/100${nutritionYesterday.has_alcohol ? '\n⚠️ Alcohol consumed yesterday' : ''}`
    : `## Yesterday's Nutrition\nNo log available.`

  const tasksSection =
    pendingTasks.length > 0
      ? `## Today's Pending Tasks\n` + pendingTasks.map((t) => `- [${t.module ?? 'general'}] ${t.title}`).join('\n')
      : `## Today's Pending Tasks\nNone scheduled.`

  const userMessage = [todaySection, historySection, trainingSection, yesterdaySessionSection, nutritionSection, tasksSection].join('\n\n')

  // ── 5. Generate briefing ─────────────────────────────────────────────────
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system: SYSTEM_PROMPT,
    prompt: userMessage,
    maxTokens: 800,
    temperature: 0.4,
  })

  // ── 6. Save briefing ─────────────────────────────────────────────────────
  await supabase
    .from('morning_logs')
    .update({ ai_briefing: text })
    .eq('id', logId)
    .eq('user_id', userId)

  // ── 7. Check adapt event patterns (fire-and-forget — don't block briefing) ──
  const logs3 = (recentLogs ?? []).slice(0, 2).concat([{
    log_date: log.log_date,
    sleep_quality: log.sleep_quality,
    energy_level: log.energy_level,
    resting_hr_bpm: null,
    sleep_hours: null,
    mood: null,
    body_readiness: null,
    woke_easily: null,
    had_dreams: null,
    dream_quality: null,
    notes: null,
  }])

  if (logs3.length >= 3) {
    const avgSleep = logs3.reduce((s, l) => s + (l.sleep_quality ?? 3), 0) / logs3.length
    const avgEnergy = logs3.reduce((s, l) => s + (l.energy_level ?? 3), 0) / logs3.length

    if (avgSleep <= 2) {
      maybeFireAdaptEvent(supabase, userId, 'consecutive_poor_sleep', {
        avg_sleep_quality: avgSleep,
        days_analyzed: logs3.length,
        log_date: log.log_date,
      }).catch((e) => console.error('[morning-briefing] adapt trigger failed:', e))
    }

    if (avgEnergy <= 2) {
      maybeFireAdaptEvent(supabase, userId, 'low_energy_pattern', {
        avg_energy: avgEnergy,
        days_analyzed: logs3.length,
        log_date: log.log_date,
      }).catch((e) => console.error('[morning-briefing] adapt trigger failed:', e))
    }
  }

  return { briefing: text }
}
