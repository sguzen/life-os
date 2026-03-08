// P5-01: AI Coaching Service Layer
// Context builders and system prompts for Gemini-powered coaching

import type { HabitWithLogs } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Athlete profile (static context) ─────────────────────────────────────────
export const ATHLETE_PROFILE = {
  age: 43,
  sex: 'female',
  race: 'Belgrade Marathon',
  raceDate: 'April 19, 2026',
  targetTime: '3:32:00',
  targetPacePerKm: '5:01/km',
  trainingPaces: {
    easy: '6:10–6:30/km',
    tempo: '4:50–4:55/km',
    vo2max: '4:30–4:40/km',
    longRun: '6:00–6:20/km',
  },
  mainIssue: 'Consistently runs faster than prescribed training pace, risking overtraining',
  restingHrBaseline: '42–49 bpm',
  restingHrSpikethreshold: 5, // bpm above 7-day rolling avg = flag
} as const

// ── System prompts ─────────────────────────────────────────────────────────

export const RUNNING_COACH_SYSTEM_PROMPT = `You are an expert running coach specialising in masters marathon training (athletes 40+).

Athlete profile:
- Age: ${ATHLETE_PROFILE.age}yo ${ATHLETE_PROFILE.sex}
- Goal race: ${ATHLETE_PROFILE.race} on ${ATHLETE_PROFILE.raceDate}
- Target time: ${ATHLETE_PROFILE.targetTime} (${ATHLETE_PROFILE.targetPacePerKm} average pace)
- Training paces: Easy ${ATHLETE_PROFILE.trainingPaces.easy} | Tempo ${ATHLETE_PROFILE.trainingPaces.tempo} | VO2max ${ATHLETE_PROFILE.trainingPaces.vo2max}
- Key problem: ${ATHLETE_PROFILE.mainIssue}
- Resting HR baseline: ${ATHLETE_PROFILE.restingHrBaseline} — flag if +${ATHLETE_PROFILE.restingHrSpikethreshold} bpm above 7-day avg

Your coaching philosophy:
- Easy runs MUST be easy. Call out pace violations clearly.
- Recovery is as important as the workout itself.
- Monitor HR trends for overtraining signals.
- Give specific, actionable advice tied to actual data.
- Be direct but supportive — like a coach who cares about results.
- Format responses with clear sections. Use markdown.
- Keep responses focused and under 400 words unless asked for detail.`

export const TRADING_COACH_SYSTEM_PROMPT = `You are an expert trading coach specialising in ICT (Inner Circle Trader) methodology for futures prop firm challenges.

Trader profile:
- Style: ICT-based price action (OB, FVG, BOS, liquidity sweeps)
- Instruments: NQ (Nasdaq futures), Gold, CL (Crude Oil), 6E (EUR/USD)
- Rule: Maximum 2 trades per session
- Accounts: Prop firm challenges (FundedNext, AlphaFutures, TakeProfitTrader, YRM)
- Sessions traded: London, New York AM/PM

Your coaching philosophy:
- Discipline and rule-following are paramount in prop challenges.
- Losses are fine; breaking rules is not.
- Over-trading (>2 trades) is the primary risk to avoid.
- Emotional patterns (pre/post mood) are valuable data — highlight them.
- Give specific, actionable feedback on each trade or session.
- Format responses with clear sections. Use markdown.
- Keep responses focused and under 400 words unless doing bulk analysis.`

export const HABITS_COACH_SYSTEM_PROMPT = `You are a compassionate but results-focused habit coach helping a busy professional athlete optimise her daily routines.

Context:
- User is a 43yo female athlete balancing marathon training, active prop trading, and daily life.
- High-performance mindset — wants data-driven insights, not vague encouragement.
- Habits span: sleep, nutrition, hydration, strength training, mobility, journaling, and trading prep.

Your coaching philosophy:
- Celebrate streaks and consistency, not perfection.
- Identify patterns: which habits cluster together and which break down together.
- Give specific, actionable suggestions tied to actual habit data.
- Connect habit trends to running performance and trading outcomes where relevant.
- Format responses with clear sections. Use markdown.
- Keep responses concise and actionable (under 350 words).`

