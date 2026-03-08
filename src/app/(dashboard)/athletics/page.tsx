// Athletics — unified training hub merging Running + Marathon modules
// Shows: Today's Focus (plan vs actual), week sessions, activity log, HR chart

import type { Metadata } from 'next'
import Link from 'next/link'
import { Upload, BarChart2 } from 'lucide-react'
import { Suspense } from 'react'

import {
  seedTrainingSchedule,
  getScheduledWorkout,
  getTodayActivity,
  getThisWeekSchedule,
} from '@/lib/supabase/athletics'
import { getActivities, getRestingHrLogs, getRaceTargets } from '@/lib/supabase/running'
import { getTrainingWeeks, getSessionsForWeek } from '@/lib/supabase/marathon'
import { TRAINING_PLAN, getCurrentWeek, getSessionForDate } from '@/lib/marathon/plan'
import { formatDistance, formatDuration, formatPace } from '@/lib/running/format'
import { ExportButton } from '@/components/export/export-button'

import { TodaysFocusCard } from '@/components/athletics/todays-focus-card'
import { ActivityList } from '@/components/running/activity-list'
import { FitUpload } from '@/components/running/fit-upload'
import { RaceTracker } from '@/components/running/race-tracker'
import { RestingHrChart } from '@/components/running/resting-hr-chart'
import { LogRestingHrForm } from '@/components/running/log-resting-hr-form'
import { SessionCard } from '@/components/marathon/SessionCard'
import { WeeklyProgress } from '@/components/marathon/WeeklyProgress'
import { RaceCountdown } from '@/components/marathon/RaceCountdown'
import { AICoach } from '@/components/marathon/AICoach'

export const metadata: Metadata = {
  title: 'Athletics',
  description: 'Unified training hub — Garmin activities mapped against the marathon plan',
}

