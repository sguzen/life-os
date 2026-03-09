// get-system-snapshot.ts
// Fetches a structured JSON snapshot of the user's current Life OS state.
// Called at the start of every Life Coach API request so the AI has
// real-time data across all modules before generating a response.

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Output shape ─────────────────────────────────────────────────────────────

export interface SystemSnapshot {
  generated_at: string
  trading: {
    today_pnl: number
    today_trade_count: number
    plan_configs: { key: string; label: string; value: string; unit: string | null }[]
  }
  athletics: {
    recent_activities: {
      date: string
      type: string
      distance_km: number | null
      avg_pace_min_per_km: string | null
      avg_hr: number | null
    }[]
    today_schedule: {
      title: string
      type: string
      target_distance_km: number | null
      target_pace: string | null
    } | null
  }
  nutrition: {
    today_meals_complete: number
    today_meals_total: number
    estimated_calories_consumed: number
    estimated_protein_consumed: number
    plan_targets: { calories_training: number | null; calories_rest: number | null; protein: number | null }
    meal_statuses: { meal_name: string; label: string; status: string }[]
  }
  supplements: {
    active: { name: string; frequency: string | null; timing: string | null; taken_today: boolean }[]
    taken_today_count: number
    total_active_count: number
  }
}

// ── Helper: format seconds-per-km → "M:SS/km" ───────────────────────────────

