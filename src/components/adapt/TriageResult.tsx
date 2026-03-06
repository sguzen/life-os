'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { AdaptationEvent } from '@/lib/types'

interface TriageResultProps {
  event: AdaptationEvent
}

function parseSeverity(triage: string): number {
  const match = triage.match(/SEVERITY_VERDICT:\s*(\d)/i)
  return match ? parseInt(match[1]) : 3
}

function getSeverityColor(severity: number): string {
  if (severity <= 2) return 'green'
  if (severity === 3) return 'amber'
  return 'red'
}

function formatTriageSection(triage: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const keys = [
    'SEVERITY_VERDICT',
    'TRAINING_TODAY',
    'TRAINING_THIS_WEEK',
    'RISK_ASSESSMENT',
    'NUTRITION_IMPACT',
    'TRADING_IMPACT',
    'RECOVERY_TIMELINE',
    'SUMMARY',
  ]

  for (const key of keys) {
    const regex = new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 's')
    const match = triage.match(regex)
    if (match) sections[key] = match[1].trim()
  }

  return sections
}

const SECTION_LABELS: Record<string, string> = {
  TRAINING_TODAY: 'Training Today',
  TRAINING_THIS_WEEK: 'This Week',
  RISK_ASSESSMENT: 'Risk',
  NUTRITION_IMPACT: 'Nutrition',
  TRADING_IMPACT: 'Trading',
  RECOVERY_TIMELINE: 'Recovery',
  SUMMARY: 'Summary',
}

export function TriageResult({ event }: TriageResultProps) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const triage = event.ai_triage ?? ''
  const severity = parseSeverity(triage)
  const color = getSeverityColor(severity)
  const sections = formatTriageSection(triage)

  const colorClasses = {
    green: {
      border: 'border-green-500/30',
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      badge: 'bg-green-500/20 text-green-300',
      dot: 'bg-green-400',
    },
    amber: {
      border: 'border-amber-400/30',
      bg: 'bg-amber-400/10',
      text: 'text-amber-400',
      badge: 'bg-amber-400/20 text-amber-300',
      dot: 'bg-amber-400',
    },
    red: {
      border: 'border-red-500/30',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      badge: 'bg-red-500/20 text-red-300',
      dot: 'bg-red-400',
    },
  }[color]

  async function generateAdjustments() {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/adaptation-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          triggerData: {
            trigger_type: event.trigger_type,
            severity: event.severity,
            symptoms: event.symptoms,
            affected_body_part: event.affected_body_part,
            sleep_hours: event.sleep_hours,
            resting_hr: event.resting_hr,
            estimated_days: event.estimated_days,
          },
          triageResult: triage,
        }),
      })
      if (!res.ok) throw new Error('Failed to generate adjustments')
      router.push(`/adapt/review/${event.id}`)
    } catch {
      setGenerating(false)
    }
  }

  return (
    <div className={`rounded-xl border ${colorClasses.border} ${colorClasses.bg} p-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${colorClasses.dot}`} />
          <span className={`text-sm font-bold ${colorClasses.text}`}>
            SEVERITY {severity}/5 — {sections['SEVERITY_VERDICT'] ?? ''}
          </span>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Sections grid */}
          <div className="space-y-3">
            {Object.entries(SECTION_LABELS).map(([key, label]) => {
              if (!sections[key]) return null
              return (
                <div key={key}>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-0.5">
                    {label}
                  </p>
                  <p className="text-sm text-white/80 leading-relaxed">{sections[key]}</p>
                </div>
              )
            })}
          </div>

          {/* CTA */}
          {event.status === 'adjustments_proposed' || event.status === 'approved' ? (
            <button
              onClick={() => router.push(`/adapt/review/${event.id}`)}
              className="w-full rounded-lg bg-amber-500/20 border border-amber-400/30 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Review Week Adjustments →
            </button>
          ) : (
            <button
              onClick={generateAdjustments}
              disabled={generating}
              className="w-full rounded-lg bg-amber-500/20 border border-amber-400/30 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generating adjustments...' : 'Generate Week Adjustments →'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
