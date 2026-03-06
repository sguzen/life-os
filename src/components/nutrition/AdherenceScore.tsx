'use client'

interface AdherenceScoreProps {
  score: number
  compact?: boolean
}

export function AdherenceScore({ score, compact }: AdherenceScoreProps) {
  const color =
    score >= 80
      ? 'text-emerald-400'
      : score >= 60
      ? 'text-yellow-400'
      : score >= 40
      ? 'text-orange-400'
      : 'text-red-400'

  const bgColor =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 60
      ? 'bg-yellow-500'
      : score >= 40
      ? 'bg-orange-500'
      : 'bg-red-500'

  const label =
    score >= 80
      ? 'Great'
      : score >= 60
      ? 'OK'
      : score >= 40
      ? 'Needs work'
      : 'Poor'

  if (compact) {
    return (
      <span className={`text-sm font-semibold ${color}`}>
        {score}%
      </span>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white/60">Adherence Score</span>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${color}`}>{score}%</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${color} border border-current opacity-60`}>
            {label}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bgColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-white/25 mt-1">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  )
}
