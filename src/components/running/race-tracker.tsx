'use client'

// P4-06: Race tracker — upcoming and completed races
// Seeded with: Belgrade April 19 (42.2 km, 3:32:00 target) and Limassol March 22 (21.1 km, 1:44:30 target)

import { Flag, Plus, CheckCircle2, Clock, MapPin } from 'lucide-react'
import { formatPace, formatDuration, daysUntil } from '@/lib/running/format'
import type { RaceTarget } from '@/lib/types/running'

interface RaceTrackerProps {
  races: RaceTarget[]
  onAddRace?: () => void
}


function RaceCard({ race }: { race: RaceTarget }) {
  const days = daysUntil(race.race_date)
  const isCompleted = race.actual_time_seconds != null
  const isPast = days < 0

  const targetPace = race.target_pace_sec_per_km
  const actualPace = race.actual_time_seconds
    ? Math.round(race.actual_time_seconds / race.distance_km)
    : null

  const timeDiff = race.actual_time_seconds
    ? race.actual_time_seconds - race.target_time_seconds
    : null

  const raceDateFormatted = new Date(race.race_date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className={`
      rounded-xl border p-5 space-y-3 transition-all
      ${isCompleted ? 'border-green-500/30 bg-green-500/5' : isPast ? 'border-white/10 bg-white/5 opacity-60' : 'border-indigo-500/30 bg-indigo-500/5'}
    `}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-base truncate">{race.race_name}</h3>
            {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />{raceDateFormatted}
            </span>
            {race.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{race.location}
              </span>
            )}
          </div>
        </div>

        {/* Countdown / result badge */}
        <div className={`
          shrink-0 rounded-lg px-3 py-1.5 text-center min-w-[64px]
          ${isCompleted ? 'bg-green-500/20 text-green-300' : isPast ? 'bg-white/10 text-white/40' : 'bg-indigo-500/20 text-indigo-300'}
        `}>
          {isCompleted ? (
            <span className="text-xs font-semibold">Done</span>
          ) : isPast ? (
            <span className="text-xs">Elapsed</span>
          ) : (
            <>
              <p className="text-xl font-bold leading-none">{days}</p>
              <p className="text-[10px] mt-0.5 opacity-70">days</p>
            </>
          )}
        </div>
      </div>

      {/* Distance + targets */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-white/40 mb-0.5">Distance</p>
          <p className="font-medium text-white">{race.distance_km} km</p>
        </div>
        <div>
          <p className="text-white/40 mb-0.5">Target time</p>
          <p className="font-medium text-white font-mono">{formatDuration(race.target_time_seconds)}</p>
        </div>
        <div>
          <p className="text-white/40 mb-0.5">Target pace</p>
          <p className="font-medium text-white font-mono">{formatPace(targetPace)}</p>
        </div>
      </div>

      {/* Actual result (if completed) */}
      {isCompleted && race.actual_time_seconds && (
        <div className="border-t border-white/10 pt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-white/40 mb-0.5">Actual time</p>
            <p className="font-medium text-white font-mono">{formatDuration(race.actual_time_seconds)}</p>
          </div>
          <div>
            <p className="text-white/40 mb-0.5">Actual pace</p>
            <p className="font-medium text-white font-mono">{formatPace(actualPace)}</p>
          </div>
          {timeDiff != null && (
            <div>
              <p className="text-white/40 mb-0.5">vs target</p>
              <p className={`font-semibold font-mono ${timeDiff <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {timeDiff <= 0 ? '-' : '+'}{formatDuration(Math.abs(timeDiff))}
              </p>
            </div>
          )}
        </div>
      )}

      {race.notes && (
        <p className="text-xs text-white/40 italic">{race.notes}</p>
      )}
    </div>
  )
}

export function RaceTracker({ races, onAddRace }: RaceTrackerProps) {
  const upcoming = races.filter((r) => !r.actual_time_seconds && daysUntil(r.race_date) >= 0)
  const completed = races.filter((r) => r.actual_time_seconds || daysUntil(r.race_date) < 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Race Tracker</h2>
        </div>
        {onAddRace && (
          <button
            onClick={onAddRace}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add race
          </button>
        )}
      </div>

      {races.length === 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center">
          <Flag className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">No races yet</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-white/30 uppercase tracking-wider">Upcoming</p>
          {upcoming.map((r) => <RaceCard key={r.id} race={r} />)}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-white/30 uppercase tracking-wider">Completed</p>
          {completed.map((r) => <RaceCard key={r.id} race={r} />)}
        </div>
      )}
    </div>
  )
}
