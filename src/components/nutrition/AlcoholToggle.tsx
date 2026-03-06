'use client'

import { Wine, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface AlcoholToggleProps {
  consumed: boolean
  details: string
  onToggle: (consumed: boolean) => void
  onDetailsChange: (details: string) => void
  disabled?: boolean
}

export function AlcoholToggle({
  consumed,
  details,
  onToggle,
  onDetailsChange,
  disabled,
}: AlcoholToggleProps) {
  const [showWarning, setShowWarning] = useState(consumed)

  function handleToggle(val: boolean) {
    onToggle(val)
    setShowWarning(val)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wine className="h-4 w-4 text-pink-400" />
        <span className="text-sm font-medium text-white/80">Alcohol today?</span>
      </div>

      <div className="flex gap-3 mb-3">
        <button
          type="button"
          onClick={() => handleToggle(false)}
          disabled={disabled}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold border transition-colors disabled:opacity-40 ${
            !consumed
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'bg-white/5 border-white/10 text-white/40 hover:border-white/25'
          }`}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => handleToggle(true)}
          disabled={disabled}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold border transition-colors disabled:opacity-40 ${
            consumed
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'bg-white/5 border-white/10 text-white/40 hover:border-white/25'
          }`}
        >
          Yes
        </button>
      </div>

      {consumed && (
        <>
          <textarea
            value={details}
            onChange={(e) => onDetailsChange(e.target.value)}
            placeholder="What did you drink? How much?"
            rows={2}
            disabled={disabled}
            className="w-full rounded-md bg-white/5 border border-red-500/30 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50 resize-none mb-3"
          />

          {showWarning && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">
                <span className="font-semibold">Alcohol logged.</span> Tomorrow's trading gate will
                be automatically blocked.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
