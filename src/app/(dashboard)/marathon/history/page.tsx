// Marathon history — session calendar, pace discipline chart, stats

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getRecentSessions, getTrainingWeeks } from '@/lib/supabase/marathon'
import { TRAINING_PLAN, SESSION_TYPE_LABELS, SESSION_TYPE_COLORS } from '@/lib/marathon/plan'
import { PaceDisciplineChart } from '@/components/marathon/PaceDisciplineChart'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Marathon History',
  description: 'All training sessions and pace discipline tracker',
}

export default async function HistoryPage() {
  const [sessions, dbWeeks] = await Promise.all([
    getRecentSessions(100),
    getTrainingWeeks(),
  ])

  const completed = sessions.filter((s) => s.status !== 'pending' && s.status !== 'skipped')
  const tooFastCount = sessions.filter((s) => s.went_too_fast).length
  const warmupsSkipped = sessions.filter((s) => s.skipped_warmup).length
  const totalKm = completed.reduce((sum, s) => sum + (s.actual_km ?? 0), 0)
  const longestRun = Math.max(...completed.map((s) => s.actual_km ?? 0), 0)
  const warmupCompliance = completed.length > 0
    ? Math.round(((completed.length - warmupsSkipped) / completed.length) * 100)
    : 100
  const paceCompliance = completed.length > 0
    ? Math.round(((completed.length - tooFastCount) / completed.length) * 100)
    : 100

  return (
    <div className="space-y-8">
      <Link href="/marathon" className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Training hub
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Training History</h1>
        <p className="text-sm text-white/40 mt-1">Belgrade Marathon · 9-week block</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Sessions done', value: `${completed.length}` },
          { label: 'Total km', value: `${totalKm.toFixed(0)}km` },
          { label: 'Longest run', value: `${longestRun.toFixed(1)}km` },
          { label: 'Pace discipline', value: `${paceCompliance}%`, note: `${tooFastCount} too fast`, warn: tooFastCount > 0 },
          { label: 'Warmup done', value: `${warmupCompliance}%`, note: `${warmupsSkipped} skipped`, warn: warmupsSkipped > 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs text-white/40">{s.label}</p>
            <p className={cn('text-xl font-bold font-mono mt-1', (s as { warn?: boolean }).warn ? 'text-amber-400' : 'text-white')}>{s.value}</p>
            {(s as { note?: string }).note && <p className="text-xs text-white/30 mt-0.5">{(s as { note?: string }).note}</p>}
          </div>
        ))}
      </div>

      {/* Pace discipline chart */}
      {completed.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Pace Discipline</h2>
          <p className="text-xs text-white/30">Planned vs actual pace — red dots went too fast</p>
          <PaceDisciplineChart sessions={completed} />
        </div>
      )}

      {/* Session log */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">All Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-white/30">No sessions logged yet.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const typeColor = SESSION_TYPE_COLORS[s.planned_type as keyof typeof SESSION_TYPE_COLORS] ?? 'text-white/40 bg-white/5'
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm',
                    'bg-white/[0.03] border border-white/[0.06]',
                    s.went_too_fast && 'border-amber-400/20',
                  )}
                >
                  <span className="text-white/30 font-mono text-xs w-20 shrink-0">{s.session_date}</span>
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded shrink-0', typeColor)}>
                    {SESSION_TYPE_LABELS[s.planned_type as keyof typeof SESSION_TYPE_LABELS] ?? s.planned_type}
                  </span>
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    {s.actual_km && <span className="text-white/60 font-mono">{s.actual_km}km</span>}
                    {s.actual_avg_pace && <span className="text-white/50 font-mono">@ {s.actual_avg_pace}/km</span>}
                    {s.actual_avg_hr && <span className="text-white/30 text-xs">HR {s.actual_avg_hr}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.went_too_fast && (
                      <span className="text-xs text-amber-400 font-mono">+{s.pace_deviation_sec}s</span>
                    )}
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      s.status === 'completed' ? 'text-emerald-400 bg-emerald-400/10' :
                      s.status === 'modified' ? 'text-blue-400 bg-blue-400/10' :
                      s.status === 'skipped' ? 'text-red-400 bg-red-400/10' :
                      'text-white/20 bg-white/5',
                    )}>
                      {s.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