function fmtPace(secPerKm: number | null): string | null {
  if (!secPerKm) return null
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function getSystemSnapshot(supabase: SupabaseClient): Promise<SystemSnapshot> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00.000Z`
  const todayEnd = `${today}T23:59:59.999Z`

  // Fan out all queries in parallel
  const [
    tradesToday,
    tradingConfigs,
    recentActivities,
    todaySchedule,
    nutritionLog,
    mealsDefinitions,
    nutritionConfigs,
    supplements,
    supplementLogEntries,
  ] = await Promise.allSettled([
    // 1. Today's trades
    supabase
      .from('trades')
      .select('net_pnl, outcome, opened_at')
      .eq('user_id', user!.id)
      .gte('opened_at', todayStart)
      .lte('opened_at', todayEnd),

    // 2. Trading plan_configs
    supabase
      .from('plan_configs')
      .select('config_key, config_label, config_value, config_unit')
      .eq('user_id', user!.id)
      .eq('module', 'trading'),

    // 3. Last 3 running activities
    supabase
      .from('running_activities')
      .select('started_at, workout_type, distance_meters, avg_pace_sec_per_km, avg_hr')
      .eq('user_id', user!.id)
      .order('started_at', { ascending: false })
      .limit(3),

    // 4. Today's training schedule
    supabase
      .from('training_schedule')
      .select('title, type, target_distance, target_pace')
      .eq('user_id', user!.id)
      .eq('date', today)
      .maybeSingle(),

    // 5. Today's nutrition log (meal statuses)
    supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', user!.id)
      .eq('log_date', today)
      .maybeSingle(),

    // 6. Meal definitions for today's day type
    supabase
      .from('meals')
      .select('meal_name, label, calories, protein, day_type')
      .eq('user_id', user!.id)
      .order('order_index'),

    // 7. Nutrition plan_configs
    supabase
      .from('plan_configs')
      .select('config_key, config_value')
      .eq('user_id', user!.id)
      .eq('module', 'nutrition'),

    // 8. Active supplements
    supabase
      .from('supplements')
      .select('id, name, frequency, timing, is_active, is_paused')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .eq('is_paused', false),

    // 9. Today's supplement log entries
    supabase
      .from('supplement_log_entries')
      .select('supplement_id, taken')
      .eq('user_id', user!.id)
      .eq('log_date', today),
  ])

  // ── Trading ──────────────────────────────────────────────────────────────

  const tradesData = tradesToday.status === 'fulfilled' ? (tradesToday.value.data ?? []) : []
  const todayPnl = tradesData.reduce(
    (sum: number, t: { net_pnl: number | null }) => sum + (t.net_pnl ?? 0),
    0
  )
  const tradingConfigsData =
    tradingConfigs.status === 'fulfilled' ? (tradingConfigs.value.data ?? []) : []

  // ── Athletics ────────────────────────────────────────────────────────────

  const activitiesData =
    recentActivities.status === 'fulfilled' ? (recentActivities.value.data ?? []) : []
  const scheduleData = todaySchedule.status === 'fulfilled' ? todaySchedule.value.data : null

  const recentActivitiesFormatted = activitiesData.map(
    (a: {
      started_at: string
      workout_type: string
      distance_meters: number | null
      avg_pace_sec_per_km: number | null
      avg_hr: number | null
    }) => ({
      date: a.started_at.split('T')[0],
      type: a.workout_type,
      distance_km: a.distance_meters ? Math.round((a.distance_meters / 1000) * 100) / 100 : null,
      avg_pace_min_per_km: fmtPace(a.avg_pace_sec_per_km),
      avg_hr: a.avg_hr,
    })
  )

  // ── Nutrition ────────────────────────────────────────────────────────────

  const logData = nutritionLog.status === 'fulfilled' ? nutritionLog.value.data : null
  const mealsData = mealsDefinitions.status === 'fulfilled' ? (mealsDefinitions.value.data ?? []) : []
  const nutritionConfigsData =
    nutritionConfigs.status === 'fulfilled' ? (nutritionConfigs.value.data ?? []) : []

  // Determine day type for calories target
  const dow = new Date().getDay()
  const isTrainingDay = dow >= 1 && dow <= 5
  const dayType = isTrainingDay ? 'training' : 'rest'

  const todayMeals = mealsData.filter(
    (m: { day_type: string }) => m.day_type === dayType
  )

  // Count complete meals from log
  const mealStatusKeys = [
    'meal_post_run',
    'meal_breakfast',
    'meal_lunch',
    'meal_snack1',
    'meal_snack2',
    'meal_snack3',
    'meal_snack4',
  ]

  const mealStatuses = todayMeals.map((m: { meal_name: string; label: string }) => ({
    meal_name: m.meal_name,
    label: m.label,
    status: logData ? ((logData as Record<string, unknown>)[m.meal_name] as string) ?? 'pending' : 'pending',
  }))

  const completedMeals = mealStatuses.filter(
    (ms: { status: string }) => ms.status === 'complete'
  ).length

  // Estimate consumed macros from completed meals
  const estimatedCals = todayMeals
    .filter((m: { meal_name: string }) =>
      mealStatuses.find(
        (ms: { meal_name: string; status: string }) =>
          ms.meal_name === m.meal_name && ms.status === 'complete'
      )
    )
    .reduce((sum: number, m: { calories: number | null }) => sum + (m.calories ?? 0), 0)

  const estimatedProtein = todayMeals
    .filter((m: { meal_name: string }) =>
      mealStatuses.find(
        (ms: { meal_name: string; status: string }) =>
          ms.meal_name === m.meal_name && ms.status === 'complete'
      )
    )
    .reduce((sum: number, m: { protein: number | null }) => sum + (m.protein ?? 0), 0)

  const ncMap = Object.fromEntries(
    nutritionConfigsData.map((c: { config_key: string; config_value: string }) => [
      c.config_key,
      c.config_value,
    ])
  ) as Record<string, string>

  // ── Supplements ──────────────────────────────────────────────────────────

  const supplementsData =
    supplements.status === 'fulfilled' ? (supplements.value.data ?? []) : []
  const logEntriesData =
    supplementLogEntries.status === 'fulfilled' ? (supplementLogEntries.value.data ?? []) : []

  const takenIds = new Set(
    logEntriesData
      .filter((e: { taken: boolean }) => e.taken)
      .map((e: { supplement_id: string }) => e.supplement_id)
  )

  const supplementsFormatted = supplementsData.map(
    (s: { id: string; name: string; frequency: string | null; timing: string | null }) => ({
      name: s.name,
      frequency: s.frequency,
      timing: s.timing,
      taken_today: takenIds.has(s.id),
    })
  )

  // ── Assemble ─────────────────────────────────────────────────────────────

  return {
    generated_at: new Date().toISOString(),
    trading: {
      today_pnl: Math.round(todayPnl * 100) / 100,
      today_trade_count: tradesData.length,
      plan_configs: tradingConfigsData.map(
        (c: { config_key: string; config_label: string; config_value: string; config_unit: string | null }) => ({
          key: c.config_key,
          label: c.config_label,
          value: c.config_value,
          unit: c.config_unit,
        })
      ),
    },
    athletics: {
      recent_activities: recentActivitiesFormatted,
      today_schedule: scheduleData
        ? {
            title: scheduleData.title,
            type: scheduleData.type,
            target_distance_km: scheduleData.target_distance ?? null,
            target_pace: scheduleData.target_pace ?? null,
          }
        : null,
    },
    nutrition: {
      today_meals_complete: completedMeals,
      today_meals_total: todayMeals.length,
      estimated_calories_consumed: estimatedCals,
      estimated_protein_consumed: estimatedProtein,
      plan_targets: {
        calories_training: ncMap['calories_training'] ? parseInt(ncMap['calories_training']) : null,
        calories_rest: ncMap['calories_rest'] ? parseInt(ncMap['calories_rest']) : null,
        protein: ncMap['protein_target'] ? parseInt(ncMap['protein_target']) : null,
      },
      meal_statuses: mealStatuses,
    },
    supplements: {
      active: supplementsFormatted,
      taken_today_count: supplementsFormatted.filter((s: { taken_today: boolean }) => s.taken_today).length,
      total_active_count: supplementsFormatted.length,
    },
  }
}
