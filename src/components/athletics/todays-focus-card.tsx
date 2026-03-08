// Today's Focus Card — compares today's training_schedule entry against the
// most recent Garmin activity uploaded today. Renders a side-by-side view of
// planned vs actual, or an upload prompt when no activity exists yet.

import Link from 'next/link'
import { Target, CheckCircle2, AlertTriangle, Footprints, Timer, TrendingUp, Heart, BedDouble } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPace, formatDistance, formatDuration } from '@/lib/running/format'
import type { TrainingScheduleRow } from '@/lib/supabase/athletics'
import type { RunningActivity } from '@/lib/types/running'
import type { PlannedSession } from '@/lib/marathon/plan'

// ── Type-to-color mapping ──────────────────────────────────────────────────

const TYPE_COLORS: Record<TrainingScheduleRow['type'], string> = {
  base:     'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  interval: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  long:     'text-red-400 bg-red-400/10 border-red-400/20',
  rest:     'text-white/30 bg-white/5 border-white/10',
  race:     'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
}

const TYPE_BORDER: Record<TrainingScheduleRow['type'], string> = {
  base:     'border-emerald-500/20',
  interval: 'border-orange-500/20',
  long:     'border-red-500/20',
  rest:     'border-white/10',
  race:     'border-yellow-500/20',
}

// ── Pace comparison helpers ────────────────────────────────────────────────

/** Parse "M:SS/km" → seconds per km */
function parsePaceString(pace: string | null): number | null {
  if (!pace) return null
  const clean = pace.replace('/km', '').trim()
  const parts = clean.split(':')
  if (parts.length !== 2) return null
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

/** Returns diff in sec/km: positive = actual slower, negative = actual faster */
function paceDelta(
  actualSecPerKm: number | null,
  targetPaceStr: string | null
): number | null {
  const target = parsePaceString(targetPaceStr)
  if (!actualSecPerKm || !target) return null
  return actualSecPerKm - target // +ve = slower than target
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PaceChip({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const abs = Math.abs(delta)
  const label = delta > 0 ? `+${abs}s slower` : `${abs}s faster`
  const color =
    Math.abs(delta) <= 10
      ? 'text-emerald-400 bg-emerald-400/10'
      : delta > 10
        ? 'text-blue-400 bg-blue-400/10'   // slower = conservative = ok for easy
        : 'text-red-400 bg-red-400/10'     // faster = pace discipline issue
  return (
    <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded font-medium', color)}>
      {label}
    </span>
  )
}

// ── Rest day variant ───────────────────────────────────────────────────────

function RestDayCard({ date }: { date: string }) {
  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        <BedDouble className="h-5 w-5 text-white/30" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Rest Day</p>
        <p className="text-xs text-white/40 mt-0.5">{label} — no session scheduled</p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface TodaysFocusCardProps {
  date: string
  scheduled: TrainingScheduleRow | null
  activity: RunningActivity | null
  /** Planned session from the hardcoded plan (for log link) */
  planned: (PlannedSession & { weekNumber: number }) | null
}

export function TodaysFocusCard({
  date,
  scheduled,
  activity,
  planned,
}: TodaysFocusCardProps) {
  // No plan entry at all (outside 9-week window)
  if (!scheduled) return null

  // Rest day
  if (scheduled.type === 'rest') return <RestDayCard date={date} />

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const delta = activity
    ? paceDelta(activity.avg_pace_sec_per_km, scheduled.target_pace)
    : null

  const isComplete = !!activity
  const paceOk = delta !== null && delta >= -10 // not more than 10s/km too fast

  return (
    <div className={cn(
      'rounded-xl border bg-white/5 p-5 space-y-4',
      TYPE_BORDER[scheduled.type],
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Target className="h-4 w-4 text-white/50 shrink-0" />
          <h2 className="text-sm font-semibold text-white">Today's Focus</h2>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full border',
            TYPE_COLORS[scheduled.type],
          )}>
            {scheduled.title}
          </span>
          {isComplete && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </span>
          )}
        </div>
        <span className="text-xs text-white/30 shrink-0">{dateLabel}</span>
      </div>

      {/* Plan details */}
      {scheduled.description && (
        <p className="text-sm text-white/60 leading-relaxed">{scheduled.description}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Planned */}
        <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Planned</p>
          <div className="flex gap-4 flex-wrap">
            {scheduled.target_distance && (
              <div className="text-sm">
                <span className="font-mono text-white font-semibold">
                  {scheduled.target_distance}km
                </span>
              </div>
            )}
            {scheduled.target_pace && (
              <div className="text-sm">
                <span className="font-mono text-white/70">@ {scheduled.target_pace}</span>
              </div>
            )}
            {!scheduled.target_distance && !scheduled.target_pace && (
              <span className="text-sm text-white/30">Effort-based session</span>
            )}
          </div>
        </div>

        {/* Actual */}
        <div className={cn(
          'rounded-lg border p-3 space-y-2',
          isComplete
            ? (paceOk ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-400/5 border-amber-400/20')
            : 'bg-white/[0.03] border-white/10',
        )}>
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Actual</p>

          {isComplete && activity ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-sm font-mono text-white font-semibold">
                  <Footprints className="h-3.5 w-3.5 text-white/40" />
                  {formatDistance(activity.distance_meters)}
                </span>
                <span className="flex items-center gap-1 text-sm font-mono text-white/70">
                  <TrendingUp className="h-3.5 w-3.5 text-white/40" />
                  {formatPace(activity.avg_pace_sec_per_km)}
                </span>
                {activity.avg_hr && (
                  <span className="flex items-center gap-1 text-sm text-white/50">
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                    {activity.avg_hr} bpm
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <Timer className="h-3 w-3" />
                  {formatDuration(activity.duration_seconds)}
                </span>
              </div>
              {delta !== null && (
                <div className="flex items-center gap-2">
                  <PaceChip delta={delta} />
                  {!paceOk && delta < -10 && (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      Pace discipline flag
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-white/30">No activity uploaded yet</p>
              <Link
                href={`/marathon/session/${date}`}
                className="inline-block text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              >
                Log this session →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Link to activity detail if uploaded */}
      {activity && (
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <Link
            href={`/running/${activity.id}`}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            View full activity →
          </Link>
          {planned && (
            <Link
              href={`/marathon/session/${date}`}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Edit session log →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
