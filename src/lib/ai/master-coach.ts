// Master AI Coach — full-system context builder and system prompt
// Understands all modules and can make cross-module changes via tool-calling

import type { SupabaseClient } from '@supabase/supabase-js'
import { ATHLETE_PROFILE } from './coaching'

// ── System prompt ──────────────────────────────────────────────────────────

export const MASTER_COACH_SYSTEM_PROMPT = `You are the central Life OS coach — a highly capable AI adviser with full visibility into all of ${ATHLETE_PROFILE.sex === 'female' ? 'her' : 'their'} systems: marathon training, nutrition, supplements, habits, trading, and daily readiness.

Athlete profile:
- Age: ${ATHLETE_PROFILE.age}yo ${ATHLETE_PROFILE.sex}
- Goal race: ${ATHLETE_PROFILE.race} on ${ATHLETE_PROFILE.raceDate}
- Target time: ${ATHLETE_PROFILE.targetTime} (${ATHLETE_PROFILE.targetPacePerKm} avg pace)
- Training paces: Easy ${ATHLETE_PROFILE.trainingPaces.easy} | Tempo ${ATHLETE_PROFILE.trainingPaces.tempo} | VO2max ${ATHLETE_PROFILE.trainingPaces.vo2max} | Long ${ATHLETE_PROFILE.trainingPaces.longRun}
- Key problem: ${ATHLETE_PROFILE.mainIssue}
- Resting HR baseline: ${ATHLETE_PROFILE.restingHrBaseline}

Your capabilities:
- You can read data from ALL modules (running, nutrition, supplements, habits, trading, marathon plan).
- You can read morning logs: daily readiness data (RHR, sleep, energy, mood, body readiness).
- You can make changes using tools: pause/resume supplements, update plan configuration values.
- All changes you make are logged to the audit trail automatically.
- Supplements are prescribed by Dr Emine Ömerağa — you can manage scheduling/timing/pausing but must NOT change medical dosages or diagnoses.

Your tools:
- generate_morning_briefing: surface or create the daily readiness briefing
- evaluate_training_session: analyse a completed training session vs plan
- nutrition_summary: fetch and interpret today's nutrition tracking
- trading_session_summary: fetch today's trading performance and rule compliance
- create_task / complete_task / get_tasks: manage the user's task list
- pause_supplement / resume_supplement: manage supplement schedule
- update_plan_config: modify training paces, nutrition targets, thresholds
- get_recent_changes: show audit log of recent coach-made changes

Use tools proactively. If the user says "how was my day?" — call evaluate_training_session AND trading_session_summary AND nutrition_summary in parallel (multiple tool calls in one step) and synthesise the results. The user should never have to ask three separate questions.

Coaching philosophy:
- Be direct, data-driven, and cross-domain. Spot patterns across modules (e.g. "poor sleep → slow run → mood dip → bad trading").
- Morning logs contain daily readiness data: RHR, sleep, energy, mood, body readiness. Cross-reference these with training performance and trading outcomes. If recent logs show declining energy or HR spikes, proactively flag it.
- When asked to make a change, do it immediately with the appropriate tool and explain what you did.
- Before making a significant change (like pausing a prescribed supplement), confirm intent if the user's message is ambiguous.
- You can create tasks for the user using the create_task tool. When a user mentions something they need to do, remember, or follow up on, proactively offer to add it as a task. Always confirm after creating: "Added to your tasks: [title] for [date]."
- You can see all pending tasks in context. Reference them when relevant — e.g. if user asks about today's plan, include their pending tasks.
- Marathon sessions in context include a [flag] and first 80 chars of coach notes. Use these to spot patterns.
- Proactive flags: alcohol_yesterday (suggest reduced position size for trading), low_energy_pattern (3+ days avg energy < 3 — suggest recovery week), unlogged_training (remind user to log their session).
- You have full visibility across all time-of-day contexts. The user may message at 4am before a run, 9am during trading, or 10pm reviewing the day. Adapt tone accordingly.
- Format responses with clear sections. Use markdown. Keep responses under 500 words unless doing multi-week analysis.
- When you use a tool, briefly acknowledge what you changed and why.`

// ── Full-system context builder ────────────────────────────────────────────

