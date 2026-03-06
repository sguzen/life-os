import Link from 'next/link'
import { Clock, ChevronRight } from 'lucide-react'
import type { AdaptationEvent, AdaptationAdjustment } from '@/lib/types'

interface AdaptationHistoryProps {
  events: AdaptationEvent[]
  adjustmentsByEvent: Record<string, AdaptationAdjustment[]>
}

const TRIGGER_LABELS: Record<string, string> = {
  illness: 'Illness',
  injury: 'Injury',
  fatigue: 'Fatigue',
  poor_sleep: 'Poor Sleep',
}

const TRIGGER_EMOJI: Record<string, string> = {
  illness: '🤒',
  injury: '🦵',
  fatigue: '😴',
  poor_sleep: '💤',
}

const STATUS_STYLES: Record<string, string> = {
  recovered: 'text-green-400',
  approved: 'text-amber-400',
  rejected: 'text-white/30',
  pending: 'text-blue-400',
  adjustments_proposed: 'text-amber-400',
}

function getRecoveryDays(event: AdaptationEvent): number | null {
  if (!event.recovery_confirmed_at) return null
  const reported = new Date(event.reported_at)
  const recovered = new Date(event.recovery_confirmed_at)
  const diff = recovered.getTime() - reported.getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function getTrainingLost(adjustments: AdaptationAdjustment[]): number {
  return adjustments
    .filter((a) => a.module === 'marathon' && a.approved === true)
    .reduce((sum, a) => {
      const orig = (a.original_value as Record<string, unknown> | null)?.km as number ?? 0
      const adj = (a.adjusted_value as Record<string, unknown> | null)?.adjusted_km as number ?? 0
      return sum + Math.max(0, orig - adj)
    }, 0)
}

export function AdaptationHistory({ events, adjustmentsByEvent }: AdaptationHistoryProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/3 px-4 py-8 text-center">
        <p className="text-white/30 text-sm">No adaptation events yet.</p>
        <p className="text-white/20 text-xs mt-1">
          When you report an issue and adjust your plan, it'll appear here.
        </p>
      </div>
    )
  }

  // Stats
  const totalDays = events.reduce((sum, e) => {
    const days = getRecoveryDays(e)
    return sum + (days ?? e.estimated_days ?? 0)
  }, 0)

  const totalKmLost = events.reduce((sum, e) => {
    const adjs = adjustmentsByEvent[e.id] ?? []
    return sum + getTrainingLost(adjs)
  }, 0)

  const avgRecovery = events
    .filter((e) => e.recovery_confirmed_at)
    .reduce((acc, e, _, arr) => {
      return acc + (getRecoveryDays(e) ?? 0) / arr.length
    }, 0)

  return (
    <div className="space-y-6">
      {/* Stats panel */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-xl font-bold font-mono text-white">{totalDays}</p>
          <p className="text-xs text-white/40 mt-0.5">Adaptation days</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-xl font-bold font-mono text-orange-400">{totalKmLost.toFixed(0)}km</p>
          <p className="text-xs text-white/40 mt-0.5">Training modified</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-xl font-bold font-mono text-white">
            {avgRecovery > 0 ? `${avgRecovery.toFixed(1)}d` : '—'}
          </p>
          <p className="text-xs text-white/40 mt-0.5">Avg recovery</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {events.map((event) => {
          const adjs = adjustmentsByEvent[event.id] ?? []
          const recoveryDays = getRecoveryDays(event)
          const kmLost = getTrainingLost(adjs)
          const marathonChanges = adjs.filter((a) => a.module === 'marathon' && a.approved === true)
          const statusColor = STATUS_STYLES[event.status] ?? 'text-white/40'
          const eventDate = new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })

          return (
            <div
              key={event.id}
              className="rounded-lg border border-white/10 bg-white/3 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TRIGGER_EMOJI[event.trigger_type] ?? '⚠️'}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {TRIGGER_LABELS[event.trigger_type]} — Severity {event.severity}/5
                    </p>
                    <p className="text-xs text-white/30">{eventDate}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium ${statusColor}`}>
                  {event.status === 'recovered' ? 'Recovered' :
                   event.status === 'approved' ? 'Active' :
                   event.status === 'rejected' ? 'Rejected' :
                   'Pending'}
                </span>
              </div>

              {/* Summary */}
              {marathonChanges.length > 0 && (
                <p className="text-xs text-white/40">
                  Modified {marathonChanges.length} session{marathonChanges.length !== 1 ? 's' : ''} ·{' '}
                  {kmLost > 0 ? `~${kmLost.toFixed(0)}km adjusted` : 'volume maintained'}
                </p>
              )}

              {recoveryDays && (
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <Clock className="h-3 w-3" />
                  Recovered in {recoveryDays} day{recoveryDays !== 1 ? 's' : ''}
                </div>
              )}

              <Link
                href={`/adapt/review/${event.id}`}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors mt-1"
              >
                View details <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
