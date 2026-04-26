'use client'

import { cn } from '@/lib/utils'

export interface CoachTask {
  id: string
  title: string
  notes?: string | null
  due_date?: string | null
  module?: string | null
  coach_context?: string | null
  confidence_score?: number | null
  rationale?: string | null
  completed_at?: string | null
}

interface CoachTaskCardProps {
  task: CoachTask
  onComplete?: (id: string) => void
}

function ConfidenceBadge({ score }: { score: number }) {
  if (score > 0.8) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
        Confirmed Pattern
      </span>
    )
  }
  if (score < 0.6) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/5 text-white/35 border border-white/10">
        Hypothesis
      </span>
    )
  }
  return null
}

export function CoachTaskCard({ task, onComplete }: CoachTaskCardProps) {
  const score = task.confidence_score ?? null
  const isHypothesis = score !== null && score < 0.6
  const isConfirmed  = score !== null && score > 0.8
  const isDone       = !!task.completed_at

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 space-y-1.5 transition-opacity',
        isDone && 'opacity-40',
        isHypothesis
          ? 'border-dashed border-white/15 bg-white/[0.02]'
          : isConfirmed
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : 'border-white/10 bg-white/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium leading-snug',
              isHypothesis ? 'text-white/40' : isConfirmed ? 'text-emerald-100' : 'text-white/80',
            )}
          >
            {task.title}
          </p>

          {task.notes && (
            <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{task.notes}</p>
          )}

          {task.rationale && (
            <p className="text-xs text-white/25 mt-1 leading-relaxed italic">
              {task.rationale}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {score !== null && <ConfidenceBadge score={score} />}

          {!isDone && onComplete && (
            <button
              onClick={() => onComplete(task.id)}
              className="text-[10px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/35 hover:text-white/60 hover:bg-white/10 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>

      {task.due_date && (
        <p className="text-[10px] text-white/25">Due {task.due_date}</p>
      )}
    </div>
  )
}
