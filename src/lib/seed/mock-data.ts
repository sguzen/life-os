/**
 * Core mock data seeding logic.
 * Generates 30 days of mathematically correlated daily_logs + morning_logs
 * so the Correlation Engine surfaces real patterns (sleep → PnL, stress, etc.).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Math helpers ──────────────────────────────────────────────────────────────

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1))
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function jitter(value: number, spread: number): number {
  return value + randBetween(-spread, spread)
}

// ── Core correlation model ────────────────────────────────────────────────────
// Sleep is the "root cause" variable. Everything else is derived from it with
// realistic noise so Pearson correlations come out strong (|r| > 0.55).

interface DayModel {
  date: string
  sleep_hours: number
  rhr: number
  hrv: number
  mood_score: number       // 1–5
  energy_level: number     // 1–5
  training_intensity: number    // 0–10
  training_duration_min: number
  training_rpe: number          // 0–10
  deep_work_hours: number
  tasks_completed: number
  stress_level: number          // 1–10
  focus_score: number           // 1–10
  trading_pnl: number
  trades_taken: number
  win_rate: number              // 0–1
  followed_rules: boolean
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_liters: number
  alcohol_units: number
}

function buildDayModel(dateStr: string): DayModel {
  const sleep_hours = clamp(randBetween(4, 9), 4, 9)
  const goodSleep = sleep_hours >= 7
  const poorSleep = sleep_hours < 6

  // Vitals — correlated with sleep
  const rhr = Math.round(
    clamp(jitter(goodSleep ? randBetween(42, 50) : randBetween(52, 62), 2), 40, 70)
  )
  const hrv = Math.round(
    clamp(jitter(goodSleep ? randBetween(55, 80) : randBetween(25, 50), 5), 18, 95)
  )
  const mood_score = Math.round(
    clamp(jitter(goodSleep ? randBetween(3.5, 5) : randBetween(1, 3), 0.5), 1, 5)
  )
  const energy_level = Math.round(
    clamp(jitter(goodSleep ? randBetween(3, 5) : randBetween(1, 3), 0.5), 1, 5)
  )

  // Training — scales with energy
  const willTrain = Math.random() < (goodSleep ? 0.85 : 0.45)
  const training_intensity = willTrain
    ? clamp(Math.round(jitter(energy_level * 1.8, 1)), 1, 10)
    : 0
  const training_duration_min = willTrain
    ? clamp(Math.round(randBetween(30, 90) * (energy_level / 5)), 20, 100)
    : 0
  const training_rpe = willTrain
    ? clamp(Math.round(jitter(training_intensity, 1)), 1, 10)
    : 0

  // Work — stress inversely correlated with sleep
  const stress_level = Math.round(
    clamp(jitter(poorSleep ? randBetween(6, 10) : randBetween(1, 5), 1), 1, 10)
  )
  const focus_score = Math.round(
    clamp(jitter(goodSleep ? randBetween(6, 10) : randBetween(2, 6), 1), 1, 10)
  )
  const deep_work_hours = clamp(
    parseFloat((focus_score * 0.5 + randBetween(-0.5, 0.5)).toFixed(1)),
    0,
    8
  )
  const tasks_completed = clamp(
    Math.round(focus_score * 1.2 + randBetween(-2, 2)),
    0,
    15
  )

  // Trading — strong sleep correlation; no trading most weekends
  const isWeekend = [0, 6].includes(new Date(dateStr).getDay())
  const willTrade = !isWeekend || Math.random() < 0.3

  let trading_pnl = 0
  let trades_taken = 0
  let win_rate = 0
  let followed_rules = false

  if (willTrade) {
    trades_taken = randInt(1, poorSleep ? 5 : 4)

    if (poorSleep) {
      trading_pnl = parseFloat((-randBetween(200, 800) * randBetween(1, 3)).toFixed(2))
      win_rate = parseFloat(randBetween(0.1, 0.35).toFixed(2))
      followed_rules = Math.random() < 0.2
    } else if (goodSleep) {
      trading_pnl = parseFloat((randBetween(100, 600) + jitter(0, 150)).toFixed(2))
      win_rate = parseFloat(randBetween(0.55, 0.80).toFixed(2))
      followed_rules = Math.random() < 0.85
    } else {
      const sign = Math.random() < 0.45 ? -1 : 1
      trading_pnl = parseFloat((sign * randBetween(50, 300)).toFixed(2))
      win_rate = parseFloat(randBetween(0.35, 0.60).toFixed(2))
      followed_rules = Math.random() < 0.55
    }
  }

  // Nutrition — better choices when well-rested
  const calories = Math.round(goodSleep ? randBetween(1800, 2600) : randBetween(2200, 3400))
  const protein_g = Math.round(goodSleep ? randBetween(140, 200) : randBetween(80, 140))
  const carbs_g = Math.round(randBetween(150, 350))
  const fat_g = Math.round(randBetween(50, 110))
  const water_liters = parseFloat(
    (goodSleep ? randBetween(2.5, 4) : randBetween(1.5, 3)).toFixed(1)
  )
  const alcohol_units = poorSleep && Math.random() < 0.4 ? randInt(1, 4) : 0

  return {
    date: dateStr,
    sleep_hours: parseFloat(sleep_hours.toFixed(1)),
    rhr,
    hrv,
    mood_score,
    energy_level,
    training_intensity,
    training_duration_min,
    training_rpe,
    deep_work_hours,
    tasks_completed,
    stress_level,
    focus_score,
    trading_pnl,
    trades_taken,
    win_rate,
    followed_rules,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    water_liters,
    alcohol_units,
  }
}

// ── Row builders ──────────────────────────────────────────────────────────────

// Columns match the actual morning_logs DDL (20260309000001_morning_logs.sql):
// resting_hr_bpm, sleep_hours, sleep_quality, energy_level, mood, body_readiness, notes
function buildMorningLogRow(userId: string, m: DayModel) {
  return {
    user_id: userId,
    log_date: m.date,
    sleep_hours: m.sleep_hours,
    resting_hr_bpm: m.rhr,
    mood: m.mood_score,
    sleep_quality: m.mood_score,       // reuse mood as a proxy for sleep quality
    energy_level: m.energy_level,
    body_readiness: m.energy_level,    // reuse energy as a proxy for body readiness
    notes:
      m.sleep_hours < 6
        ? 'Rough night, feel sluggish.'
        : m.sleep_hours > 7.5
          ? 'Slept well, feeling sharp.'
          : 'Average night.',
  }
}

function buildDailyLogRows(userId: string, m: DayModel) {
  return [
    {
      user_id: userId,
      category: 'morning',
      date: m.date,
      metrics: {
        sleep_hours: m.sleep_hours,
        rhr: m.rhr,
        hrv: m.hrv,
        mood_score: m.mood_score,
        energy_level: m.energy_level,
      },
      journal_notes: null,
    },
    {
      user_id: userId,
      category: 'training',
      date: m.date,
      metrics: {
        did_train: m.training_intensity > 0,
        intensity: m.training_intensity,
        duration_min: m.training_duration_min,
        rpe: m.training_rpe,
        sleep_quality_before: m.sleep_hours,
      },
      journal_notes:
        m.training_intensity > 7
          ? 'Strong session, pushed hard.'
          : m.training_intensity > 0
            ? 'Decent session.'
            : 'Rest day.',
    },
    {
      user_id: userId,
      category: 'work',
      date: m.date,
      metrics: {
        deep_work_hours: m.deep_work_hours,
        tasks_completed: m.tasks_completed,
        stress_level: m.stress_level,
        focus_score: m.focus_score,
        trading_pnl: m.trading_pnl,
        trades_taken: m.trades_taken,
        win_rate: m.win_rate,
        followed_rules: m.followed_rules,
      },
      journal_notes:
        m.trading_pnl > 300
          ? 'Excellent trading day, stayed disciplined.'
          : m.trading_pnl < -300
            ? 'Difficult session, revenge-traded after early loss.'
            : null,
    },
    {
      user_id: userId,
      category: 'nutrition',
      date: m.date,
      metrics: {
        calories: m.calories,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        fat_g: m.fat_g,
        water_liters: m.water_liters,
        alcohol_units: m.alcohol_units,
      },
      journal_notes: m.alcohol_units > 0 ? `Had ${m.alcohol_units} drinks.` : null,
    },
  ]
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function seedMockData(
  userId: string,
  supabase: SupabaseClient
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = []
  let inserted = 0

  const today = new Date()
  const days: DayModel[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(buildDayModel(d.toISOString().slice(0, 10)))
  }

  // morning_logs
  const morningRows = days.map((d) => buildMorningLogRow(userId, d))
  const { error: morningErr, count: morningCount } = await supabase
    .from('morning_logs')
    .upsert(morningRows, { onConflict: 'user_id,log_date', count: 'exact' })

  if (morningErr) {
    errors.push(`morning_logs: ${morningErr.message}`)
  } else {
    inserted += morningCount ?? morningRows.length
  }

  // daily_logs — 4 categories × 30 days = 120 rows
  // Table may not exist yet; skip gracefully if missing rather than hard-failing.
  const dailyRows = days.flatMap((d) => buildDailyLogRows(userId, d))
  const { error: dailyErr, count: dailyCount } = await supabase
    .from('daily_logs')
    .upsert(dailyRows, { onConflict: 'user_id,category,date', count: 'exact' })

  if (dailyErr) {
    const missing =
      dailyErr.message.includes('permission denied') ||
      dailyErr.message.includes('does not exist') ||
      dailyErr.message.includes('relation')
    if (missing) {
      errors.push(
        'daily_logs table not found — run the migration in docs/migrations/daily_logs.sql first'
      )
    } else {
      errors.push(`daily_logs: ${dailyErr.message}`)
    }
  } else {
    inserted += dailyCount ?? dailyRows.length
  }

  return { inserted, errors }
}
