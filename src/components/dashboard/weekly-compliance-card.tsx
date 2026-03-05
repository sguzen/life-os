// Weekly habit compliance score with trend vs last week

import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface WeeklyComplianceCardProps {
  thisWeek: number   // 0–100
  lastWeek: number   // 0–100
}

export function WeeklyComplianceCard({ thisWeek, lastWeek }: WeeklyComplianceCardProps) {
  const diff = thisWeek - lastWeek
  const hasTrend = lastWeek > 0

  const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
  const trendColor =
    diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : 'text-muted-foreground'

  const barColor =
    thisWeek >= 80 ? 'bg-green-500' : thisWeek >= 50 ? 'bg-indigo-500' : 'bg-amber-500'

  return (
    <Link href="/habits" className="block">
      <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Weekly Compliance
        </p>

        {/* Score */}
        <div className="flex items-end gap-2 mb-3">
          <span className="text-3xl font-bold leading-none">{thisWeek}%</span>
          {hasTrend && (
            <span className={`flex items-center gap-0.5 text-xs font-medium mb-0.5 ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {Math.abs(diff)}pp vs last wk
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${thisWeek}%` }}
          />
        </div>

        {/* Last week comparison */}
        {hasTrend && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last week: {lastWeek}%
          </p>
        )}
      </div>
    </Link>
  )
}
