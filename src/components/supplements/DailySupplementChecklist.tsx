'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check } from 'lucide-react'
import { upsertSupplementLog } from '@/lib/supabase/supplements'
import { shouldTakeToday, FREQUENCY_LABELS, formatDose } from '@/lib/types/supplements'
import type { Supplement, SupplementLogEntry } from '@/lib/types/supplements'

interface DailySupplementChecklistProps {
  supplements: Supplement[]
  logs: SupplementLogEntry[]
  date: string
  bloodDonationRecoveryActive: boolean
  onLogUpdated?: () => void
}

export function DailySupplementChecklist({
  supplements,
  logs,
  date,
  bloodDonationRecoveryActive,
  onLogUpdated,
}: DailySupplementChecklistProps) {
  const dateObj = new Date(date + 'T00:00:00')
  const [isPending, startTransition] = useTransition()
  const [localTaken, setLocalTaken] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const log of logs) {
      map[log.supplement_id] = log.taken
    }
    return map
  })
  const [saving, setSaving] = useState<string | null>(null)

  const todaySupplements = supplements.filter((s) =>
    s.is_active && !s.is_paused && shouldTakeToday(s, dateObj, bloodDonationRecoveryActive)
  )

  const takenCount = todaySupplements.filter((s) => localTaken[s.id]).length

  async function toggle(supplement: Supplement) {
    const newVal = !localTaken[supplement.id]
    setLocalTaken((prev) => ({ ...prev, [supplement.id]: newVal }))
    setSaving(supplement.id)
    try {
      await upsertSupplementLog(supplement.id, date, newVal)
      onLogUpdated?.()
    } catch {
      // Revert on failure
      setLocalTaken((prev) => ({ ...prev, [supplement.id]: !newVal }))
    } finally {
      setSaving(null)
    }
  }

  if (todaySupplements.length === 0) {
    return (
      <p className="text-sm text-white/30 py-4 text-center">
        No supplements scheduled for today.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          Today&apos;s Supplements
        </p>
        <span className="text-xs text-white/35">
          {takenCount}/{todaySupplements.length} taken
        </span>
      </div>

      {/* Checklist */}
      <div className="space-y-1.5">
        {todaySupplements.map((supplement) => {
          const taken = !!localTaken[supplement.id]
          const isSaving = saving === supplement.id
          const dose = formatDose(supplement)
          const isOverride =
            supplement.blood_donation_override && bloodDonationRecoveryActive

          return (
            <button
              key={supplement.id}
              type="button"
              onClick={() => startTransition(() => { toggle(supplement) })}
              disabled={isSaving || isPending}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors text-left disabled:opacity-50 ${
                taken
                  ? 'bg-emerald-500/10 border-emerald-500/25'
                  : isOverride
                  ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                  : supplement.timing === 'before_bed'
                  ? 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
                  : 'bg-white/[0.03] border-white/8 hover:bg-white/8'
              }`}
            >
              {/* Checkbox */}
              <span
                className={`shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                  taken
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-white/20 text-transparent'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin text-white/50" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${taken ? 'text-emerald-300' : 'text-white/80'}`}>
                  {supplement.name}
                  {dose && (
                    <span className="ml-1.5 text-xs font-normal text-white/35">{dose}</span>
                  )}
                  {isOverride && (
                    <span className="ml-1.5 text-xs text-amber-400">⚡ daily (recovery)</span>
                  )}
                  {supplement.timing === 'before_bed' && !taken && (
                    <span className="ml-1.5 text-xs text-yellow-400">← before bed</span>
                  )}
                </p>
                {supplement.timing_notes && (
                  <p className="text-xs text-white/30 mt-0.5">{supplement.timing_notes}</p>
                )}
                {supplement.frequency !== 'daily' && (
                  <p className="text-xs text-white/25 mt-0.5">
                    {FREQUENCY_LABELS[supplement.frequency]}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Progress bar */}
      {todaySupplements.length > 0 && (
        <div className="h-1 w-full rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
            style={{ width: `${(takenCount / todaySupplements.length) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}
