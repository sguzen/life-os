'use client'

import { Droplets } from 'lucide-react'

interface WaterTrackerProps {
  waterMl: number
  isRunDay?: boolean
  onAdd: (ml: number) => void
  disabled?: boolean
}

export function WaterTracker({ waterMl, isRunDay, onAdd, disabled }: WaterTrackerProps) {
  const target = isRunDay ? 3000 : 2000
  const pct = Math.min(100, Math.round((waterMl / target) * 100))
  const isLow = waterMl < target * 0.5
  const isGood = waterMl >= target * 0.8
  const isMet = waterMl >= target

  const fillColor = isMet
    ? 'bg-emerald-500'
    : isGood
    ? 'bg-blue-400'
    : isLow
    ? 'bg-red-400'
    : 'bg-blue-500'

  const textColor = isMet
    ? 'text-emerald-400'
    : isLow
    ? 'text-red-400'
    : 'text-blue-400'

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className={`h-4 w-4 ${textColor}`} />
          <span className="text-sm font-medium text-white/80">Water</span>
        </div>
        <span className={`text-sm font-semibold ${textColor}`}>
          {(waterMl / 1000).toFixed(1)}L / {(target / 1000).toFixed(0)}L
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fillColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Quick-add buttons */}
      <div className="flex gap-2">
        {[250, 500, 750].map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            disabled={disabled}
            className="flex-1 rounded-lg bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors py-1.5 text-xs text-white/50 hover:text-blue-300 disabled:opacity-40"
          >
            +{ml}ml
          </button>
        ))}
        {waterMl > 0 && (
          <button
            onClick={() => onAdd(-250)}
            disabled={disabled || waterMl < 250}
            className="rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-colors px-2 py-1.5 text-xs text-white/30 hover:text-red-400 disabled:opacity-40"
          >
            -250
          </button>
        )}
      </div>

      {/* Low water warning */}
      {isLow && waterMl > 0 && (
        <p className="text-xs text-red-400 mt-2">
          💧 Under half your target — drink more now
        </p>
      )}
    </div>
  )
}
