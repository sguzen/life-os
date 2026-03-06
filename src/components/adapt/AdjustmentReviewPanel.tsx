'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, X } from 'lucide-react'
import { AdjustmentCard } from './AdjustmentCard'
import type { AdaptationAdjustment, AdaptationEvent, AdaptModule } from '@/lib/types'

interface AdjustmentReviewPanelProps {
  event: AdaptationEvent
  adjustments: AdaptationAdjustment[]
  summary?: string
}

type LocalStatus = 'pending' | 'approved' | 'rejected' | 'modified'

interface LocalAdjustment extends AdaptationAdjustment {
  localStatus: LocalStatus
  userModifiedValue?: string
}

function getOriginal(adj: AdaptationAdjustment): { label: string; details: string } {
  const orig = adj.original_value as Record<string, unknown> | null
  if (!orig) return { label: 'Original plan', details: '' }

  if (adj.module === 'marathon') {
    return {
      label: `${orig.type ?? ''} ${orig.km ?? ''}km`,
      details: String(orig.description ?? ''),
    }
  }
  if (adj.module === 'nutrition') {
    return {
      label: 'Normal nutrition plan',
      details: 'Standard daily targets',
    }
  }
  if (adj.module === 'trading') {
    return {
      label: 'Normal gate',
      details: 'Trade as planned',
    }
  }
  return { label: 'Original', details: '' }
}

function getProposed(adj: AdaptationAdjustment): { label: string; details: string; reasoning: string } {
  const val = adj.adjusted_value as Record<string, unknown> | null
  const reasoning = adj.reasoning ?? ''

  if (!val) return { label: 'No change', details: '', reasoning }

  if (adj.module === 'marathon') {
    const km = val.adjusted_km as number
    return {
      label: `${val.adjusted_type ?? 'REST'}${km > 0 ? ` ${km}km` : ''}`,
      details: String(val.adjusted_description ?? ''),
      reasoning,
    }
  }
  if (adj.module === 'nutrition') {
    const modifier = val.calorie_modifier as string
    const water = val.water_target_ml as number
    const supps = (val.supplement_additions as string[] | null) ?? []
    return {
      label: `${modifier} kcal · ${(water / 1000).toFixed(1)}L water`,
      details: supps.length > 0 ? `Add: ${supps.join(', ')}` : '',
      reasoning,
    }
  }
  if (adj.module === 'trading') {
    const gate = val.gate_recommendation as string
    const gateLabels: Record<string, string> = {
      trade_normally: 'Trade normally',
      reduced_size: 'Reduced size',
      observation_only: 'Observation only',
      no_trading: 'No trading',
    }
    return {
      label: gateLabels[gate] ?? gate,
      details: '',
      reasoning,
    }
  }
  return { label: 'Modified', details: '', reasoning }
}

const MODULE_SECTIONS: Array<{ module: AdaptModule; label: string }> = [
  { module: 'marathon', label: 'Marathon Changes' },
  { module: 'nutrition', label: 'Nutrition Changes' },
  { module: 'trading', label: 'Trading Changes' },
]

export function AdjustmentReviewPanel({
  event,
  adjustments,
  summary,
}: AdjustmentReviewPanelProps) {
  const router = useRouter()
  const [applying, setApplying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [locals, setLocals] = useState<LocalAdjustment[]>(
    adjustments.map((a) => ({
      ...a,
      localStatus: (a.approved === true ? 'approved' : a.approved === false ? 'rejected' : 'pending') as LocalStatus,
    }))
  )

  function updateStatus(id: string, status: LocalStatus, userModifiedValue?: string) {
    setLocals((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, localStatus: status, userModifiedValue } : a
      )
    )
  }

  function approveAll() {
    setLocals((prev) => prev.map((a) => ({ ...a, localStatus: 'approved' })))
  }

  function rejectAll() {
    setLocals((prev) => prev.map((a) => ({ ...a, localStatus: 'rejected' })))
  }

  const approvedCount = locals.filter((a) => a.localStatus === 'approved' || a.localStatus === 'modified').length
  const pendingCount = locals.filter((a) => a.localStatus === 'pending').length

  async function applyChanges() {
    setApplying(true)
    try {
      const res = await fetch('/api/adapt/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          decisions: locals.map((a) => ({
            id: a.id,
            approved: a.localStatus === 'approved' || a.localStatus === 'modified',
            userOverride: a.userModifiedValue,
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed to apply changes')
      router.push('/adapt')
      router.refresh()
    } catch {
      setApplying(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      {summary && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400/60 uppercase tracking-wider mb-1">
            AI Summary
          </p>
          <p className="text-sm text-white/70 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Module sections */}
      {MODULE_SECTIONS.map(({ module, label }) => {
        const moduleAdjs = locals.filter((a) => a.module === module)
        if (moduleAdjs.length === 0) return null

        return (
          <div key={module} className="space-y-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">{label}</h3>
            {moduleAdjs.map((adj) => {
              const orig = getOriginal(adj)
              const prop = getProposed(adj)
              return (
                <AdjustmentCard
                  key={adj.id}
                  id={adj.id}
                  date={adj.target_date}
                  module={module}
                  original={orig}
                  proposed={prop}
                  status={adj.localStatus}
                  onApprove={() => updateStatus(adj.id, 'approved')}
                  onReject={() => updateStatus(adj.id, 'rejected')}
                  onModify={(val) => updateStatus(adj.id, 'modified', val)}
                />
              )
            })}
          </div>
        )
      })}

      {/* Action bar */}
      <div className="sticky bottom-0 rounded-xl border border-white/10 bg-card/95 backdrop-blur p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/40">
            {approvedCount} accepted · {pendingCount} pending
          </span>
          <div className="flex gap-2">
            <button
              onClick={approveAll}
              className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors"
            >
              Accept all
            </button>
            <button
              onClick={rejectAll}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Reject all
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={approvedCount === 0 || applying}
          className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Apply {approvedCount} change{approvedCount !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="rounded-xl border border-white/10 bg-card p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-white">Confirm changes</h3>
            <p className="text-sm text-white/60">
              These {approvedCount} change{approvedCount !== 1 ? 's' : ''} will update your plan
              for the rest of this week. You can view them in the adaptation history, but they
              won't auto-revert.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyChanges}
                disabled={applying}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {applying ? 'Applying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
