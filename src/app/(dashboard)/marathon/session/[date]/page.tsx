// Session log page — pre-filled with plan, user fills actuals

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSessionForDate as getPlanSession } from '@/lib/marathon/plan'
import { getSessionForDate as getDbSession } from '@/lib/supabase/marathon'
import { SESSION_TYPE_LABELS } from '@/lib/marathon/plan'
import { SessionLogForm } from '@/components/marathon/SessionLogForm'
import { AICoach } from '@/components/marathon/AICoach'

export async function generateMetadata({ params }: { params: { date: string } }): Promise<Metadata> {
  return { title: `Log Session — ${params.date}` }
}

export default async function SessionLogPage({ params }: { params: { date: string } }) {
  const { date } = params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound()

  const planned = getPlanSession(date)
  if (!planned) {
    return (
      <div className="space-y-6">
        <Link href="/marathon" className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to training hub
        </Link>
        <p className="text-white/40">No session planned for {date}.</p>
      </div>
    )
  }

  const existing = await getDbSession(date)

  const sessionData = {
    date,
    type: planned.type,
    description: planned.description,
    plannedKm: planned.plannedKm,
    paceMin: planned.paceMin,
    paceMax: planned.paceMax,
    weekNumber: planned.weekNumber,
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      {/* Back */}
      <Link href="/marathon" className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Training hub
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs text-white/40 uppercase tracking-wider">
          {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}Week {planned.weekNumber}
        </p>
        <h1 className="text-2xl font-bold text-white">{SESSION_TYPE_LABELS[planned.type]}</h1>
        {planned.description && (
          <p className="text-sm text-white/60 leading-relaxed">{planned.description}</p>
        )}
      </div>

      {/* AI pre-session */}
      {!existing && planned.type !== 'REST' && (
        <AICoach
          mode="pre"
          sessionData={sessionData}
          initialPrompt="What should I focus on today?"
        />
      )}

      {/* Log form */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <SessionLogForm
          date={date}
          planned={planned}
          weekNumber={planned.weekNumber}
          existingActual={existing}
        />
      </div>

      {/* AI post-session (if already logged) */}
      {existing && existing.status !== 'pending' && (
        <AICoach
          mode="post"
          sessionData={{
            ...sessionData,
            actualKm: existing.actual_km,
            actualPace: existing.actual_avg_pace,
            actualHr: existing.actual_avg_hr,
            perceivedEffort: existing.perceived_effort,
            wentTooFast: existing.went_too_fast,
            paceDeviationSec: existing.pace_deviation_sec,
            warmupDone: existing.warmup_done,
            skippedWarmup: existing.skipped_warmup,
            notes: existing.notes,
          }}
          initialPrompt="Give me feedback on today's session."
        />
      )}
    </div>
  )
}
