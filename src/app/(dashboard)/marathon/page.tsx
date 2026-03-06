// Marathon Training Hub — Week at a glance + today's session

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, BarChart2 } from 'lucide-react'
import { TRAINING_PLAN, getCurrentWeek, getSessionForDate } from '@/lib/marathon/plan'
import { getTrainingWeeks, getSessionsForWeek } from '@/lib/supabase/marathon'
import { RaceCountdown } from '@/components/marathon/RaceCountdown'
import { SessionCard } from '@/components/marathon/SessionCard'
import { WeeklyProgress } from '@/components/marathon/WeeklyProgress'
import { AICoach } from '@/components/marathon/AICoach'

export const metadata: Metadata = {
  title: 'Marathon Training',
  description: 'Belgrade Marathon April 19 — 9-week training hub',
}

export default async function MarathonPage() {
  const today = new Date().toISOString().split('T')[0]
  const currentPlanWeek = getCurrentWeek()
  const weekNumber = currentPlanWeek?.weekNumber ?? 3

  const [dbWeeks, dbSessions] = await Promise.all([
    getTrainingWeeks(),
    getSessionsForWeek(weekNumber),
  ])

  const todayPlanned = getSessionForDate(today)
  const todayDb = dbSessions.find((s) => s.session_date === today) ?? null

  // Build week session pairs
  const planWeek = TRAINING_PLAN.find((w) => w.weekNumber === weekNumber)
  const weekDates = planWeek ? planWeek.sessions.map((_, i) => {
    const start = new Date(planWeek.dateRange.start + 'T12:00:00')
    start.setDate(start.getDate() + i)
    return start.toISOString().split('T')[0]
  }) : []

  // Total actual km this week
  const weekActualKm = dbSessions
    .filter((s) => s.status !== 'pending' && s.actual_km)
    .reduce((sum, s) => sum + (s.actual_km ?? 0), 0)

  // Recent pace flag
  const recentFlag = dbSessions.find((s) => s.went_too_fast)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Marathon</h1>
          <p className="text-sm text-white/40 mt-1">Belgrade April 19 · Week {weekNumber} of 9</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/marathon/history"
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-2 rounded-lg bg-white/5 border border-white/10"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            History
          </Link>
        </div>
      </div>

      {/* Countdown */}
      <RaceCountdown currentWeek={weekNumber} />

      {/* Today's session */}
      {todayPlanned && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Today — {new Date(today + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <SessionCard
            planned={todayPlanned}
            actual={todayDb}
            date={today}
            isToday
          />
        </div>
      )}

      {/* AI Coach */}
      <AICoach mode="chat" />

      {/* Pace flag */}
      {recentFlag && (
        <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-4 py-3 text-sm text-amber-300">
          Recent flag: {recentFlag.session_date} {recentFlag.planned_type} — went {recentFlag.pace_deviation_sec}s/km too fast
        </div>
      )}

      {/* Week sessions */}
      {planWeek && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Week {weekNumber} — {planWeek.label}
            </h2>
            <Link
              href={`/marathon/week/${weekNumber}`}
              className="text-xs text-white/30 hover:text-white/60 flex items-center gap-0.5 transition-colors"
            >
              Full week <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {/* km summary */}
          <div className="flex gap-4 text-sm">
            <span className="text-white/40">
              <span className="text-white font-mono">{weekActualKm.toFixed(1)}</span> / {planWeek.plannedKm}km
            </span>
          </div>

          {/* Session list */}
          <div className="space-y-2">
            {planWeek.sessions.map((session, i) => {
              const sessionDate = weekDates[i]
              const dbSession = dbSessions.find((s) => s.session_date === sessionDate) ?? null
              const isToday = sessionDate === today
              return (
                <SessionCard
                  key={session.dayOfWeek}
                  planned={session}
                  actual={dbSession}
                  date={sessionDate}
                  isToday={isToday}
                  compact
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Volume chart */}
      <WeeklyProgress planWeeks={TRAINING_PLAN} dbWeeks={dbWeeks} />

      {/* Week navigation */}
      <div className="grid grid-cols-3 gap-3">
        {[weekNumber - 1, weekNumber, weekNumber + 1].filter((n) => n >= 1 && n <= 9).map((n) => {
          const w = TRAINING_PLAN.find((p) => p.weekNumber === n)
          if (!w) return null
          return (
            <Link
              key={n}
              href={`/marathon/week/${n}`}
              className={`rounded-xl p-4 border text-sm transition-colors ${
                n === weekNumber
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/8'
              }`}
            >
              <p className="font-semibold">Week {n}</p>
              <p className="text-xs text-white/30 mt-0.5">{w.plannedKm}km · {w.weekType}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
