// P5-01: AI Coaching Service Layer
// Context builders and system prompts for Gemini-powered coaching

import type { HabitWithLogs } from '@/lib/types'

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