export default async function AthleticsPage() {
  const today = new Date().toISOString().split('T')[0]

  // Seed plan into DB on first load (idempotent, ~1 extra query when already seeded)
  await seedTrainingSchedule()

  const currentPlanWeek = getCurrentWeek()
  const weekNumber = currentPlanWeek?.weekNumber ?? 3

  const [
    scheduledToday,
    activityToday,
    activities,
    hrLogs,
    races,
    dbWeeks,
    dbSessionsThisWeek,
  ] = await Promise.all([
    getScheduledWorkout(today),
    getTodayActivity(),
    getActivities(25),
    getRestingHrLogs(14),
    getRaceTargets(),
    getTrainingWeeks(),
    getSessionsForWeek(weekNumber),
  ])

  // Week summary stats (last 7 days of uploaded activities)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const weekActivities = activities.filter((a) => new Date(a.started_at) >= cutoff)
  const weekDistM = weekActivities.reduce((s, a) => s + a.distance_meters, 0)
  const weekSec = weekActivities.reduce((s, a) => s + a.duration_seconds, 0)
  const avgPaces = weekActivities
    .map((a) => a.avg_pace_sec_per_km)
    .filter((p): p is number => p !== null)
  const avgPace = avgPaces.length
    ? avgPaces.reduce((s, p) => s + p, 0) / avgPaces.length
    : null

  // Plan week data
  const planWeek = TRAINING_PLAN.find((w) => w.weekNumber === weekNumber)
  const weekDates = planWeek
    ? planWeek.sessions.map((_, i) => {
        const d = new Date(planWeek.dateRange.start + 'T12:00:00')
        d.setDate(d.getDate() + i)
        return d.toISOString().split('T')[0]
      })
    : []

  const weekActualKm = dbSessionsThisWeek
    .filter((s) => s.status !== 'pending' && s.actual_km)
    .reduce((sum, s) => sum + (s.actual_km ?? 0), 0)

  const todayPlanned = getSessionForDate(today)

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Athletics</h1>
          <p className="text-sm text-white/40 mt-1">
            Belgrade Marathon · Week {weekNumber} of 9 · Garmin log
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/marathon/history"
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-2 rounded-lg bg-white/5 border border-white/10"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            History
          </Link>
          <ExportButton href="/api/export/runs" label="Export CSV" />
        </div>
      </div>

      {/* ── Race countdown ───────────────────────────────────── */}
      <RaceCountdown currentWeek={weekNumber} />

      {/* ── Stats row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Runs this week', value: String(weekActivities.length) },
          { label: 'Weekly distance', value: formatDistance(weekDistM) },
          { label: 'Weekly time', value: formatDuration(weekSec) },
          {
            label: `Week ${weekNumber} plan`,
            value: planWeek
              ? `${weekActualKm.toFixed(0)} / ${planWeek.plannedKm} km`
              : '—',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-white/5 border border-white/10 p-4"
          >
            <p className="text-xs text-white/40">{s.label}</p>
            <p className="text-base font-bold text-white mt-1 font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Today's Focus ────────────────────────────────────── */}
      <TodaysFocusCard
        date={today}
        scheduled={scheduledToday}
        activity={activityToday}
        planned={todayPlanned ?? null}
      />

      {/* ── AI Coach ────────────────────────────────────────── */}
      <AICoach mode="chat" />

      {/* ── 2-column main layout ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left — plan + log */}
        <div className="lg:col-span-2 space-y-8">

          {/* This week's plan sessions */}
          {planWeek && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Week {weekNumber} — {planWeek.label}
                </h2>
                <Link
                  href={`/marathon/week/${weekNumber}`}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-0.5"
                >
                  Full week →
                </Link>
              </div>

              <div className="space-y-2">
                {planWeek.sessions.map((session, i) => {
                  const sessionDate = weekDates[i]
                  const dbSession =
                    dbSessionsThisWeek.find((s) => s.session_date === sessionDate) ?? null
                  return (
                    <SessionCard
                      key={session.dayOfWeek}
                      planned={session}
                      actual={dbSession}
                      date={sessionDate}
                      isToday={sessionDate === today}
                      compact
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* Upload .fit */}
          <details className="group rounded-xl bg-white/5 border border-white/10">
            <summary className="flex items-center gap-2 px-5 py-4 cursor-pointer list-none select-none">
              <Upload className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Upload Garmin .fit file</span>
              <span className="ml-auto text-xs text-white/30 group-open:hidden">expand</span>
            </summary>
            <div className="px-5 pb-5">
              <FitUpload />
            </div>
          </details>

          {/* Recent activities */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Recent Activities</h2>
            <Suspense fallback={<p className="text-sm text-white/30">Loading…</p>}>
              <ActivityList activities={activities} />
            </Suspense>
          </section>
        </div>

        {/* Right — recovery + volume */}
        <div className="space-y-6">

          {/* Race tracker */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <RaceTracker races={races} />
          </div>

          {/* Resting HR */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-white">Resting Heart Rate</h2>
            <RestingHrChart logs={hrLogs} />
            <div className="border-t border-white/10 pt-4">
              <LogRestingHrForm />
            </div>
          </div>

          {/* Weekly volume chart */}
          <WeeklyProgress planWeeks={TRAINING_PLAN} dbWeeks={dbWeeks} />
        </div>
      </div>

      {/* Week navigation */}
      <div className="grid grid-cols-3 gap-3">
        {[weekNumber - 1, weekNumber, weekNumber + 1]
          .filter((n) => n >= 1 && n <= 9)
          .map((n) => {
            const w = TRAINING_PLAN.find((p) => p.weekNumber === n)
            if (!w) return null
            return (
              <Link
                key={n}
                href={`/marathon/week/${n}`}
                className={`rounded-xl p-4 border text-sm transition-colors ${
                  n === weekNumber
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/[0.08]'
                }`}
              >
                <p className="font-semibold">Week {n}</p>
                <p className="text-xs text-white/30 mt-0.5">
                  {w.plannedKm}km · {w.weekType}
                </p>
              </Link>
            )
          })}
      </div>
    </div>
  )
}
