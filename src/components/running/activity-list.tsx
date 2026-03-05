'use client'

// Activity list for the running dashboard

import Link from 'next/link'
import { ChevronRight, TrendingUp, Heart, Timer, Footprints } from 'lucide-react'
import { formatPace, formatDuration, formatDistance, formatPaceDiff, paceDiff } from '@/lib/running/format'
import type { RunningActivity } from '@/lib/types/running'

const WORKOUT_COLORS: Record<string, string> = {
  easy:      'bg-blue-500/20 text-blue-300',
  long_run:  'bg-indigo-500/20 text-indigo-300',
  tempo:     'bg-amber-500/20 text-amber-300',
  threshold: 'bg-orange-500/20 text-orange-300',
  interval:  'bg-red-500/20 text-red-300',
  recovery:  'bg-green-500/20 text-green-300',
  race:      'bg-purple-500/20 text-purple-300',
  other:     'bg-white/10 text-white/50',
}

export function ActivityList({ activities }: { activities: RunningActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center">
        <Footprints className="h-8 w-8 text-white/20 mx-auto mb-2" />
        <p className="text-sm text-white/40">No activities yet — upload your first .fit file</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {activities.map((act) => {
        const diff = paceDiff(act.avg_pace_sec_per_km, act.prescribed_pace_sec_per_km)
        const diffLabel = act.prescribed_pace_sec_per_km ? formatPaceDiff(diff) : null
        const diffColor = diff == null ? '' : diff > 10 ? 'text-red-400' : diff < -10 ? 'text-blue-400' : 'text-green-400'
        const dateStr = new Date(act.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

        return (
          <li key={act.id}>
            <Link
              href={`/running/${act.id}`}
              className="flex items-center gap-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white text-sm truncate">
                    {act.name ?? formatDistance(act.distance_meters)}
                  </span>
                  <span className={`rounded-full text-[10px] font-medium px-2 py-0.5 ${WORKOUT_COLORS[act.workout_type]}`}>
                    {act.workout_type.replace('_', ' ')}
                  </span>
                  {diffLabel && (
                    <span className={`text-[10px] font-mono ${diffColor}`}>{diffLabel}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
                  <span>{dateStr}</span>
                  <span className="flex items-center gap-1"><Footprints className="h-3 w-3" />{formatDistance(act.distance_meters)}</span>
                  <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{formatDuration(act.duration_seconds)}</span>
                  <span className="flex items-center gap-1 font-mono"><TrendingUp className="h-3 w-3" />{formatPace(act.avg_pace_sec_per_km)}</span>
                  {act.avg_hr && <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-rose-400" />{act.avg_hr} bpm</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
