// get-coach-context.ts
// Targeted context loader that fetches raw, coach-ready data for the AI.
// Designed to fix "data blindness" — each section is clearly labelled so the
// model can unambiguously reference it. Called alongside getSystemSnapshot.

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Output types ─────────────────────────────────────────────────────────────

export interface CoachTrade {
  date: string
  symbol: string
  outcome: string
  net_pnl: number | null
  notes: string | null
}

export interface CoachActivity {
  date: string
  type: string
  distance_km: number
  pace_per_km: string
  avg_hr: number | null
  duration_min: number | null
}

export interface CoachMealEntry {
  meal_name: string
  label: string
  status: string           // pending | complete | partial | skipped | modified
  calories: number | null
  protein_g: number | null
}

export interface CoachConfig {
  module: string
  key: string
  label: string
  value: string
  unit: string | null
}

export interface CoachContext {
  as_of: string            // ISO timestamp — tells the model when this was fetched
  today: string            // YYYY-MM-DD
  day_type: 'training' | 'rest'
  trading: {
    last_5_trades: CoachTrade[]
    today_pnl: number
    today_trade_count: number
  }
  athletics: {
    last_3_activities: CoachActivity[]
    today_scheduled: {
      title: string
      type: string
      target_distance_km: number | null
      target_pace: string | null
    } | null
  }
  nutrition: {
    meals: CoachMealEntry[]
    meals_complete: number
    meals_total: number
    total_calories_consumed: number
    total_protein_consumed_g: number
    calorie_target: number | null
    protein_target_g: number | null
  }
  plan_configs: CoachConfig[]
}

// ── Helper ───────────────────────────────────────────────────────────────────

