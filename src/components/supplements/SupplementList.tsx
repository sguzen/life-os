'use client'

import { useState } from 'react'
import { Edit2, Pause, Play, XCircle, Zap, AlertCircle } from 'lucide-react'
import { pauseSupplement, resumeSupplement, endSupplementCourse } from '@/lib/supabase/supplements'
import type { Supplement } from '@/lib/types/supplements'
import { FREQUENCY_LABELS, formatDose } from '@/lib/types/supplements'
import { SupplementProgress } from './SupplementProgress'
import { SupplementForm } from './SupplementForm'

interface SupplementListProps {
  supplements: Supplement[]
  bloodDonationRecoveryActive: boolean
  onRefresh: () => void
}

function PauseModal({
  supplement,
  onPause,
  onClose,
}: {
  supplement: Supplement
  onPause: (reason: string, resumeAt?: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [resumeAt, setResumeAt] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-sm font-semibold text-white">Pause {supplement.name}</h3>
        <div>
          <label className="text-xs text-white/40 uppercase tracking-wider">Reason</label>
          <input
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. travelling, GI issues…"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 uppercase tracking-wider">Auto-resume date (optional)</label>
          <input
            type="date"
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25"
            value={resumeAt}
            onChange={(e) => setResumeAt(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onPause(reason, resumeAt || undefined)}
            disabled={!reason.trim()}
            className="flex-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm rounded-lg px-4 py-2 hover:bg-amber-500/30 disabled:opacity-40"
          >
            Pause
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white/70">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function SupplementCard({
  supplement,
  bloodDonationRecoveryActive,
  onEdit,
  onRefresh,
}: {
  supplement: Supplement
  bloodDonationRecoveryActive: boolean
  onEdit: () => void
  onRefresh: () => void
}) {
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const isOverridden = supplement.blood_donation_override && bloodDonationRecoveryActive
  const dose = formatDose(supplement)
  const freqLabel = FREQUENCY_LABELS[supplement.frequency]
  const effectiveFreq = isOverridden ? 'DAILY (blood donation recovery override)' : freqLabel

  async function handlePause(reason: string, resumeAt?: string) {
    setLoading(true)
    try {
      await pauseSupplement(supplement.id, reason, resumeAt)
      onRefresh()
    } finally {
      setLoading(false)
      setShowPauseModal(false)
    }
  }

  async function handleResume() {
    setLoading(true)
    try {
      await resumeSupplement(supplement.id)
      onRefresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleEnd() {
    if (!confirm(`End course for ${supplement.name}? This cannot be undone.`)) return
    setLoading(true)
    try {
      await endSupplementCourse(supplement.id)
      onRefresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showPauseModal && (
        <PauseModal
          supplement={supplement}
          onPause={handlePause}
          onClose={() => setShowPauseModal(false)}
        />
      )}

      <div
        className={`rounded-xl border p-4 space-y-2 transition-colors ${
          supplement.is_paused
            ? 'bg-white/2 border-white/5 opacity-60'
            : isOverridden
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-white/[0.03] border-white/8'
        }`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">
                {supplement.name}
                {supplement.brand && (
                  <span className="ml-1.5 text-xs font-normal text-white/30">{supplement.brand}</span>
                )}
              </span>
              {dose && (
                <span className="text-xs text-white/40">{dose}</span>
              )}
              {supplement.is_paused && (
                <span className="text-xs bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">
                  Paused
                </span>
              )}
            </div>

            <p className="text-xs text-white/40 mt-0.5">
              {effectiveFreq}
              {supplement.timing_notes && ` · ${supplement.timing_notes}`}
            </p>

            {supplement.prescribed_by && (
              <p className="text-xs text-white/25 mt-0.5">{supplement.prescribed_by}</p>
            )}

            {supplement.prescribed_for && (
              <p className="text-xs text-white/25">{supplement.prescribed_for}</p>
            )}

            {supplement.is_paused && supplement.pause_reason && (
              <p className="text-xs text-amber-400/60 mt-0.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {supplement.pause_reason}
                {supplement.resume_at && ` · Resumes ${supplement.resume_at}`}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onEdit}
              disabled={loading}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>

            {supplement.is_paused ? (
              <button
                onClick={handleResume}
                disabled={loading}
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                title="Resume"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setShowPauseModal(true)}
                disabled={loading}
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 text-white/40 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                title="Pause"
              >
                <Pause className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              onClick={handleEnd}
              disabled={loading}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="End course"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Override badge */}
        {isOverridden && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <Zap className="h-3 w-3" />
            OVERRIDDEN: Daily (blood donation recovery active)
          </div>
        )}

        {/* Duration progress */}
        <SupplementProgress supplement={supplement} />
      </div>
    </>
  )
}

export function SupplementList({
  supplements,
  bloodDonationRecoveryActive,
  onRefresh,
}: SupplementListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const active = supplements.filter((s) => s.is_active && !s.is_paused)
  const paused = supplements.filter((s) => s.is_active && s.is_paused)

  function handleSaved() {
    setEditingId(null)
    setShowAdd(false)
    onRefresh()
  }

  if (showAdd) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <SupplementForm onSave={handleSaved} onCancel={() => setShowAdd(false)} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {active.map((s) =>
        editingId === s.id ? (
          <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <SupplementForm
              supplement={s}
              onSave={handleSaved}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
          <SupplementCard
            key={s.id}
            supplement={s}
            bloodDonationRecoveryActive={bloodDonationRecoveryActive}
            onEdit={() => setEditingId(s.id)}
            onRefresh={onRefresh}
          />
        )
      )}

      {paused.length > 0 && (
        <>
          <p className="text-xs font-semibold text-white/25 uppercase tracking-wider pt-2">
            Paused
          </p>
          {paused.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <SupplementForm
                  supplement={s}
                  onSave={handleSaved}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <SupplementCard
                key={s.id}
                supplement={s}
                bloodDonationRecoveryActive={bloodDonationRecoveryActive}
                onEdit={() => setEditingId(s.id)}
                onRefresh={onRefresh}
              />
            )
          )}
        </>
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="w-full rounded-xl border border-dashed border-white/15 py-3 text-sm text-white/35 hover:text-white/60 hover:border-white/25 transition-colors"
      >
        + Add Supplement
      </button>
    </div>
  )
}
