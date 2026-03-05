// P4-04: Activity detail page — actual vs prescribed pace + lap splits

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Heart, TrendingUp, Timer, Footprints, Flame, Mountain } from 'lucide-react'
import { getActivityById } from '@/lib/supabase/running'
import { getLapsForActivity } from '@/lib/supabase/running'
import { formatPace, formatDuration, formatDistance, formatPaceDiff, paceDiff } from '@/lib/running/format'
import { LapSplits } from '@/components/running/lap-splits'
import { PaceChart } from '@/components/running/pace-chart'
import { DeleteRunButton } from '@/components/running/delete-run-button'

interface Props {
  params: { id: string }
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: string
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Icon className={`h-3.5 w-3.5 ${accent ?? 'text-white/40'}`} />
        {label}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </div>
  )
}

export default async function ActivityDetailPage({ params }: Props) {
  const [activity, laps] = await Promise.all([
    getActivityById(params.id),
    getLapsForActivity(params.id),
  ])

  if (!activity) notFound()

  const diff = paceDiff(activity.avg_pace_sec_per_km, activity.prescribed_pace_sec_per_km)
  const diffLabel = formatPaceDiff(diff)
  const diffColor = diff == null ? '' : diff > 10 ? 'text-red-400' : diff < -10 ? 'text-blue-400' : 'text-green-400'

  const date = new Date(activity.started_at)
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + Delete */}
      <div className="flex items-center justify-between">
        <Link href="/running" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Running
        </Link>
        <DeleteRunButton id={params.id} />
      </div>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {activity.name ?? formatDistance(activity.distance_meters)}
            </h1>
            <p className="text-sm text-white/40 mt-0.5">{dateStr} · {timeStr}</p>
          </div>
          <span className="rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium px-3 py-1 capitalize whitespace-nowrap">
            {activity.workout_type.replace('_', ' ')}
          </span>
        </div>

        {/* Pace comparison badge */}
        {activity.prescribed_pace_sec_per_km && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-white/40">
              Target: <span className="font-mono text-white/70">{formatPace(activity.prescribed_pace_sec_per_km)}</span>
            </span>
            <span className={`text-xs font-semibold font-mono ${diffColor}`}>{diffLabel}</span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Distance" value={formatDistance(activity.distance_meters)} icon={Footprints} />
        <StatCard label="Duration" value={formatDuration(activity.duration_seconds)} icon={Timer} />
        <StatCard label="Avg Pace" value={formatPace(activity.avg_pace_sec_per_km)} icon={TrendingUp} accent="text-indigo-400" />
        {activity.avg_hr && (
          <StatCard label="Avg HR" value={`${activity.avg_hr} bpm`} sub={activity.max_hr ? `Max ${activity.max_hr} bpm` : undefined} icon={Heart} accent="text-rose-400" />
        )}
        {activity.elevation_gain_m != null && (
          <StatCard label="Elevation Gain" value={`${Math.round(activity.elevation_gain_m)} m`} icon={Mountain} accent="text-emerald-400" />
        )}
        {activity.calories && (
          <StatCard label="Calories" value={`${activity.calories} kcal`} icon={Flame} accent="text-orange-400" />
        )}
      </div>

      {/* Pace chart (visible only when lap data present) */}
      {laps.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Pace per Lap</h2>
          <PaceChart laps={laps} prescribedPaceSecPerKm={activity.prescribed_pace_sec_per_km} />
        </div>
      )}

      {/* Lap splits table */}
      {laps.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Lap Splits</h2>
          <LapSplits laps={laps} prescribedPaceSecPerKm={activity.prescribed_pace_sec_per_km} />
        </div>
      )}

      {/* Notes */}
      {activity.notes && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-white mb-2">Notes</h2>
          <p className="text-sm text-white/60 whitespace-pre-wrap">{activity.notes}</p>
        </div>
      )}
    </div>
  )
}