export async function buildFullSystemContext(
  supabase: SupabaseClient,
  overrideUserId?: string,
): Promise<string> {
  let userId: string
  if (overrideUserId) {
    userId = overrideUserId
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return '(Not authenticated — no context available.)'
    userId = user.id
  }

  const today = new Date().toISOString().slice(0, 10)
  const cutoff14 = new Date()
  cutoff14.setDate(cutoff14.getDate() - 14)
  const cutoff7 = new Date()
  cutoff7.setDate(cutoff7.getDate() - 7)
  const cutoff14Str = cutoff14.toISOString().slice(0, 10)
  const cutoff7Str = cutoff7.toISOString().slice(0, 10)

  const nextWeekStr = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

  const [
    supplementsRes,
    nutritionRes,
    habitsRes,
    habitsLogsRes,
    runningRes,
    hrRes,
    marathonSessionsRes,
    planConfigsRes,
    recentAuditRes,
    morningLogsRes,
    tasksRes,
  ] = await Promise.allSettled([
    supabase
      .from('supplements')
      .select('id, name, frequency, timing, is_active, is_paused, pause_reason, prescribed_for, duration_notes, blood_donation_override')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),

    supabase
      .from('nutrition_logs')
      .select('log_date, adherence_score, water_ml, has_alcohol, has_fried_food, has_processed_snack')
      .eq('user_id', userId)
      .gte('log_date', cutoff14Str)
      .order('log_date', { ascending: false }),

    supabase
      .from('habits')
      .select('id, name, streak')
      .eq('user_id', userId)
      .eq('is_archived', false),

    supabase
      .from('habit_logs')
      .select('habit_id, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', cutoff14.toISOString()),

    supabase
      .from('running_activities')
      .select('workout_type, distance_meters, duration_seconds, avg_pace_sec_per_km, avg_hr, started_at, title')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(7),

    supabase
      .from('resting_hr_logs')
      .select('log_date, bpm')
      .eq('user_id', userId)
      .gte('log_date', cutoff7Str)
      .order('log_date', { ascending: false }),

    supabase
      .from('training_sessions')
      .select('session_date, planned_type, planned_description, status, actual_km, actual_duration_min, perceived_effort, went_too_fast, coach_notes, flag')
      .eq('user_id', userId)
      .gte('session_date', cutoff7Str)
      .order('session_date', { ascending: false }),

    supabase
      .from('plan_configs')
      .select('module, config_key, config_label, config_value, config_unit')
      .eq('user_id', userId)
      .order('module', { ascending: true }),

    supabase
      .from('plan_audit_log')
      .select('changed_at, module, entity_type, action, field_changed, previous_value, new_value, reason, changed_by')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(10),

    supabase
      .from('morning_logs')
      .select('log_date, resting_hr_bpm, sleep_hours, sleep_quality, energy_level, mood, body_readiness, woke_easily, had_dreams, dream_quality, notes')
      .eq('user_id', userId)
      .gte('log_date', cutoff14Str)
      .order('log_date', { ascending: false }),

    supabase
      .from('coach_tasks')
      .select('id, title, notes, due_date, due_time, recurrence, module, completed_at, source')
      .eq('user_id', userId)
      .or(`due_date.is.null,due_date.lte.${nextWeekStr}`)
      .is('completed_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(20),
  ])

  const sections: string[] = []

  // ── Supplements ──────────────────────────────────────────────
  if (supplementsRes.status === 'fulfilled' && supplementsRes.value.data) {
    const sups = supplementsRes.value.data
    const active = sups.filter((s) => !s.is_paused)
    const paused = sups.filter((s) => s.is_paused)

    const activeLines = active.map((s) => {
      const timing = s.timing ? ` · ${s.timing}` : ''
      const forNote = s.prescribed_for ? ` (${s.prescribed_for})` : ''
      const override = s.blood_donation_override ? ' ⚡ override:daily in recovery' : ''
      return `- [${s.id}] ${s.name} — ${s.frequency}${timing}${forNote}${override}`
    })
    const pausedLines = paused.map(
      (s) => `- [${s.id}] ${s.name} — PAUSED (${s.pause_reason ?? 'no reason'})`
    )

    sections.push(
      `## Supplements (${active.length} active${paused.length ? `, ${paused.length} paused` : ''})\n` +
        (activeLines.join('\n') || 'None.') +
        (pausedLines.length ? '\n\n**Paused:**\n' + pausedLines.join('\n') : '') +
        '\n\n_Note: supplement IDs are shown in brackets — use them when calling tools._'
    )
  }

  // ── Supplement log for today ──────────────────────────────────
  if (supplementsRes.status === 'fulfilled' && supplementsRes.value.data) {
    const { data: todayLogs } = await supabase
      .from('supplement_log_entries')
      .select('supplement_id, taken')
      .eq('user_id', userId)
      .eq('log_date', today)
    if (todayLogs && todayLogs.length > 0) {
      const takenIds = new Set(todayLogs.filter((l) => l.taken).map((l) => l.supplement_id))
      const notTaken = (supplementsRes.value.data ?? [])
        .filter((s) => !s.is_paused && !takenIds.has(s.id))
        .map((s) => s.name)
      sections.push(
        `## Supplement Adherence Today (${today})\n` +
          `Taken: ${takenIds.size} of ${(supplementsRes.value.data ?? []).filter((s) => !s.is_paused).length}\n` +
          (notTaken.length ? `Not yet taken: ${notTaken.join(', ')}` : 'All done!')
      )
    }
  }

  // ── Nutrition ──────────────────────────────────────────────────
  if (nutritionRes.status === 'fulfilled' && nutritionRes.value.data?.length) {
    const logs = nutritionRes.value.data
    const avgScore =
      logs.reduce((s, l) => s + (l.adherence_score ?? 0), 0) / logs.length
    const alcoholDays = logs.filter((l) => l.has_alcohol).length
    const lines = logs
      .slice(0, 14)
      .map((l) => {
        const flags = [
          l.has_alcohol ? '🍷' : '',
          l.has_fried_food ? '🍟' : '',
          l.has_processed_snack ? '🍪' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const water = l.water_ml != null ? `${l.water_ml}ml` : ''
        return `- ${l.log_date}: ${l.adherence_score ?? '?'}/100${water ? ` | ${water}` : ''}${flags ? ' ' + flags : ''}`
      })
    sections.push(
      `## Nutrition (last 14 days)\nAvg score: ${avgScore.toFixed(0)}/100 | Alcohol days: ${alcoholDays}\n${lines.join('\n')}`
    )
  }

  // ── Habits ─────────────────────────────────────────────────────
  if (
    habitsRes.status === 'fulfilled' &&
    habitsLogsRes.status === 'fulfilled' &&
    habitsRes.value.data?.length
  ) {
    const habits = habitsRes.value.data
    const logs = habitsLogsRes.value.data ?? []
    const lines = habits.map((h) => {
      const completions = logs.filter((l) => l.habit_id === h.id).length
      const rate = ((completions / 14) * 100).toFixed(0)
      return `- ${h.name}: ${completions}/14 days (${rate}%) | streak: ${h.streak}`
    })
    sections.push(`## Habits (last 14 days)\n${lines.join('\n')}`)
  }

  // ── Running ─────────────────────────────────────────────────────
  if (runningRes.status === 'fulfilled' && runningRes.value.data?.length) {
    const formatPace = (s: number | null) => {
      if (!s) return 'N/A'
      const m = Math.floor(s / 60)
      const sec = Math.round(s % 60)
      return `${m}:${String(sec).padStart(2, '0')}/km`
    }
    const lines = runningRes.value.data.map((a) => {
      const date = new Date(a.started_at).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      const dist = (a.distance_meters / 1000).toFixed(2) + 'km'
      const pace = formatPace(a.avg_pace_sec_per_km)
      const hr = a.avg_hr ? ` HR:${a.avg_hr}` : ''
      return `- ${date}: ${a.workout_type.toUpperCase()} ${dist} @ ${pace}${hr}`
    })

    const hrLines =
      hrRes.status === 'fulfilled' && hrRes.value.data?.length
        ? hrRes.value.data.map((h) => `- ${h.log_date}: ${h.bpm} bpm`).join('\n')
        : 'No resting HR data.'

    sections.push(`## Running (last 7 activities)\n${lines.join('\n')}\n\n**Resting HR (last 7 days):**\n${hrLines}`)
  }

  // ── Marathon Plan ───────────────────────────────────────────────
  if (marathonSessionsRes.status === 'fulfilled' && marathonSessionsRes.value.data?.length) {
    const sessions = marathonSessionsRes.value.data
    const lines = sessions.map((s: {
      session_date: string
      planned_type: string
      status: string
      actual_km: number | null
      perceived_effort: number | null
      went_too_fast: boolean
      coach_notes: string | null
      flag: string | null
    }) => {
      const done = s.status === 'completed' || s.status === 'modified' ? '✅' : s.status === 'skipped' ? '❌' : '⬜'
      const dist = s.actual_km ? ` ${s.actual_km}km` : ''
      const effort = s.perceived_effort ? ` RPE:${s.perceived_effort}` : ''
      const fast = s.went_too_fast ? ' ⚠️ too fast' : ''
      const flagStr = s.flag ? ` [${s.flag}]` : ''
      const noteSnippet = s.coach_notes ? `\n  Coach: ${s.coach_notes.slice(0, 80)}…` : ''
      return `- ${s.session_date} ${done} ${s.planned_type}${dist}${effort}${fast}${flagStr}${noteSnippet}`
    })
    sections.push(`## Marathon Training Sessions (last 7 days)\n${lines.join('\n')}`)
  }

  // ── Plan Configs ────────────────────────────────────────────────
  if (planConfigsRes.status === 'fulfilled' && planConfigsRes.value.data?.length) {
    const configs = planConfigsRes.value.data
    const byModule: Record<string, string[]> = {}
    for (const c of configs) {
      if (!byModule[c.module]) byModule[c.module] = []
      const unit = c.config_unit ? ` ${c.config_unit}` : ''
      byModule[c.module].push(`- ${c.config_key}: ${c.config_value}${unit} (${c.config_label})`)
    }
    const moduleBlocks = Object.entries(byModule)
      .map(([mod, lines]) => `**${mod}:**\n${lines.join('\n')}`)
      .join('\n\n')
    sections.push(`## Plan Configurations\n${moduleBlocks}`)
  }

  // ── Recent Changes ──────────────────────────────────────────────
  if (recentAuditRes.status === 'fulfilled' && recentAuditRes.value.data?.length) {
    const entries = recentAuditRes.value.data
    const lines = entries.map((e) => {
      const date = new Date(e.changed_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
      const change = e.field_changed
        ? `${e.field_changed}: ${e.previous_value} → ${e.new_value}`
        : `${e.action} ${e.entity_type}`
      return `- ${date} [${e.changed_by}] ${e.module}: ${change}${e.reason ? ` — ${e.reason}` : ''}`
    })
    sections.push(`## Recent Changes (audit log)\n${lines.join('\n')}`)
  }

  // ── Pending Tasks ────────────────────────────────────────────────
  if (tasksRes.status === 'fulfilled' && tasksRes.value.data?.length) {
    const tasks = tasksRes.value.data
    const lines = tasks.map((t) => {
      const due = t.due_date
        ? `${t.due_date}${t.due_time ? ' ' + String(t.due_time).slice(0, 5) : ''}`
        : 'no date'
      const recNote = t.recurrence !== 'none' ? ` (${t.recurrence})` : ''
      const noteLine = t.notes ? `\n  Notes: ${t.notes}` : ''
      return `- [${t.id}] ${t.title} | due:${due}${recNote} | module:${t.module ?? 'general'} | source:${t.source}${noteLine}`
    })
    sections.push(`## Pending Tasks (next 7 days)\n${lines.join('\n')}`)
  }

  // ── Morning Logs ─────────────────────────────────────────────────
  if (morningLogsRes.status === 'fulfilled' && morningLogsRes.value.data?.length) {
    const logs = morningLogsRes.value.data
    const lines = logs.map((l) => {
      const dreamNote = l.had_dreams
        ? l.dream_quality ?? 'yes'
        : l.had_dreams === false
          ? 'none'
          : null
      const parts = [
        `HR:${l.resting_hr_bpm != null ? l.resting_hr_bpm + 'bpm' : 'N/A'}`,
        `Sleep:${l.sleep_hours != null ? l.sleep_hours + 'h' : 'N/A'} Q:${l.sleep_quality ?? '?'}/5`,
        `Energy:${l.energy_level ?? '?'}/5`,
        `Mood:${l.mood ?? '?'}/5`,
        `Body:${l.body_readiness ?? '?'}/5`,
        dreamNote ? `Dreams:${dreamNote}` : null,
      ].filter(Boolean)
      const noteStr = l.notes ? `\n  Notes: ${l.notes}` : ''
      return `- ${l.log_date} | ${parts.join(' | ')}${noteStr}`
    })
    sections.push(`## Morning Logs (last 14 days)\n${lines.join('\n')}`)
  }

  return sections.join('\n\n')
}
