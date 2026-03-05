// P4-07: Running dashboard — overview page

import { Suspense } from 'react'
import { Upload } from 'lucide-react'
import { getActivities, getRestingHrLogs, getRaceTargets } from '@/lib/supabase/running'
import { ActivityList } from '@/components/running/activity-list'
import { RaceTracker } from '@/components/running/race-tracker'
import { RestingHrChart } from '@/components/running/resting-hr-chart'
import { FitUpload } from '@/components/running/fit-upload'
import { LogRestingHrForm } from '@/components/running/log-resting-hr-form'
import { formatDistance, formatDuration, formatPace } from '@/lib/running/format'

// ── Summary stats (last 7 days) ───────────────────────────────

function weekStats(activities: Awaited<ReturnType<typeof getActivities>>) {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const week = activities.filter((a) => new Date(a.started_at) >= since)
  const totalM = week.reduce((s, a) => s + a.distance_meters, 0)
  const totalSec = week.reduce((s, a) => s + a.duration_seconds, 0)
  const avgPaces = week.map((a) => a.avg_pace_sec_per_km).filter(Boolean) as number[]
  const avgPace = avgPaces.length ? avgPaces.reduce((s, p) => s + p, 0) / avgPaces.length : null
  return { runs: week.length, totalM, totalSec, avgPace }
}

export default async function RunningPage() {
  const [activities, hrLogs, races] = await Promise.all([
    getActivities(30),
    getRestingHrLogs(30),
    getRaceTargets(),
  ])

  const stats = weekStats(activities)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Running</h1>
        <p className="text-sm text-white/40 mt-1">Garmin activity log &amp; race performance</p>
      </div>

      {/* This week stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Runs this week', value: String(stats.runs) },
          { label: 'Weekly distance', value: formatDistance(stats.totalM) },
          { label: 'Weekly time', value: formatDuration(stats.totalSec) },
          { label: 'Avg pace', value: formatPace(stats.avgPace) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs text-white/40">{s.label}</p>
            <p className="text-xl font-bold text-white mt-1 font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main content: 2-col on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: activity log + upload */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload */}
          <details className="group rounded-xl bg-white/5 border border-white/10">
            <summary className="flex items-center gap-2 px-5 py-4 cursor-pointer list-none select-none">
              <Upload className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">Upload .fit file</span>
              <span className="ml-auto text-xs text-white/30 group-open:hidden">expand</span>
            </summary>
            <div className="px-5 pb-5">
              <FitUpload />
            </div>
          </details>

          {/* Activity list */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Recent Activities</h2>
            <Suspense fallback={<p className="text-sm text-white/30">Loading…</p>}>
              <ActivityList activities={activities} />
            </Suspense>
          </div>
        </div>

        {/* Right: race tracker + resting HR */}
        <div className="space-y-6">
          {/* Race tracker */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <RaceTracker races={races} />
          </div>

          {/* Resting HR */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-white">Resting Heart Rate</h2>
            <RestingHrChart logs={hrLogs} />
            <div className="border-t border-white/10 pt-4">
              <LogRestingHrForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
