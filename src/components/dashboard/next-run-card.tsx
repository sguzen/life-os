// Next run: upcoming race target + last activity

import Link from 'next/link'
import { Footprints, CalendarDays } from 'lucide-react'

export interface NextRunData {
  nextRace: {
    race_name: string
    race_date: string
    distance_km: number
    target_time_seconds: number
    days_until: number
  } | null
  lastRun: {
    workout_type: string
    distance_meters: number
    started_at: string
  } | null
}

function fmtPace(sec: number, distKm: number) {
  if (!distKm) return '—'
  const secPerKm = sec / distKm
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtWorkout(type: string) {
  return type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function NextRunCard({ data }: { data: NextRunData }) {
  const { nextRace, lastRun } = data

  return (
    <Link href="/running" className="block">
      <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Next Race
        </p>

        {nextRace ? (
          <div className="space-y-3">
            <div>
              <p className="font-semibold leading-tight">{nextRace.race_name}</p>
              <p className="text-sm text-muted-foreground">
                {nextRace.distance_km} km · target {fmtTime(nextRace.target_time_seconds)} ({fmtPace(nextRace.target_time_seconds, nextRace.distance_km)})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">
                {new Date(nextRace.race_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="ml-auto text-sm font-semibold text-indigo-500">
                {nextRace.days_until === 0
                  ? 'Today!'
                  : nextRace.days_until === 1
                  ? 'Tomorrow!'
                  : `${nextRace.days_until} days`}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming races.</p>
        )}

        {/* Last run */}
        {lastRun && (
          <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <Footprints className="h-3.5 w-3.5 shrink-0" />
            <span>
              Last: {fmtWorkout(lastRun.workout_type)},{' '}
              {(lastRun.distance_meters / 1000).toFixed(1)} km ·{' '}
              {new Date(lastRun.started_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
