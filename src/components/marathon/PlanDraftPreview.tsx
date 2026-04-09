'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { saveMarathonPlan } from '@/app/actions/marathon'
import type { MarathonSession } from '@/app/actions/marathon'

interface PlanDraftPreviewProps {
  draftedSessions: MarathonSession[]
}

export function PlanDraftPreview({ draftedSessions }: PlanDraftPreviewProps) {
  const [sessions, setSessions] = useState<MarathonSession[]>(draftedSessions)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const updateSession = (
    index: number,
    field: keyof MarathonSession,
    value: string | number,
  ) => {
    setSessions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    )
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      try {
        await saveMarathonPlan(sessions)
        setSaved(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save plan.')
      }
    })
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300 font-medium">
          Training plan saved successfully!
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 overflow-hidden w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-orange-500/20 bg-orange-500/10">
        <div className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
        <span className="text-xs font-semibold text-orange-300">
          Draft Running Plan — Review &amp; Edit
        </span>
      </div>

      {/* Editable table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">
                Date
              </th>
              <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">
                Workout Type
              </th>
              <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">
                Dist (km)
              </th>
              <th className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">
                Pace
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, i) => (
              <tr
                key={i}
                className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
              >
                {/* Date — not editable to avoid scheduling errors */}
                <td className="px-3 py-2 text-white/50 whitespace-nowrap font-mono">
                  {session.scheduled_date}
                </td>

                {/* Workout type */}
                <td className="px-3 py-2">
                  <input
                    value={session.workout_type}
                    onChange={(e) =>
                      updateSession(i, 'workout_type', e.target.value)
                    }
                    className="bg-transparent text-white/80 w-full min-w-[100px] focus:outline-none focus:text-white border-b border-transparent focus:border-orange-500/50 pb-px transition-colors"
                  />
                </td>

                {/* Distance */}
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={session.target_distance}
                    onChange={(e) =>
                      updateSession(
                        i,
                        'target_distance',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="bg-transparent text-white/80 w-16 focus:outline-none focus:text-white border-b border-transparent focus:border-orange-500/50 pb-px transition-colors"
                  />
                </td>

                {/* Pace */}
                <td className="px-3 py-2">
                  <input
                    value={session.target_pace}
                    onChange={(e) =>
                      updateSession(i, 'target_pace', e.target.value)
                    }
                    className="bg-transparent text-white/80 w-full min-w-[70px] focus:outline-none focus:text-white border-b border-transparent focus:border-orange-500/50 pb-px transition-colors font-mono"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-orange-500/20">
        <p className="text-xs text-white/30">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} · click any field to edit
        </p>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {error}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle className="h-3 w-3" />
            )}
            Approve &amp; Save Plan
          </button>
        </div>
      </div>
    </div>
  )
}
