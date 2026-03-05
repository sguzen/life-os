// Daily Brief API — generates a one-paragraph Gemini morning summary

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { getHabitsWithLogs } from '@/lib/supabase/habits'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET() {
  try {
    const supabase = createClient()

    const [habitsResult, tradesResult, activitiesResult, debtsResult, payoutsResult] =
      await Promise.allSettled([
        getHabitsWithLogs(supabase),
        supabase
          .from('trades')
          .select('instrument, outcome, net_pnl, entry_time, followed_rules')
          .order('entry_time', { ascending: false })
          .limit(5),
        supabase
          .from('running_activities')
          .select('name, workout_type, distance_meters, started_at')
          .order('started_at', { ascending: false })
          .limit(3),
        supabase
          .from('debts')
          .select('current_balance')
          .eq('is_paid_off', false),
        supabase
          .from('prop_payouts')
          .select('amount, payout_date')
          .order('payout_date', { ascending: false })
          .limit(1),
      ])

    const habits = habitsResult.status === 'fulfilled' ? habitsResult.value : []
    const trades =
      tradesResult.status === 'fulfilled' ? (tradesResult.value.data ?? []) : []
    const activities =
      activitiesResult.status === 'fulfilled' ? (activitiesResult.value.data ?? []) : []
    const debts =
      debtsResult.status === 'fulfilled' ? (debtsResult.value.data ?? []) : []
    const lastPayout =
      payoutsResult.status === 'fulfilled'
        ? (payoutsResult.value.data?.[0] ?? null)
        : null

    const todayLabel = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const completedToday = habits.filter((h) => h.logged_today).length
    const totalHabits = habits.length
    const topStreak = [...habits].sort((a, b) => b.streak - a.streak)[0]
    const totalDebt = debts.reduce((sum: number, d: { current_balance?: number }) => sum + (d.current_balance ?? 0), 0)
    const lastTrade = trades[0] ?? null
    const lastRun = activities[0] ?? null

    const tradeStr = lastTrade
      ? `${lastTrade.instrument} ${lastTrade.outcome.toUpperCase()}, net P&L ${
          lastTrade.net_pnl != null
            ? (lastTrade.net_pnl >= 0 ? '+$' : '-$') + Math.abs(lastTrade.net_pnl).toFixed(0)
            : 'open'
        }, rules ${lastTrade.followed_rules === false ? 'BROKEN' : 'followed'}`
      : 'no recent trades'

    const runStr = lastRun
      ? `${lastRun.workout_type} ${(lastRun.distance_meters / 1000).toFixed(1)} km`
      : 'no recent runs'

    const debtStr =
      totalDebt > 0
        ? `$${totalDebt.toFixed(0)} remaining${lastPayout ? `, last payout $${lastPayout.amount} on ${lastPayout.payout_date}` : ''}`
        : 'no active debts'

    const context = [
      `Today: ${todayLabel}.`,
      `Habits: ${completedToday}/${totalHabits} done today. Top streak: ${topStreak ? `${topStreak.name} at ${topStreak.streak} days` : 'none'}.`,
      `Last trade: ${tradeStr}.`,
      `Last run: ${runStr}.`,
      `Debt: ${debtStr}.`,
    ].join(' ')

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: `You are a personal AI life coach briefing a 43-year-old female athlete and prop trader at the start of her day. Write exactly one tight paragraph (3–5 sentences). Acknowledge what the data shows, highlight the single most important focus or encouragement, and connect the dots across habits/trading/running/finances. Be specific and data-driven. No markdown, no headers — plain prose only.`,
      prompt: context,
      maxTokens: 220,
      temperature: 0.7,
    })

    return Response.json({ brief: text })
  } catch (err) {
    console.error('[daily-brief]', err)
    return Response.json({ brief: null }, { status: 500 })
  }
}
