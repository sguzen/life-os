'use client'

// P4-08: Lap splits table with pace comparison

import { formatPace, formatDuration, formatDistance, paceDiff, formatPaceDiff } from '@/lib/running/format'
import type { RunningLap } from '@/lib/types/running'

interface LapSplitsProps {
  laps: RunningLap[]
  prescribedPaceSecPerKm?: number | null
}

export function LapSplits({ laps, prescribedPaceSecPerKm }: LapSplitsProps) {
  if (laps.length === 0) {
    return <p className="text-sm text-white/40">No lap data available.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-white/40 border-b border-white/10">
            <th className="text-left py-2 pr-4 font-medium">Lap</th>
            <th className="text-right py-2 px-4 font-medium">Distance</th>
            <th className="text-right py-2 px-4 font-medium">Time</th>
            <th className="text-right py-2 px-4 font-medium">Pace</th>
            {prescribedPaceSecPerKm && (
              <th className="text-right py-2 px-4 font-medium">vs Target</th>
            )}
            <th className="text-right py-2 px-4 font-medium">Avg HR</th>
            <th className="text-right py-2 pl-4 font-medium">Cadence</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap) => {
            const diff = paceDiff(lap.avg_pace_sec_per_km, prescribedPaceSecPerKm ?? null)
            const diffLabel = formatPaceDiff(diff)
            const diffColor =
              diff == null ? 'text-white/30'
              : diff > 10 ? 'text-red-400'
              : diff < -10 ? 'text-blue-400'
              : 'text-green-400'

            return (
              <tr key={lap.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-2.5 pr-4 font-medium text-white/80">{lap.lap_number}</td>
                <td className="py-2.5 px-4 text-right text-white/70">{formatDistance(lap.distance_meters)}</td>
                <td className="py-2.5 px-4 text-right text-white/70">{formatDuration(lap.duration_seconds)}</td>
                <td className="py-2.5 px-4 text-right font-mono text-white">{formatPace(lap.avg_pace_sec_per_km)}</td>
                {prescribedPaceSecPerKm && (
                  <td className={`py-2.5 px-4 text-right font-mono text-xs ${diffColor}`}>{diffLabel}</td>
                )}
                <td className="py-2.5 px-4 text-right text-white/70">
                  {lap.avg_hr ? `${lap.avg_hr} bpm` : '—'}
                </td>
                <td className="py-2.5 pl-4 text-right text-white/70">
                  {lap.avg_cadence ? `${Math.round(lap.avg_cadence)} spm` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
