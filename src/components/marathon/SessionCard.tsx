import Link from 'next/link'
import { CheckCircle2, Clock, XCircle, AlertTriangle, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlannedSession } from '@/lib/marathon/plan'
import { SESSION_TYPE_LABELS, SESSION_TYPE_COLORS } from '@/lib/marathon/plan'
import type { TrainingSessionRow } from '@/lib/supabase/marathon'

interface SessionCardProps {
  planned: PlannedSession
  actual: TrainingSessionRow | null
  date: string           // ISO date
  isToday?: boolean
  compact?: boolean      // for week overview
}

function StatusIcon({ status, wentTooFast }: { status: string; wentTooFast: boolean }) {
  if (wentTooFast) return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
    case 'skipped':   return <XCircle className="h-4 w-4 text-red-400 shrink-0" />
    case 'modified':  return <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
    default:          return <Clock className="h-4 w-4 text-white/20 shrink-0" />
  }
}

export function SessionCard({ planned, actual, date, isToday, compact }: SessionCardProps) {
  const isRest = planned.type === 'REST'
  const status = actual?.status ?? 'pending'
  const wentTooFast = actual?.went_too_fast ?? false
  const typeColor = SESSION_TYPE_COLORS[planned.type]

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
        isToday ? 'bg-white/8 border border-white/20' : 'bg-white/[0.03] border border-white/[0.06]',
      )}>
        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded font-mono', typeColor)}>
          {planned.dayOfWeek}
        </span>
        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', typeColor)}>
          {SESSION_TYPE_LABELS[planned.type]}
        </span>
        <div className="flex-1 min-w-0">
          {actual?.actual_avg_pace && (
            <span className="text-xs text-white/50 font-mono">
              {actual.actual_km}km @ {actual.actual_avg_pace}/km
            </span>
          )}
          {!actual?.actual_avg_pace && planned.plannedKm && !isRest && (
            <span className="text-xs text-white/30">
              {planned.plannedKm}km planned
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {wentTooFast && (
            <span className="text-xs text-amber-400 font-mono">+{actual?.pace_deviation_sec}s</span>
          )}
          {isToday && status === 'pending' && !isRest ? (
            <Link
              href={`/marathon/session/${date}`}
              className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
            >
              Log
            </Link>
          ) : (
            <StatusIcon status={status} wentTooFast={wentTooFast} />
          )}
          {isRest && <Minus className="h-3.5 w-3.5 text-white/20" />}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-xl border p-5 space-y-3',
      isToday
        ? 'bg-white/8 border-orange-500/30 ring-1 ring-orange-500/20'
        : 'bg-white/5 border-white/10',
      wentTooFast && 'border-amber-400/30',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isToday && (
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Today</span>
          )}
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', typeColor)}>
            {SESSION_TYPE_LABELS[planned.type]}
          </span>
          {planned.hasStrength && (
            <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded">
              + Strength {planned.strengthWorkout}
            </span>
          )}
        </div>
        <StatusIcon status={status} wentTooFast={wentTooFast} />
      </div>

      {/* Description */}
      {!isRest && (
        <p className="text-sm text-white/70 leading-relaxed">{planned.description}</p>
      )}

      {/* Planned paces */}
      {planned.paceMin && (
        <div className="flex gap-4 text-xs text-white/40 font-mono">
          <span>Target: {planned.paceMin}{planned.paceMax && planned.paceMax !== planned.paceMin ? `–${planned.paceMax}` : ''}/km</span>
          {planned.plannedKm && <span>{planned.plannedKm}km</span>}
        </div>
      )}

      {/* Actual results */}
      {actual && status !== 'pending' && (
        <div className={cn(
          'rounded-lg p-3 space-y-1 text-sm',
          wentTooFast ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-white/5',
        )}>
          <div className="flex gap-4 font-mono text-xs flex-wrap">
            {actual.actual_km && <span className="text-white/80">{actual.actual_km}km</span>}
            {actual.actual_avg_pace && (
              <span className={wentTooFast ? 'text-amber-400' : 'text-white/80'}>
                @ {actual.actual_avg_pace}/km
                {wentTooFast && ` (+${actual.pace_deviation_sec}s/km too fast)`}
              </span>
            )}
            {actual.actual_avg_hr && <span className="text-white/50">HR {actual.actual_avg_hr}</span>}
          </div>
          {actual.notes && <p className="text-xs text-white/40">{actual.notes}</p>}
        </div>
      )}

      {/* CTA */}
      {isToday && status === 'pending' && !isRest && (
        <Link
          href={`/marathon/session/${date}`}
          className="block w-full text-center text-sm font-semibold py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white transition-colors"
        >
          Log This Session
        </Link>
      )}
      {!isToday && status === 'pending' && !isRest && (
        <Link
          href={`/marathon/session/${date}`}
          className="block w-full text-center text-xs text-white/30 hover:text-white/60 py-1 transition-colors"
        >
          Log early →
        </Link>
      )}
    </div>
  )
}
