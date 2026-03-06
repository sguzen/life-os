'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { AdaptationEvent } from '@/lib/types'

interface AdaptationBannerProps {
  event: AdaptationEvent
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

function getDayCount(reportedAt: string): number {
  const reported = new Date(reportedAt)
  const now = new Date()
  const diff = now.getTime() - reported.getTime()
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1)
}

export function AdaptationBanner({ event }: AdaptationBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const dayCount = getDayCount(event.reported_at)
  const estimatedDays = event.estimated_days ?? 3
  const triggerLabel = TRIGGER_LABELS[event.trigger_type] ?? event.trigger_type
  const severityLabel = SEVERITY_LABELS[event.severity] ?? ''

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-300">
              ADAPTATION ACTIVE — {severityLabel} {triggerLabel}{' '}
              <span className="font-normal text-amber-400/70">
                (Day {dayCount}/{estimatedDays})
              </span>
            </p>
            <p className="text-xs text-amber-400/60">
              Plan modified through {formatEndDate(event.reported_at, estimatedDays)}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Link
                href={`/adapt/review/${event.id}`}
                className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
              >
                View Changes
              </Link>
              <Link
                href="/adapt"
                className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
              >
                Daily Check-in →
              </Link>
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400/50 hover:text-amber-400 transition-colors shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function formatEndDate(reportedAt: string, estimatedDays: number): string {
  const d = new Date(reportedAt)
  d.setDate(d.getDate() + estimatedDays - 1)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
