import { createClient } from '@/lib/supabase/server'
import { getHabitsWithLogs } from '@/lib/supabase/habits'
import { getDebts, getPropPayouts } from '@/lib/supabase/finance'
import { getActivities, getRaceTargets } from '@/lib/supabase/running'

import { MorningCheckin } from '@/components/morning/MorningCheckin'
import { HabitsRingCard } from '@/components/dashboard/habits-ring-card'
import { HabitStreaksCard } from '@/components/dashboard/habit-streaks-card'
import type { StreakItem } from '@/components/dashboard/habit-streaks-card'
import { WeeklyComplianceCard } from '@/components/dashboard/weekly-compliance-card'
import { LatestTradeCard } from '@/components/dashboard/latest-trade-card'
import type { LatestTradeData } from '@/components/dashboard/latest-trade-card'
import { PropAccountCard } from '@/components/dashboard/prop-account-card'
import type { PropAccountData } from '@/components/dashboard/prop-account-card'
import { NextRunCard } from '@/components/dashboard/next-run-card'
import type { NextRunData } from '@/components/dashboard/next-run-card'
import { DebtSummaryCard } from '@/components/dashboard/debt-summary-card'
import type { DebtSummaryData } from '@/components/dashboard/debt-summary-card'
import { AIDailyBrief } from '@/components/dashboard/ai-daily-brief'
import { NutritionCard } from '@/components/dashboard/nutrition-card'
import {
  getServerNutritionLog,
  getServerSupplementLog,
} from '@/lib/supabase/nutrition'
import type { HabitWithLogs } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(today: Date) {
  const dow = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)

  const lastMonday = new Date(monday)
  lastMonday.setDate(monday.getDate() - 7)

  const thisWeekDays: string[] = []
  for (const d = new Date(monday); d <= today; d.setDate(d.getDate() + 1)) {
    thisWeekDays.push(d.toISOString().slice(0, 10))
  }

  const lastWeekDays: string[] = []
  for (const d = new Date(lastMonday); d < monday; d.setDate(d.getDate() + 1)) {
    lastWeekDays.push(d.toISOString().slice(0, 10))
  }

  return { thisWeekDays, lastWeekDays }
}

