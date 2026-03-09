// Morning Briefing — non-streaming single-shot Gemini call
// Analyses today's vitals + 14-day history and returns a structured briefing.

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

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
- Tasks: [list any due tasks, or "Nothing scheduled"]
- Nutrition: [any flag based on yesterday, e.g. "alcohol yesterday — hydrate well"]

## Recommendations
Max 4 bullets. Cross-module and specific:
- If Red/Amber sleep → suggest smaller trading size
- If body_readiness ≤ 2 → suggest modifying training session
- Supplement timing reminders if relevant
- One actionable thing to set the day up well`

export async function POST(req: Request) {
  const { logId } = (await req.json()) as { logId: string }
  if (!logId) return new Response('logId required', { status: 400 })

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // ── 1. Fetch today's log (verify ownership) ─────────────────────────────
  const { data: log } = await supabase
    .from('morning_logs')
    .select('*')
    .eq('id', logId)
    .eq('user_id', user.id)
    .single()

  if (!log) return new Response('Log not found', { status: 404 })

  // Return cached briefing if it already exists
  if (log.ai_briefing) {
    return Response.json({ briefing: log.ai_briefing })
  }

  // ── 2. Fetch last 14 days of morning logs for pattern analysis ───────────
  const cutoff14 = new Date()
  cutoff14.setDate(cutoff14.getDate() - 14)
  const { data: recentLogs } = await supabase
    .from('morning_logs')
    .select(
      'log_date, resting_hr_bpm, sleep_hours, sleep_quality, energy_level, mood, body_readiness, woke_easily, had_dreams, dream_quality, notes'
    )
    .eq('user_id', user.id)
    .gte('log_date', cutoff14.toISOString().slice(0, 10))
    .neq('id', logId) // exclude today (shown separately)
    .order('log_date', { ascending: false })

  // ── 3. Fetch today's planned training session ────────────────────────────
  const todayStr = log.log_date
  const { data: trainSession } = await supabase
    .from('training_sessions')
    .select('session_type, planned_description, completed')
    .eq('user_id', user.id)
    .eq('session_date', todayStr)
    .maybeSingle()

  // ── 4. Fetch yesterday's nutrition log ───────────────────────────────────
  const yesterday = new Date(todayStr)
  yesterday.setDate(yesterday.getDate() - 1)
  const { data: nutritionYesterday } = await supabase
    .from('nutrition_logs')
    .select('adherence_score, has_alcohol')
    .eq('user_id', user.id)
    .eq('log_date', yesterday.toISOString().slice(0, 10))
    .maybeSingle()

  // ── 5. Fetch today's pending coach tasks ─────────────────────────────────
  const { data: pendingTasks } = await supabase
    .from('coach_tasks')
    .select('title, priority')
    .eq('user_id', user.id)
    .eq('due_date', todayStr)
    .is('completed_at', null)

  // ── 6. Build the user message ────────────────────────────────────────────
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
  ]
    .filter(Boolean)
    .join('\n')

  const historySection =
    recentLogs && recentLogs.length > 0
      ? `## Last ${recentLogs.length} Days of Morning Logs\n` +
        recentLogs
          .map((r) => {
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
          })
          .join('\n')
      : '## History\nNo previous logs available.'

  const trainingSection = trainSession
    ? `## Planned Training Today\nType: ${trainSession.session_type}\nDescription: ${trainSession.planned_description ?? 'N/A'}\nStatus: ${trainSession.completed ? 'completed' : 'not yet done'}`
    : `## Planned Training Today\nNo session planned (rest day or not scheduled).`

  const nutritionSection = nutritionYesterday
    ? `## Yesterday's Nutrition\nAdherence score: ${nutritionYesterday.adherence_score ?? 'N/A'}/100${nutritionYesterday.has_alcohol ? '\n⚠️ Alcohol consumed yesterday' : ''}`
    : `## Yesterday's Nutrition\nNo log available.`

  const tasksSection =
    pendingTasks && pendingTasks.length > 0
      ? `## Today's Pending Tasks\n` +
        pendingTasks.map((t) => `- [${t.priority ?? 'normal'}] ${t.title}`).join('\n')
      : `## Today's Pending Tasks\nNone scheduled.`

  const userMessage = [
    todaySection,
    historySection,
    trainingSection,
    nutritionSection,
    tasksSection,
  ].join('\n\n')

  // ── 7. Generate briefing ─────────────────────────────────────────────────
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system: SYSTEM_PROMPT,
    prompt: userMessage,
    maxTokens: 800,
    temperature: 0.4,
  })

  // ── 8. Save briefing to the log row ──────────────────────────────────────
  await supabase
    .from('morning_logs')
    .update({ ai_briefing: text })
    .eq('id', logId)
    .eq('user_id', user.id)

  return Response.json({ briefing: text })
}