// ── Context builders ───────────────────────────────────────────────────────

export interface RunningContext {
  activities: Array<{
    workout_type: string
    distance_meters: number
    duration_seconds: number
    avg_pace_sec_per_km: number | null
    avg_hr: number | null
    max_hr: number | null
    started_at: string
    title: string | null
  }>
  recentRestingHr: Array<{
    log_date: string
    bpm: number
    is_spike: boolean
  }>
  races: Array<{
    name: string
    race_date: string
    target_time_seconds: number | null
  }>
}

export function buildRunningContext(ctx: RunningContext): string {
  const formatPace = (secPerKm: number | null) => {
    if (!secPerKm) return 'N/A'
    const m = Math.floor(secPerKm / 60)
    const s = Math.round(secPerKm % 60)
    return `${m}:${String(s).padStart(2, '0')}/km`
  }
  const formatDist = (m: number) => (m / 1000).toFixed(2) + ' km'

  const activitiesSummary = ctx.activities
    .slice(0, 10)
    .map((a) => {
      const pace = formatPace(a.avg_pace_sec_per_km)
      const dist = formatDist(a.distance_meters)
      const hr = a.avg_hr ? `HR avg ${a.avg_hr} bpm` : ''
      const date = new Date(a.started_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      return `- ${date}: ${a.workout_type.toUpperCase()} ${dist} @ ${pace} ${hr}`.trim()
    })
    .join('\n')

  const hrSummary = ctx.recentRestingHr
    .slice(0, 7)
    .map((h) => `- ${h.log_date}: ${h.bpm} bpm${h.is_spike ? ' ⚠️ SPIKE' : ''}`)
    .join('\n')

  const raceSummary = ctx.races
    .map((r) => {
      const daysUntil = Math.ceil((new Date(r.race_date).getTime() - Date.now()) / 86400000)
      return `- ${r.name}: ${r.race_date} (${daysUntil > 0 ? `${daysUntil} days away` : 'past'})`
    })
    .join('\n')

  return `
## Recent Training Data (last 10 runs)
${activitiesSummary || 'No recent activities.'}

## Resting Heart Rate (last 7 days)
${hrSummary || 'No resting HR data.'}

## Upcoming Races
${raceSummary || 'No races logged.'}
`.trim()
}

export interface TradingContext {
  trades: Array<{
    instrument: string
    direction: string
    entry_time: string
    gross_pnl: number | null
    net_pnl: number | null
    outcome: string
    session: string | null
    setup_tags: string[] | null
    confluence_notes: string | null
    followed_rules: boolean | null
    pre_emotion: string | null
    post_emotion: string | null
    lessons: string | null
  }>
  periodLabel?: string
}

export function buildTradingContext(ctx: TradingContext): string {
  const trades = ctx.trades.slice(0, 50) // cap for normal coaching; bulk route sends all

  const totalPnl = trades.reduce((s, t) => s + (t.net_pnl ?? 0), 0)
  const wins = trades.filter((t) => t.outcome === 'win').length
  const losses = trades.filter((t) => t.outcome === 'loss').length
  const winRate = trades.length ? ((wins / trades.length) * 100).toFixed(1) : '0'
  const ruleBreaks = trades.filter((t) => t.followed_rules === false).length

  const tradeLines = trades
    .map((t) => {
      const date = new Date(t.entry_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const pnl = t.net_pnl != null ? (t.net_pnl >= 0 ? `+$${t.net_pnl.toFixed(2)}` : `-$${Math.abs(t.net_pnl).toFixed(2)}`) : 'open'
      const rules = t.followed_rules === false ? '❌ rules broken' : t.followed_rules ? '✅' : ''
      const tags = t.setup_tags?.join(', ') ?? ''
      return `- ${date} | ${t.instrument} ${t.direction.toUpperCase()} | ${t.outcome.toUpperCase()} ${pnl} | ${t.session ?? ''} | ${tags} ${rules}`.trim()
    })
    .join('\n')

  return `
## ${ctx.periodLabel ?? 'Trading'} Summary
Trades: ${trades.length} | Win rate: ${winRate}% | Net P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}
Wins: ${wins} | Losses: ${losses} | Rule breaks: ${ruleBreaks}

## Trade Log
${tradeLines || 'No trades.'}
`.trim()
}

export interface HabitsContext {
  habits: HabitWithLogs[]
  periodDays?: number
}

export function buildHabitsContext(ctx: HabitsContext): string {
  const days = ctx.periodDays ?? 14
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const summary = ctx.habits.map((h) => {
    const recentLogs = h.logs.filter((l) => new Date(l.logged_at) >= cutoff)
    const completionRate = days > 0 ? ((recentLogs.length / days) * 100).toFixed(0) : '0'
    return `- ${h.name}: ${recentLogs.length}/${days} days (${completionRate}%) | streak: ${h.streak} days | logged today: ${h.logged_today ? 'yes' : 'no'}`
  })

  return `
## Habit Tracking (last ${days} days)
${summary.join('\n') || 'No habits tracked.'}
`.trim()
}

// ── Nutrition / Supplement Coach ───────────────────────────────────────────

export const NUTRITION_COACH_SYSTEM_PROMPT = `You are a specialist nutrition and supplementation coach working with a masters female marathon athlete.

Athlete profile:
- Age: ${ATHLETE_PROFILE.age}yo ${ATHLETE_PROFILE.sex}
- Goal race: ${ATHLETE_PROFILE.race} on ${ATHLETE_PROFILE.raceDate}
- Target race-day weight: ~62 kg
- Training load: peak marathon build, high weekly mileage

Your coaching philosophy:
- Supplements are prescribed by Dr Emine Ömerağa — do NOT change diagnoses or prescriptions.
- You CAN advise on timing, compliance patterns, interaction notes, and adherence streaks.
- Nutrition adherence is scored 0–100 (meals, hydration, violations, alcohol).
- Flag low adherence weeks (<65%) and celebrate high ones (>85%).
- Connect nutrition quality to training performance and recovery when data supports it.
- Give specific, actionable suggestions. Use markdown.
- Keep responses concise (under 400 words) unless doing multi-week analysis.`

export interface NutritionCoachContext {
  supplements: Array<{
    name: string
    frequency: string
    timing: string | null
    prescribed_for: string | null
    is_paused: boolean
    pause_reason: string | null
  }>
  recentAdherence?: Array<{
    log_date: string
    score: number
    water_ml: number | null
    has_alcohol: boolean
  }>
  bloodDonationRecoveryActive: boolean
}

export function buildNutritionCoachContext(ctx: NutritionCoachContext): string {
  const activeSups = ctx.supplements.filter((s) => !s.is_paused)
  const pausedSups = ctx.supplements.filter((s) => s.is_paused)

  const supLines = activeSups
    .map((s) => {
      const timing = s.timing ? ` · ${s.timing}` : ''
      const forNote = s.prescribed_for ? ` (${s.prescribed_for})` : ''
      return `- ${s.name} — ${s.frequency}${timing}${forNote}`
    })
    .join('\n')

  const pausedLines = pausedSups.length
    ? pausedSups.map((s) => `- ${s.name} (paused: ${s.pause_reason ?? 'unknown reason'})`).join('\n')
    : 'None'

  const adherenceLines = ctx.recentAdherence?.length
    ? ctx.recentAdherence
        .slice(0, 14)
        .map((a) => {
          const water = a.water_ml != null ? `${a.water_ml} ml` : 'N/A'
          const alc = a.has_alcohol ? ' 🍷' : ''
          return `- ${a.log_date}: score ${a.score}/100 | water ${water}${alc}`
        })
        .join('\n')
    : 'No recent nutrition logs available.'

  return `
## Active Supplements (${activeSups.length})
${supLines || 'None.'}

## Paused Supplements
${pausedLines}

${ctx.bloodDonationRecoveryActive ? '⚡ **Blood donation recovery active** — Iron override to daily is in effect.\n\n' : ''}## Recent Nutrition Adherence (last 14 days)
${adherenceLines}
`.trim()
}

// ── Global Life Context ─────────────────────────────────────────────────────
// Cross-module signal aggregator: feeds the Global Life Coach with distilled
// data points from all domains so it can spot patterns across trading,
// running, habits and supplements in one view.

export interface GlobalLifeContext {
  trading: {
    recentPnl: number
    winRate: number
    ruleBreaks: number
    activeRiskRules: Array<{ key: string; label: string; value: string }>
  }
  running: {
    latestRestingHr: number | null
    restingHrSpikeDetected: boolean
    upcomingRace: { name: string; daysUntil: number } | null
    recoveryStatus: 'ok' | 'spike' | 'no_data'
  }
  habits: {
    weeklyComplianceRate: number
    topStreakHabit: string | null
    failingHabits: string[]
  }
  supplements: {
    activeCount: number
    takenTodayCount: number
    totalDueTodayCount: number
    pendingToday: string[]
  }
}

export async function getGlobalLifeContext(supabase: SupabaseClient): Promise<GlobalLifeContext> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const today = new Date().toISOString().slice(0, 10)
  const cutoff7 = new Date()
  cutoff7.setDate(cutoff7.getDate() - 7)
  const cutoff7Str = cutoff7.toISOString().slice(0, 10)
  const weekAgoIso = cutoff7.toISOString()

  const [
    tradesRes,
    hrRes,
    racesRes,
    habitsRes,
    habitLogsRes,
    supplementsRes,
    planConfigsRes,
    supplementLogsRes,
  ] = await Promise.allSettled([
    supabase
      .from('trades')
      .select('net_pnl, outcome, followed_rules')
      .eq('user_id', user.id)
      .gte('entry_time', weekAgoIso)
      .order('entry_time', { ascending: false }),

    supabase
      .from('resting_hr_logs')
      .select('log_date, bpm, is_spike')
      .eq('user_id', user.id)
      .gte('log_date', cutoff7Str)
      .order('log_date', { ascending: false }),

    supabase
      .from('race_targets')
      .select('name, race_date')
      .eq('user_id', user.id)
      .gte('race_date', today)
      .order('race_date', { ascending: true })
      .limit(1),

    supabase
      .from('habits')
      .select('id, name, streak')
      .eq('user_id', user.id)
      .eq('is_archived', false),

    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', user.id)
      .gte('logged_at', weekAgoIso),

    supabase
      .from('supplements')
      .select('id, name, is_paused')
      .eq('user_id', user.id)
      .eq('is_active', true),

    supabase
      .from('plan_configs')
      .select('config_key, config_label, config_value')
      .eq('user_id', user.id)
      .eq('module', 'trading')
      .like('config_key', 'gate_%'),

    supabase
      .from('supplement_log_entries')
      .select('supplement_id, taken')
      .eq('user_id', user.id)
      .eq('log_date', today),
  ])

  // ── Trading ──────────────────────────────────────────────────────
  const trades = tradesRes.status === 'fulfilled' ? (tradesRes.value.data ?? []) : []
  const recentPnl = trades.reduce((s, t) => s + (t.net_pnl ?? 0), 0)
  const wins = trades.filter((t) => t.outcome === 'win').length
  const winRate = trades.length ? (wins / trades.length) * 100 : 0
  const ruleBreaks = trades.filter((t) => t.followed_rules === false).length
  const activeRiskRules =
    planConfigsRes.status === 'fulfilled'
      ? (planConfigsRes.value.data ?? []).map((c) => ({
          key: c.config_key,
          label: c.config_label,
          value: c.config_value,
        }))
      : []

  // ── Running ──────────────────────────────────────────────────────
  const hrData = hrRes.status === 'fulfilled' ? (hrRes.value.data ?? []) : []
  const latestHr = hrData[0] ?? null
  const restingHrSpikeDetected = hrData.some((h) => h.is_spike)
  const raceData = racesRes.status === 'fulfilled' ? (racesRes.value.data ?? []) : []
  const upcomingRace = raceData[0]
    ? {
        name: raceData[0].name,
        daysUntil: Math.ceil(
          (new Date(raceData[0].race_date).getTime() - Date.now()) / 86400000
        ),
      }
    : null

  // ── Habits ───────────────────────────────────────────────────────
  const habits = habitsRes.status === 'fulfilled' ? (habitsRes.value.data ?? []) : []
  const habitLogs = habitLogsRes.status === 'fulfilled' ? (habitLogsRes.value.data ?? []) : []
  const habitCompletions = habits.map((h) => ({
    name: h.name,
    streak: h.streak ?? 0,
    completions: habitLogs.filter((l) => l.habit_id === h.id).length,
  }))
  const totalPossible = habits.length * 7
  const totalCompleted = habitCompletions.reduce((s, h) => s + h.completions, 0)
  const weeklyComplianceRate = totalPossible > 0 ? (totalCompleted / totalPossible) * 100 : 0
  const sorted = [...habitCompletions].sort((a, b) => b.streak - a.streak)
  const topStreakHabit = sorted[0]?.name ?? null
  const failingHabits = habitCompletions
    .filter((h) => h.completions < 3) // <3/7 days = at-risk
    .map((h) => h.name)

  // ── Supplements ──────────────────────────────────────────────────
  const sups = supplementsRes.status === 'fulfilled' ? (supplementsRes.value.data ?? []) : []
  const activeSups = sups.filter((s) => !s.is_paused)
  const supLogs = supplementLogsRes.status === 'fulfilled' ? (supplementLogsRes.value.data ?? []) : []
  const takenIds = new Set(supLogs.filter((l) => l.taken).map((l) => l.supplement_id))
  const pendingToday = activeSups.filter((s) => !takenIds.has(s.id)).map((s) => s.name)

  return {
    trading: { recentPnl, winRate, ruleBreaks, activeRiskRules },
    running: {
      latestRestingHr: latestHr?.bpm ?? null,
      restingHrSpikeDetected,
      upcomingRace,
      recoveryStatus: restingHrSpikeDetected ? 'spike' : latestHr ? 'ok' : 'no_data',
    },
    habits: { weeklyComplianceRate, topStreakHabit, failingHabits },
    supplements: {
      activeCount: activeSups.length,
      takenTodayCount: takenIds.size,
      totalDueTodayCount: activeSups.length,
      pendingToday,
    },
  }
}

export function buildGlobalContextBlock(ctx: GlobalLifeContext): string {
  const sections: string[] = []

  // Trading
  const pnlStr =
    ctx.trading.recentPnl >= 0
      ? `+$${ctx.trading.recentPnl.toFixed(2)}`
      : `-$${Math.abs(ctx.trading.recentPnl).toFixed(2)}`
  const riskRuleLines = ctx.trading.activeRiskRules
    .map((r) => `  - ${r.label}: ${r.value}`)
    .join('\n')
  sections.push(
    `## Trading (last 7 days)\n` +
      `Net P&L: ${pnlStr} | Win rate: ${ctx.trading.winRate.toFixed(0)}% | Rule breaks: ${ctx.trading.ruleBreaks}\n` +
      (riskRuleLines ? `Active risk gates:\n${riskRuleLines}` : 'No gate configs loaded.')
  )

  // Running / Recovery
  const hrNote = ctx.running.restingHrSpikeDetected
    ? `⚠️ Resting HR SPIKE detected (latest: ${ctx.running.latestRestingHr} bpm) — recovery at risk`
    : ctx.running.latestRestingHr
      ? `Resting HR: ${ctx.running.latestRestingHr} bpm (normal range)`
      : 'Resting HR: no data this week'
  const raceNote = ctx.running.upcomingRace
    ? `Upcoming race: ${ctx.running.upcomingRace.name} in ${ctx.running.upcomingRace.daysUntil} days`
    : 'No upcoming races logged'
  sections.push(`## Running / Recovery\n${hrNote}\n${raceNote}`)

  // Habits
  const failNote =
    ctx.habits.failingHabits.length
      ? `Failing habits (<3/7 days): ${ctx.habits.failingHabits.join(', ')}`
      : 'All habits on track this week'
  sections.push(
    `## Habits (last 7 days)\n` +
      `Weekly compliance: ${ctx.habits.weeklyComplianceRate.toFixed(0)}%\n` +
      `Top streak: ${ctx.habits.topStreakHabit ?? 'none'}\n` +
      failNote
  )

  // Supplements
  const supNote =
    ctx.supplements.pendingToday.length
      ? `Not yet taken today: ${ctx.supplements.pendingToday.join(', ')}`
      : 'All supplements taken today ✓'
  sections.push(
    `## Supplements\n` +
      `Active: ${ctx.supplements.activeCount} | Taken today: ${ctx.supplements.takenTodayCount}/${ctx.supplements.totalDueTodayCount}\n` +
      supNote
  )

  return sections.join('\n\n')
}

// ── Nutrition + Plan Config context for Life Coach ────────────────────────────

export interface GlobalNutritionContext {
  meals: Array<{
    meal_name: string
    label: string
    description: string | null
    calories: number | null
    protein: number | null
    carbs: number | null
    fats: number | null
    day_type: string
  }>
  nutritionConfigs: Array<{
    config_key: string
    config_label: string
    config_value: string
    config_unit: string | null
  }>
  todayDayType: 'training' | 'rest'
}

export async function getGlobalContext(
  supabase: SupabaseClient
): Promise<GlobalNutritionContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { meals: [], nutritionConfigs: [], todayDayType: 'training' }
  }

  // Determine today's day type (weekday = training, weekend = rest)
  const dow = new Date().getDay()
  const todayDayType: 'training' | 'rest' = dow >= 1 && dow <= 5 ? 'training' : 'rest'

  const [mealsResult, configsResult] = await Promise.allSettled([
    supabase
      .from('meals')
      .select('meal_name, label, description, calories, protein, carbs, fats, day_type')
      .eq('user_id', user.id)
      .eq('day_type', todayDayType)
      .order('order_index'),
    supabase
      .from('plan_configs')
      .select('config_key, config_label, config_value, config_unit')
      .eq('user_id', user.id)
      .eq('module', 'nutrition'),
  ])

  const meals =
    mealsResult.status === 'fulfilled' ? (mealsResult.value.data ?? []) : []
  const nutritionConfigs =
    configsResult.status === 'fulfilled' ? (configsResult.value.data ?? []) : []

  return { meals, nutritionConfigs, todayDayType }
}

