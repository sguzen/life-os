'use client'

import { useState } from 'react'
import { Sparkles, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

interface ProposalItem {
  module: string
  change_type: string
  description: string
  params?: Record<string, unknown>
}

interface AdaptEvent {
  id: string
  event_type: string
  payload: Record<string, unknown>
  proposal: ProposalItem[]
  proposal_at: string
  created_at: string
}

interface AiProposalCardProps {
  event: AdaptEvent
  onResolved: (eventId: string) => void
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  brutal_training_session: 'Hard Training Session',
  consecutive_poor_sleep: 'Poor Sleep Pattern',
  alcohol_pattern: 'Alcohol Pattern',
  low_energy_pattern: 'Low Energy Pattern',
  race_checkpoint_result: 'Race Checkpoint',
  trading_loss_streak: 'Trading Loss Streak',
}

export function AiProposalCard({ event, onResolved }: AiProposalCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAction(action: 'approved' | 'rejected') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/adapt/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })
      if (!res.ok) throw new Error(await res.text())
      onResolved(event.id)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  const triggerDate = new Date(event.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="rounded-xl border border-purple-400/20 bg-purple-500/5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">
            {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
          </span>
          <span className="text-xs text-white/30">{triggerDate}</span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Trigger payload summary */}
          <div className="text-xs text-white/40 space-y-0.5">
            {Object.entries(event.payload).map(([k, v]) => (
              <div key={k}>
                <span className="text-white/30">{k}: </span>
                <span>{String(v)}</span>
              </div>
            ))}
          </div>

          {/* Proposals */}
          {event.proposal.length === 0 ? (
            <p className="text-xs text-white/30 italic">No proposals generated.</p>
          ) : (
            <div className="space-y-2">
              {event.proposal.map((p, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/8 bg-white/3 px-3 py-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-purple-300/80 uppercase tracking-wide">
                      {p.module}
                    </span>
                    <span className="text-xs text-white/25">·</span>
                    <span className="text-xs text-white/40">{p.change_type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-white/70">{p.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleAction('approved')}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-green-300 hover:text-green-200 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20"
            >
              <Check className="h-3 w-3" />
              Accept
            </button>
            <button
              onClick={() => handleAction('rejected')}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
            >
              <X className="h-3 w-3" />
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
