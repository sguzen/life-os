// Top 3 habit streaks

import Link from 'next/link'
import { Flame } from 'lucide-react'

export interface StreakItem {
  name: string
  streak: number
  color: string
  logged_today: boolean
}

interface HabitStreaksCardProps {
  streaks: StreakItem[]
}

export function HabitStreaksCard({ streaks }: HabitStreaksCardProps) {
  return (
    <Link href="/habits" className="block">
      <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Top Streaks
        </p>

        {streaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active streaks yet.</p>
        ) : (
          <ol className="space-y-3">
            {streaks.map((item, i) => (
              <li key={item.name} className="flex items-center gap-3">
                <span className="text-xs w-4 text-muted-foreground font-mono">
                  {i + 1}.
                </span>
                {/* Color dot */}
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <Flame
                    className="h-3.5 w-3.5"
                    style={{ color: item.streak > 0 ? '#f97316' : undefined }}
                  />
                  <span className="text-sm font-semibold tabular-nums">
                    {item.streak}
                    <span className="text-xs font-normal text-muted-foreground ml-0.5">d</span>
                  </span>
                </span>
                {item.logged_today && (
                  <span className="text-[10px] font-medium text-green-500 bg-green-500/10 rounded px-1">
                    ✓
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Link>
  )
}
