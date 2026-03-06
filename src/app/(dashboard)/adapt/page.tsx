// Adaptation Dashboard — active event, check-in, and status

import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, History, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  getActiveAdaptationEvent,
  getCheckinsForEvent,
  getTodayCheckin,
} from '@/lib/supabase/adapt'
import { TriageResult } from '@/components/adapt/TriageResult'
import { RecoveryCheckin } from '@/components/adapt/RecoveryCheckin'

export const metadata: Metadata = {
  title: 'Adapt',
  description: 'Adaptive replanning — manage illness, injury, fatigue, and sleep issues',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDayNumber(reportedAt: string): number {
  const reported = new Date(reportedAt)
  const now = new Date()
  return Math.max(1, Math.floor((now.getTime() - reported.getTime()) / (1000 * 60 * 60 * 24)) + 1)
}

export default async function AdaptPage() {
  const event = await getActiveAdaptationEvent()
  const today = todayStr()

  const [checkins, todayCheckin] = event
    ? await Promise.all([
        getCheckinsForEvent(event.id),
        getTodayCheckin(event.id, today),
      ])
    : [[], null]

  const dayNumber = event ? getDayNumber(event.reported_at) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Adapt</h1>
          <p className="text-sm text-white/40 mt-1">
            Cross-module replanning for illness, injury, fatigue & sleep
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/adapt/history"
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-2 rounded-lg bg-white/5 border border-white/10"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Link>
          {!event && (
            <Link
              href="/adapt/report"
              className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 transition-colors px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20"
            >
              <Plus className="h-3.5 w-3.5" />
              Report issue
            </Link>
          )}
        </div>
      </div>

      {/* No active event */}
      {!event && (
        <div className="rounded-xl border border-white/10 bg-white/3 px-6 py-10 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full border border-green-500/30 bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-400">All systems nominal</p>
            <p className="text-xs text-white/30 mt-1">No active adaptation events</p>
          </div>
          <Link
            href="/adapt/report"
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition-colors px-4 py-2 rounded-lg border border-white/10"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Report an issue
          </Link>
        </div>
      )}

      {/* Active event */}
      {event && (
        <div className="space-y-5">
          {/* Event info */}
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-300">
                {event.trigger_type.charAt(0).toUpperCase() + event.trigger_type.slice(1).replace('_', ' ')} — Severity {event.severity}/5
              </p>
              <p className="text-xs text-amber-400/50 mt-0.5">
                Day {dayNumber}{event.estimated_days ? `/${event.estimated_days}` : ''} · Reported{' '}
                {new Date(event.reported_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <Link
              href={`/adapt/review/${event.id}`}
              className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              View plan changes
            </Link>
          </div>

          {/* AI triage */}
          {event.ai_triage && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                AI Assessment
              </h2>
              <TriageResult event={event} />
            </div>
          )}

          {/* Daily check-in */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Daily Check-in
              </h2>
              {todayCheckin && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Done today
                </span>
              )}
            </div>
            <div className="rounded-lg border border-white/10 bg-white/3 p-4">
              <RecoveryCheckin
                event={event}
                existingCheckin={todayCheckin}
                dayNumber={dayNumber}
                onRecovered={() => {}}
              />
            </div>
          </div>

          {/* Previous check-ins */}
          {checkins.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Check-in history
              </h2>
              <div className="space-y-2">
                {checkins.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="rounded-md border border-white/5 bg-white/3 px-3 py-2 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs text-white/50">{c.checkin_date}</span>
                      {c.notes && (
                        <p className="text-xs text-white/30 mt-0.5">{c.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${
                        c.feeling_score >= 7 ? 'text-green-400' :
                        c.feeling_score >= 4 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {c.feeling_score}/10
                      </span>
                      {c.symptoms_present && (
                        <span className="text-xs text-amber-400/60">symptoms</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
