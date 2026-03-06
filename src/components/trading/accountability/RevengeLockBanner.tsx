'use client'

import { useState } from 'react'
import { Lock, AlertTriangle } from 'lucide-react'

interface RevengeLockBannerProps {
  consecutiveLosses: number
  onOverride: (reason: string) => void
}

export function RevengeLockBanner({ consecutiveLosses, onOverride }: RevengeLockBannerProps) {
  const [showOverride, setShowOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [overrideActive, setOverrideActive] = useState(false)

  const canSubmit = reason.trim().length >= 20

  function handleOverride() {
    if (!canSubmit) return
    onOverride(reason.trim())
    setOverrideActive(true)
    setShowOverride(false)
  }

  if (overrideActive) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 flex items-center gap-3">
        <Lock className="h-4 w-4 text-red-400 shrink-0" />
        <p className="text-sm text-red-300 font-medium">
          OVERRIDE ACTIVE — You accepted responsibility for this trade.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-red-500 bg-red-950/50 overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4">
        <Lock className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="text-base font-bold text-red-400 tracking-wide">
            🔒 REVENGE LOCK ACTIVE
          </p>
          <p className="text-sm text-red-300">
            You've had {consecutiveLosses} consecutive losses. Cool-down required before next trade.
          </p>
          <p className="text-xs text-red-400/70">
            Stop. Step away. Come back in 30 minutes minimum. You know what you're like after losses.
          </p>
        </div>
      </div>

      {!showOverride ? (
        <div className="px-5 pb-4">
          <button
            onClick={() => setShowOverride(true)}
            className="text-xs text-red-400/60 hover:text-red-400 underline underline-offset-2 transition-colors"
          >
            I need to override this
          </button>
        </div>
      ) : (
        <div className="border-t border-red-500/30 px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300 font-medium">
              Type your reason. You accept full responsibility for this decision.
            </p>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="State your specific reason (min 20 characters)…"
            rows={3}
            className="w-full rounded-lg bg-black/40 border border-red-500/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-red-400/60 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${reason.trim().length >= 20 ? 'text-emerald-400' : 'text-white/30'}`}>
              {reason.trim().length}/20 characters minimum
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowOverride(false)}
                className="text-xs text-white/40 hover:text-white/60 transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleOverride}
                disabled={!canSubmit}
                className="text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                I accept responsibility
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
