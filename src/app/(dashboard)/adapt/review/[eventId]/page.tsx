// Review and approve/reject proposed adaptations

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import {
  getAdaptationEvent,
  getAdjustmentsForEvent,
} from '@/lib/supabase/adapt'
import { AdjustmentReviewPanel } from '@/components/adapt/AdjustmentReviewPanel'
import { TriageResult } from '@/components/adapt/TriageResult'

export const metadata: Metadata = {
  title: 'Review Adaptations',
}

interface Props {
  params: { eventId: string }
}

const TRIGGER_LABELS: Record<string, string> = {
  illness: 'Illness',
  injury: 'Injury',
  fatigue: 'Fatigue',
  poor_sleep: 'Poor Sleep',
}

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Mild',
  2: 'Moderate-Mild',
  3: 'Moderate',
  4: 'Significant',
  5: 'Severe',
}

function getWeekRange(date: string): string {
  const d = new Date(date + 'T12:00:00')
  // Find Monday
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  // Find Sunday
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (dt: Date) =>
    dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return `${fmt(monday)} – ${fmt(sunday)}`
}

export default async function ReviewPage({ params }: Props) {
  const { eventId } = params

  const [event, adjustments] = await Promise.all([
    getAdaptationEvent(eventId),
    getAdjustmentsForEvent(eventId),
  ])

  if (!event) notFound()

  const triggerLabel = TRIGGER_LABELS[event.trigger_type] ?? event.trigger_type
  const severityLabel = SEVERITY_LABELS[event.severity] ?? `Severity ${event.severity}`
  const weekRange = getWeekRange(event.event_date)

  // Extract summary from the first nutrition adjustment or a marker in triage
  const hasAdjustments = adjustments.length > 0
  const isApproved = event.status === 'approved'

  return (
    <div className="space-y-6">
      {/* Nav */}
      <Link
        href="/adapt"
        className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Adapt
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-4 space-y-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold text-amber-300 uppercase tracking-wide">
            Adaptation Proposal
          </span>
          {isApproved && (
            <span className="text-xs font-medium text-green-400 ml-auto">Applied</span>
          )}
        </div>
        <p className="text-base font-semibold text-white">
          {severityLabel} {triggerLabel} — {weekRange}
        </p>
        <p className="text-xs text-white/40">
          Reported {new Date(event.reported_at).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Triage (if available) */}
      {event.ai_triage && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            AI Assessment
          </h2>
          <TriageResult event={event} />
        </div>
      )}

      {/* No adjustments yet — trigger generation */}
      {!hasAdjustments && event.status === 'pending' && (
        <div className="rounded-lg border border-white/10 bg-white/3 px-4 py-8 text-center space-y-3">
          <p className="text-sm text-white/50">
            No adjustments generated yet.
          </p>
          <p className="text-xs text-white/30">
            Complete the AI assessment above then tap "Generate Week Adjustments."
          </p>
        </div>
      )}

      {/* Adjustment review panel */}
      {hasAdjustments && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Proposed Changes
          </h2>
          <AdjustmentReviewPanel
            event={event}
            adjustments={adjustments}
          />
        </div>
      )}
    </div>
  )
}