function computeCompliance(habits: HabitWithLogs[], days: string[]): number {
  const daily = habits.filter((h) => h.frequency === 'daily')
  const expected = daily.length * days.length
  if (expected === 0) return 0
  let completed = 0
  for (const h of daily) {
    const logged = new Set(h.logs.map((l) => l.logged_at))
    for (const day of days) {
      if (logged.has(day)) completed++
    }
  }
  return Math.round((completed / expected) * 100)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()

  // Parallel data fetching — graceful fallback on any error
  const [habitsResult, debtsResult, payoutsResult, activitiesResult, racesResult, nutritionResult, supplementResult] =
    await Promise.allSettled([
      getHabitsWithLogs(supabase),
      getDebts(supabase),
      getPropPayouts(supabase),
      getActivities(3),
      getRaceTargets(),
      getServerNutritionLog(supabase, new Date().toISOString().slice(0, 10)),
      getServerSupplementLog(supabase, new Date().toISOString().slice(0, 10)),
    ])

  const habits = habitsResult.status === 'fulfilled' ? habitsResult.value : []
  const debts = debtsResult.status === 'fulfilled' ? debtsResult.value : []
  const payouts = payoutsResult.status === 'fulfilled' ? payoutsResult.value : []
  const activities = activitiesResult.status === 'fulfilled' ? activitiesResult.value : []
  const races = racesResult.status === 'fulfilled' ? racesResult.value : []
  const nutritionLog = nutritionResult.status === 'fulfilled' ? nutritionResult.value : null
  const supplementLog = supplementResult.status === 'fulfilled' ? supplementResult.value : null

  // Trades + prop accounts (use server client directly — trading.ts uses browser client)
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const [latestTradeResult, propAccountResult] = await Promise.allSettled([
    supabase
      .from('trades')
      .select('instrument, direction, net_pnl, outcome, followed_rules, entry_time, prop_accounts(account_label)')
      .order('entry_time', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('prop_accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const latestTradeRow =
    latestTradeResult.status === 'fulfilled' ? latestTradeResult.value.data : null
  const propAccountRow =
    propAccountResult.status === 'fulfilled' ? propAccountResult.value.data : null

  // Today's P&L for the active prop account (fees included for open trades)
  let todayPnl = 0
  if (propAccountRow?.id) {
    const { data: todayTrades } = await supabase
      .from('trades')
      .select('net_pnl, fees')
      .eq('prop_account_id', propAccountRow.id)
      .gte('entry_time', `${todayStr}T00:00:00`)
      .lte('entry_time', `${todayStr}T23:59:59`)

    todayPnl = (todayTrades ?? []).reduce(
      (s: number, t: { net_pnl: number | null; fees: number | null }) => {
        // Closed trades: net_pnl already deducts fees
        if (t.net_pnl !== null) return s + t.net_pnl
        // Open trades: gross_pnl unknown, but fees are a realized cost
        return s - (t.fees ?? 0)
      },
      0
    )
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  // Habits ring
  const completedToday = habits.filter((h) => h.logged_today).length
  const totalHabits = habits.length

  // Top 3 streaks
  const topStreaks: StreakItem[] = [...habits]
    .filter((h) => h.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3)
    .map((h) => ({ name: h.name, streak: h.streak, color: h.color, logged_today: h.logged_today }))

  // Weekly compliance
  const { thisWeekDays, lastWeekDays } = getWeekBounds(today)
  const thisWeekPct = computeCompliance(habits, thisWeekDays)
  const lastWeekPct = computeCompliance(habits, lastWeekDays)

  // Latest trade
  const latestTrade: LatestTradeData | null = latestTradeRow
    ? {
        instrument: latestTradeRow.instrument,
        direction: latestTradeRow.direction,
        net_pnl: latestTradeRow.net_pnl,
        outcome: latestTradeRow.outcome,
        followed_rules: latestTradeRow.followed_rules,
        entry_time: latestTradeRow.entry_time,
        prop_account_label:
          (latestTradeRow.prop_accounts as { account_label?: string } | null)?.account_label ?? null,
      }
    : null

  // Active prop account
  const propAccount: PropAccountData | null = propAccountRow
    ? {
        firm: propAccountRow.firm,
        account_label: propAccountRow.account_label,
        balance: propAccountRow.balance,
        account_size: propAccountRow.account_size,
        daily_loss_limit: propAccountRow.daily_loss_limit,
        today_pnl: todayPnl,
      }
    : null

  // Next race + last run
  const upcomingRaces = races.filter((r) => r.race_date >= todayStr)
  const nextRaceRow = upcomingRaces[0] ?? null
  const lastRunRow = activities[0] ?? null

  const nextRunData: NextRunData = {
    nextRace: nextRaceRow
      ? {
          race_name: nextRaceRow.race_name,
          race_date: nextRaceRow.race_date,
          distance_km: nextRaceRow.distance_km,
          target_time_seconds: nextRaceRow.target_time_seconds,
          days_until: Math.ceil(
            (new Date(nextRaceRow.race_date).getTime() - today.setHours(0, 0, 0, 0)) /
              86_400_000
          ),
        }
      : null,
    lastRun: lastRunRow
      ? {
          workout_type: lastRunRow.workout_type,
          distance_meters: lastRunRow.distance_meters,
          started_at: lastRunRow.started_at,
        }
      : null,
  }

  // Debt summary
  const activeDebts = debts.filter((d) => !d.is_paid_off)
  const totalOriginal = debts.reduce((s, d) => s + d.total_amount, 0)
  const totalRemaining = activeDebts.reduce((s, d) => s + d.current_balance, 0)
  const lastPayout = payouts[0] ?? null

  const debtData: DebtSummaryData = {
    total_remaining: totalRemaining,
    debt_count: activeDebts.length,
    total_original: totalOriginal,
    last_payout: lastPayout
      ? {
          firm_name: lastPayout.firm_name,
          amount: lastPayout.amount,
          payout_date: lastPayout.payout_date,
        }
      : null,
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{dateLabel}</p>
      </div>

      {/* Row 0 — Morning Check-In (client component, loads its own data) */}
      <MorningCheckin />

      {/* Row 1 — Habits: ring + streaks + compliance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HabitsRingCard completed={completedToday} total={totalHabits} />
        <HabitStreaksCard streaks={topStreaks} />
        <WeeklyComplianceCard thisWeek={thisWeekPct} lastWeek={lastWeekPct} />
      </div>

      {/* Row 2 — Trading: latest trade + prop account */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LatestTradeCard trade={latestTrade} />
        <PropAccountCard account={propAccount} />
      </div>

      {/* Row 3 — Running + Debt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NextRunCard data={nextRunData} />
        <DebtSummaryCard data={debtData} />
      </div>

      {/* Row 4 — Nutrition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NutritionCard log={nutritionLog} supplementLog={supplementLog} />
      </div>

      {/* Row 5 — AI Brief (full width, loads async) */}
      <AIDailyBrief />
    </div>
  )
}