function secPerKmToPace(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function getCoachContext(supabase: SupabaseClient): Promise<CoachContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00.000Z`
  const todayEnd = `${today}T23:59:59.999Z`
  const dow = now.getDay()
  const dayType: 'training' | 'rest' = dow >= 1 && dow <= 5 ? 'training' : 'rest'

  if (!user) {
    return {
      as_of: now.toISOString(),
      today,
      day_type: dayType,
      trading: { last_5_trades: [], today_pnl: 0, today_trade_count: 0 },
      athletics: { last_3_activities: [], today_scheduled: null },
      nutrition: {
        meals: [], meals_complete: 0, meals_total: 0,
        total_calories_consumed: 0, total_protein_consumed_g: 0,
        calorie_target: null, protein_target_g: null,
      },
      plan_configs: [],
    }
  }

  const [
    tradesRecent,
    tradesToday,
    activities,
    scheduledToday,
    nutritionLog,
    mealDefs,
    planConfigs,
  ] = await Promise.allSettled([
    // Last 5 trades (any date)
    supabase
      .from('trades')
      .select('opened_at, symbol, outcome, net_pnl, notes')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .limit(5),

    // Today's trades for PnL total
    supabase
      .from('trades')
      .select('net_pnl')
      .eq('user_id', user.id)
      .gte('opened_at', todayStart)
      .lte('opened_at', todayEnd),

    // Last 3 running activities
    supabase
      .from('running_activities')
      .select('started_at, workout_type, distance_meters, avg_pace_sec_per_km, avg_hr, duration_seconds')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(3),

    // Today's scheduled training
    supabase
      .from('training_schedule')
      .select('title, type, target_distance, target_pace')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),

    // Today's nutrition log (meal statuses)
    supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .maybeSingle(),

    // Meal definitions for today's day type
    supabase
      .from('meals')
      .select('meal_name, label, calories, protein, day_type')
      .eq('user_id', user.id)
      .eq('day_type', dayType)
      .order('order_index'),

    // All plan configs
    supabase
      .from('plan_configs')
      .select('module, config_key, config_label, config_value, config_unit')
      .eq('user_id', user.id)
      .order('module')
      .order('config_key'),
  ])

  // ── Trading ──────────────────────────────────────────────────────────────

  const recentTrades = tradesRecent.status === 'fulfilled' ? (tradesRecent.value.data ?? []) : []
  const todayTrades = tradesToday.status === 'fulfilled' ? (tradesToday.value.data ?? []) : []

  const last5: CoachTrade[] = recentTrades.map((t: {
    opened_at: string; symbol: string; outcome: string; net_pnl: number | null; notes: string | null
  }) => ({
    date: t.opened_at.split('T')[0],
    symbol: t.symbol,
    outcome: t.outcome,
    net_pnl: t.net_pnl,
    notes: t.notes,
  }))

  const todayPnl = todayTrades.reduce(
    (sum: number, t: { net_pnl: number | null }) => sum + (t.net_pnl ?? 0), 0
  )

  // ── Athletics ────────────────────────────────────────────────────────────

  const acts = activities.status === 'fulfilled' ? (activities.value.data ?? []) : []
  const last3: CoachActivity[] = acts.map((a: {
    started_at: string; workout_type: string; distance_meters: number | null;
    avg_pace_sec_per_km: number | null; avg_hr: number | null; duration_seconds: number | null
  }) => ({
    date: a.started_at.split('T')[0],
    type: a.workout_type,
    distance_km: a.distance_meters ? Math.round((a.distance_meters / 1000) * 100) / 100 : 0,
    pace_per_km: secPerKmToPace(a.avg_pace_sec_per_km),
    avg_hr: a.avg_hr,
    duration_min: a.duration_seconds ? Math.round(a.duration_seconds / 60) : null,
  }))

  const scheduled = scheduledToday.status === 'fulfilled' ? scheduledToday.value.data : null

  // ── Nutrition ────────────────────────────────────────────────────────────

  const log = nutritionLog.status === 'fulfilled' ? nutritionLog.value.data : null
  const defs = mealDefs.status === 'fulfilled' ? (mealDefs.value.data ?? []) : []

  const mealKeys = [
    'meal_post_run', 'meal_breakfast', 'meal_lunch',
    'meal_snack1', 'meal_snack2', 'meal_snack3', 'meal_snack4',
  ]

  const meals: CoachMealEntry[] = defs.map((m: {
    meal_name: string; label: string; calories: number | null; protein: number | null
  }) => {
    const status = log
      ? ((log as Record<string, unknown>)[m.meal_name] as string) ?? 'pending'
      : 'pending'
    return {
      meal_name: m.meal_name,
      label: m.label,
      status,
      calories: m.calories,
      protein_g: m.protein,
    }
  })

  // If no DB meals yet, fall back to nutrition_log keys
  const effectiveMeals = meals.length > 0 ? meals : mealKeys.map((k) => ({
    meal_name: k,
    label: k.replace('meal_', '').replace(/_/g, ' '),
    status: log ? ((log as Record<string, unknown>)[k] as string) ?? 'pending' : 'pending',
    calories: null,
    protein_g: null,
  }))

  const completedMeals = effectiveMeals.filter((m) => m.status === 'complete')
  const totalCals = completedMeals.reduce((s, m) => s + (m.calories ?? 0), 0)
  const totalProtein = completedMeals.reduce((s, m) => s + (m.protein_g ?? 0), 0)

  // ── Plan configs ─────────────────────────────────────────────────────────

  const configs = planConfigs.status === 'fulfilled' ? (planConfigs.value.data ?? []) : []
  const configList: CoachConfig[] = configs.map((c: {
    module: string; config_key: string; config_label: string; config_value: string; config_unit: string | null
  }) => ({
    module: c.module,
    key: c.config_key,
    label: c.config_label,
    value: c.config_value,
    unit: c.config_unit,
  }))

  const ncMap = Object.fromEntries(configs.map((c: { config_key: string; config_value: string }) => [c.config_key, c.config_value]))

  return {
    as_of: now.toISOString(),
    today,
    day_type: dayType,
    trading: {
      last_5_trades: last5,
      today_pnl: Math.round(todayPnl * 100) / 100,
      today_trade_count: todayTrades.length,
    },
    athletics: {
      last_3_activities: last3,
      today_scheduled: scheduled
        ? {
            title: scheduled.title,
            type: scheduled.type,
            target_distance_km: scheduled.target_distance ?? null,
            target_pace: scheduled.target_pace ?? null,
          }
        : null,
    },
    nutrition: {
      meals: effectiveMeals,
      meals_complete: completedMeals.length,
      meals_total: effectiveMeals.length,
      total_calories_consumed: totalCals,
      total_protein_consumed_g: totalProtein,
      calorie_target: ncMap[dayType === 'training' ? 'calories_training' : 'calories_rest']
        ? parseInt(ncMap[dayType === 'training' ? 'calories_training' : 'calories_rest'])
        : null,
      protein_target_g: ncMap['protein_target'] ? parseInt(ncMap['protein_target']) : null,
    },
    plan_configs: configList,
  }
}

// ── Format as a compact, LLM-readable block ───────────────────────────────────

export function formatCoachContext(ctx: CoachContext): string {
  const lines: string[] = [
    `### LIVE_OS_DATA_SNAPSHOT`,
    `> Fetched: ${ctx.as_of} | Today: ${ctx.today} (${ctx.day_type} day)`,
    `> **You MUST use this data to answer questions. Do NOT say you lack access to the user's data.**`,
    '',
    '#### TRADING',
    `Today P&L: **$${ctx.trading.today_pnl >= 0 ? '+' : ''}${ctx.trading.today_pnl}** across ${ctx.trading.today_trade_count} trade(s)`,
    'Last 5 trades:',
    ...ctx.trading.last_5_trades.map((t) =>
      `  - ${t.date} | ${t.symbol} | ${t.outcome} | P&L: ${t.net_pnl != null ? `$${t.net_pnl}` : 'n/a'}${t.notes ? ` | Note: ${t.notes.slice(0, 60)}` : ''}`
    ),
    ctx.trading.last_5_trades.length === 0 ? '  (no recent trades)' : '',
    '',
    '#### ATHLETICS',
    ctx.athletics.today_scheduled
      ? `Today's scheduled: **${ctx.athletics.today_scheduled.title}** (${ctx.athletics.today_scheduled.type}) — ${ctx.athletics.today_scheduled.target_distance_km ?? '?'}km @ ${ctx.athletics.today_scheduled.target_pace ?? 'open pace'}`
      : 'Today\'s scheduled: none / rest day',
    'Last 3 activities:',
    ...ctx.athletics.last_3_activities.map((a) =>
      `  - ${a.date} | ${a.type} | ${a.distance_km}km @ ${a.pace_per_km}${a.avg_hr ? ` | HR: ${a.avg_hr}bpm` : ''}${a.duration_min ? ` | ${a.duration_min}min` : ''}`
    ),
    ctx.athletics.last_3_activities.length === 0 ? '  (no recent activities)' : '',
    '',
    '#### NUTRITION',
    `Meals: **${ctx.nutrition.meals_complete}/${ctx.nutrition.meals_total}** complete`,
    `Consumed: **${ctx.nutrition.total_calories_consumed} kcal** / target ${ctx.nutrition.calorie_target ?? '?'} kcal | Protein: **${ctx.nutrition.total_protein_consumed_g}g** / target ${ctx.nutrition.protein_target_g ?? '?'}g`,
    'Meal statuses:',
    ...ctx.nutrition.meals.map((m) =>
      `  - [${m.status.toUpperCase()}] ${m.label}${m.calories ? ` (${m.calories} kcal)` : ''}`
    ),
    '',
    '#### PLAN CONFIGS',
    ...ctx.plan_configs.map((c) =>
      `  - [${c.module}] ${c.label}: **${c.value}${c.unit ? ' ' + c.unit : ''}**`
    ),
    ctx.plan_configs.length === 0 ? '  (no configs loaded)' : '',
  ]

  return lines.filter((l) => l !== undefined).join('\n')
}
