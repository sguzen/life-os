'use client'

import { getDurationProgress, getDaysRemaining } from '@/lib/types/supplements'
import type { Supplement } from '@/lib/types/supplements'

interface SupplementProgressProps {
  supplement: Supplement
}

export function SupplementProgress({ supplement }: SupplementProgressProps) {
  if (!supplement.has_duration) return null

  const pct = getDurationProgress(supplement)
  const daysLeft = getDaysRemaining(supplement)

  if (pct === null) return null

  const endDisplay = supplement.end_date
    ? new Date(supplement.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center justify-between text-xs text-white/35">
        <span>
          {supplement.duration_notes ?? `${supplement.duration_days}-day course`}
          {endDisplay && ` · Ends ${endDisplay}`}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500/60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {daysLeft !== null && daysLeft <= 14 && (
        <p className="text-xs text-amber-400">{daysLeft} days remaining</p>
      )}
    </div>
  )
}
