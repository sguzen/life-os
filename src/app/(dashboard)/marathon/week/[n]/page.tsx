// Full week view — all sessions, planned vs actual

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { TRAINING_PLAN } from '@/lib/marathon/plan'
import { getSessionsForWeek } from '@/lib/supabase/marathon'
import { SessionCard } from '@/components/marathon/SessionCard'

export async function generateMetadata({ params }: { params: { n: string } }): Promise<Metadata> {
  return { title: `Week ${params.n} — Marathon Training` }
}

export default async function WeekPage({ params }: { params: { n: string } }) {
  const weekNumber = parseInt(params.n, 10)
  if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 9) notFound()

  const planWeek = TRAINING_PLAN.find((w) => w.weekNumber === weekNumber)
  if (!planWeek) notFound()

  const dbSessions = await getSessionsForWeek(weekNumber)
  const today = new Date().toISOString().split('T')[0]

  // Generate ISO dates for each session day
  const weekDates = planWeek.sessions.map((_, i) => {
    const start = new Date(planWeek.dateRange.start + 'T12:00:00')
    start.setDate(start.getDate() + i)
    return start.toISOString().split('T')[0]
  })

  const weekActualKm = dbSessions
    .filter((s) => s.actual_km)
    .reduce((sum, s) => sum + (s.actual_km ?? 0), 0)

  const tooFastCount = dbSessions.filter((s) => s.went_too_fast).length
  const completedCount = dbSessions.filter((s) => s.status === 'completed' || s.status === 'modified').length

  const weekTypeLabels: Record<string, string> = {
    normal: '',
    limassol: '· Limassol Race Week',
    post_limassol: '· Recovery',
    peak: '· Peak Week',
    taper: '· Taper',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/marathon" className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Training hub
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs text-white/40 uppercase tracking-wider">
          Week {weekNumber} of 9{weekTypeLabels[planWeek.weekType]}
        </p>
        <h1 className="text-2xl font-bold text-white">{planWeek.label}</h1>
        {planWeek.bloodDonationRecovery && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg inline-block mt-2">
            Blood donation recovery week — modified training load
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Planned km', value: `${planWeek.plannedKm}km` },
          { label: 'Actual km', value: `${weekActualKm.toFixed(1)}km` },
          { label: 'Sessions done', value: `${completedCount}/${planWeek.sessions.filter(s => s.type !== 'REST').length}` },
          { label: 'Pace alerts', value: tooFastCount > 0 ? `${tooFastCount} too fast` : 'Clean', valueClass: tooFastCount > 0 ? 'text-amber-400' : 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs text-white/40">{s.label}</p>
            <p className={`text-lg font-bold font-mono mt-1 ${(s as { valueClass?: string }).valueClass ?? 'text-white'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sessions */}
      <div className="space-y-4">
        {planWeek.sessions.map((session, i) => {
          const sessionDate = weekDates[i]
          const dbSession = dbSessions.find((s) => s.session_date === sessionDate) ?? null
          const isToday = sessionDate === today
          return (
            <div key={session.dayOfWeek}>
              <SessionCard
                planned={session}
                actual={dbSession}
                date={sessionDate}
                isToday={isToday}
              />
            </div>
          )
        })}
      </div>

      {/* Week navigation */}
      <div className="flex justify-between pt-4 border-t border-white/10">
        {weekNumber > 1 ? (
          <Link
            href={`/marathon/week/${weekNumber - 1}`}
            className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Week {weekNumber - 1}
          </Link>
        ) : <div />}
        {weekNumber < 9 ? (
          <Link
            href={`/marathon/week/${weekNumber + 1}`}
            className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Week {weekNumber + 1} <ChevronRight className="h-4 w-4" />
          </Link>
        ) : <div />}
      </div>
    </div>
  )
}