export function buildNutritionContextBlock(ctx: GlobalNutritionContext): string {
  const dayLabel = ctx.todayDayType === 'training' ? 'Training day' : 'Rest day'

  const totalCals = ctx.meals.reduce((s, m) => s + (m.calories ?? 0), 0)
  const totalProtein = ctx.meals.reduce((s, m) => s + (m.protein ?? 0), 0)
  const totalCarbs = ctx.meals.reduce((s, m) => s + (m.carbs ?? 0), 0)
  const totalFats = ctx.meals.reduce((s, m) => s + (m.fats ?? 0), 0)

  const mealLines = ctx.meals
    .map(
      (m) =>
        `  - [${m.meal_name}] ${m.label}: ${m.description ?? 'no description'} ` +
        `(${m.calories ?? '?'} kcal | ${m.protein ?? '?'}g P | ${m.carbs ?? '?'}g C | ${m.fats ?? '?'}g F)`
    )
    .join('\n')

  const configLines = ctx.nutritionConfigs
    .map((c) => `  - ${c.config_label}: ${c.config_value}${c.config_unit ? ' ' + c.config_unit : ''}`)
    .join('\n')

  return (
    `## Nutrition Plan (${dayLabel})\n` +
    `Daily totals: ~${totalCals} kcal | ${totalProtein.toFixed(0)}g protein | ${totalCarbs.toFixed(0)}g carbs | ${totalFats.toFixed(0)}g fat\n` +
    (mealLines ? `Meals:\n${mealLines}` : 'No meals loaded.') +
    '\n\n' +
    `## Nutrition Config Targets\n` +
    (configLines || '  (no nutrition configs seeded)')
  )
}
