'use client'

import { daysUntil, RACE_DATE, LIMASSOL_DATE } from '@/lib/marathon/plan'

interface RaceCountdownProps {
  currentWeek: number
}

export function RaceCountdown({ currentWeek }: RaceCountdownProps) {
  const daysToBelgrade = daysUntil(RACE_DATE)
  const daysToLimassol = daysUntil(LIMASSOL_DATE)
  const weekProgress = Math.round((currentWeek / 9) * 100)

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
      {/* Belgrade */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider">Belgrade Marathon</p>
          <p className="text-lg font-bold text-white mt-0.5">Apr 19 · Target 3:32:00</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold text-white">{daysToBelgrade}</p>
          <p className="text-xs text-white/40">days to go</p>
        </div>
      </div>

      {/* Week progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-white/40">
          <span>Week {currentWeek} of 9</span>
          <span>{weekProgress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{ width: `${weekProgress}%` }}
          />
        </div>
      </div>

      {/* Limassol */}
      {daysToLimassol > 0 && (
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider">Limassol Half</p>
            <p className="text-sm font-medium text-white/70">Mar 22 · Target 1:44-1:45</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-mono font-bold text-yellow-400">{daysToLimassol}</p>
            <p className="text-xs text-white/40">days</p>
          </div>
        </div>
      )}
    </div>
  )
}
