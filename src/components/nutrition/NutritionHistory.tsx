'use client'

import Link from 'next/link'

interface HistoryEntry {
  log_date: string
  adherence_score: number | null
  alcohol_consumed: boolean
}

interface NutritionHistoryProps {
  history: HistoryEntry[]
}

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-white/8'
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function scoreOpacity(score: number | null): string {
  if (score === null) return 'opacity-30'
  if (score >= 80) return 'opacity-80'
  if (score >= 60) return 'opacity-70'
  if (score >= 40) return 'opacity-60'
  return 'opacity-50'
}

export function NutritionHistory({ history }: NutritionHistoryProps) {
  const historyByDate = new Map(history.map((h) => [h.log_date, h]))

  // Build last 90 days grid
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days: Array<{ date: string; entry: HistoryEntry | undefined }> = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    days.push({ date: dateStr, entry: historyByDate.get(dateStr) })
  }

  // Group into weeks (7-day rows)
  const weeks: typeof days[] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  // Weekly summary stats
  const weeklyStats = weeks.map((week) => {
    const logged = week.filter((d) => d.entry)
    const avgScore =
      logged.length > 0
        ? Math.round(logged.reduce((s, d) => s + (d.entry?.adherence_score ?? 0), 0) / logged.length)
        : null
    const alcoholDays = week.filter((d) => d.entry?.alcohol_consumed).length
    return { avgScore, alcoholDays, loggedDays: logged.length }
  })

  // Overall stats
  const loggedDays = history.length
  const avgAdherence =
    loggedDays > 0
      ? Math.round(history.reduce((s, h) => s + (h.adherence_score ?? 0), 0) / loggedDays)
      : 0
  const alcoholDaysTotal = history.filter((h) => h.alcohol_consumed).length
  const highAdherenceDays = history.filter((h) => (h.adherence_score ?? 0) >= 80).length

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-2xl font-bold text-white">{loggedDays}</p>
          <p className="text-xs text-white/40 mt-0.5">days logged</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className={`text-2xl font-bold ${avgAdherence >= 70 ? 'text-emerald-400' : avgAdherence >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {avgAdherence}%
          </p>
          <p className="text-xs text-white/40 mt-0.5">avg adherence</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{highAdherenceDays}</p>
          <p className="text-xs text-white/40 mt-0.5">days ≥ 80%</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className={`text-2xl font-bold ${alcoholDaysTotal === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {alcoholDaysTotal}
          </p>
          <p className="text-xs text-white/40 mt-0.5">alcohol days</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-white/30">
        <span>Less</span>
        {[null, 39, 59, 79, 100].map((v, i) => (
          <div
            key={i}
            className={`h-3 w-3 rounded-sm ${scoreColor(v ? v : null)} ${scoreOpacity(v ? v : null)}`}
            title={v === null ? 'No log' : `≥${i === 1 ? 0 : [0, 40, 60, 80, 81][i]}%`}
          />
        ))}
        <span>More</span>
        <div className="ml-2 flex items-center gap-1">
          <span className="text-red-400">·</span>
          <span>alcohol</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="rounded-xl border border-white/10 bg-white/3 p-4 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-1 mr-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="h-6 flex items-center text-xs text-white/20 w-7">
                {d}
              </div>
            ))}
          </div>

          {/* Week columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map(({ date, entry }) => {
                const score = entry?.adherence_score ?? null
                const hasAlcohol = entry?.alcohol_consumed ?? false
                const isToday = date === today.toISOString().slice(0, 10)

                return (
                  <Link
                    key={date}
                    href={`/nutrition/log/${date}`}
                    title={`${date}: ${score !== null ? score + '%' : 'no log'}${hasAlcohol ? ' 🍷' : ''}`}
                  >
                    <div
                      className={`h-6 w-6 rounded-sm transition-all hover:ring-1 hover:ring-white/30 ${
                        scoreColor(score)
                      } ${scoreOpacity(score)} relative ${isToday ? 'ring-1 ring-white/50' : ''}`}
                    >
                      {hasAlcohol && (
                        <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-400" />
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Weekly summary rows */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Weekly Breakdown</p>
        <div className="space-y-1.5">
          {[...weeklyStats].reverse().map((week, i) => {
            const weekDays = [...weeks].reverse()[i]
            const startDate = weekDays[0]?.date
            const endDate = weekDays[weekDays.length - 1]?.date
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg bg-white/3 border border-white/8 px-3 py-2"
              >
                <span className="text-xs text-white/30 w-28 shrink-0">
                  {startDate && new Date(startDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {' — '}
                  {endDate && new Date(endDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>

                <div className="flex-1 flex items-center gap-4 text-xs">
                  <span className={week.avgScore === null ? 'text-white/20' : week.avgScore >= 70 ? 'text-emerald-400' : week.avgScore >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {week.avgScore !== null ? week.avgScore + '% avg' : 'not logged'}
                  </span>
                  <span className="text-white/30">{week.loggedDays}/7 days logged</span>
                  {week.alcoholDays > 0 && (
                    <span className="text-red-400">🍷 ×{week.alcoholDays}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
