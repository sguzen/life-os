// Today's habit completion ring — X of Y habits done

import Link from 'next/link'

interface HabitsRingCardProps {
  completed: number
  total: number
}

export function HabitsRingCard({ completed, total }: HabitsRingCardProps) {
  const radius = 38
  const stroke = 8
  const normalised = radius - stroke / 2
  const circumference = 2 * Math.PI * normalised
  const pct = total > 0 ? completed / total : 0
  const dashOffset = circumference * (1 - pct)
  const allDone = total > 0 && completed === total

  const ringColor = allDone
    ? '#22c55e'
    : pct >= 0.5
    ? '#6366f1'
    : '#f59e0b'

  return (
    <Link href="/habits" className="block">
      <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Today&apos;s Habits
        </p>

        <div className="flex items-center gap-5">
          {/* SVG ring */}
          <div className="relative shrink-0">
            <svg width={radius * 2} height={radius * 2} className="-rotate-90">
              {/* Track */}
              <circle
                cx={radius}
                cy={radius}
                r={normalised}
                fill="none"
                stroke="currentColor"
                strokeWidth={stroke}
                className="text-muted/30"
              />
              {/* Progress */}
              <circle
                cx={radius}
                cy={radius}
                r={normalised}
                fill="none"
                stroke={ringColor}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            {/* Center label */}
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {total > 0 ? `${Math.round(pct * 100)}%` : '—'}
            </span>
          </div>

          {/* Text */}
          <div>
            <p className="text-2xl font-bold leading-none">
              {completed}
              <span className="text-base font-normal text-muted-foreground">
                /{total}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {allDone
                ? 'All done — perfect day!'
                : total === 0
                ? 'No habits set up'
                : `${total - completed} remaining`}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
