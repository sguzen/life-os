'use client'

import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import type { AdaptModule } from '@/lib/types'

export interface AdjustmentCardProps {
  id: string
  date: string
  module: AdaptModule
  original: {
    label: string
    details: string
  }
  proposed: {
    label: string
    details: string
    reasoning: string
  }
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  onApprove: () => void
  onReject: () => void
  onModify: (value: string) => void
}

const MODULE_COLORS: Record<AdaptModule, string> = {
  marathon: 'text-orange-400',
  nutrition: 'text-green-400',
  trading: 'text-blue-400',
}

const STATUS_STYLES = {
  pending: 'border-white/10',
  approved: 'border-green-500/40 bg-green-500/5',
  rejected: 'border-red-500/20',
  modified: 'border-blue-400/40 bg-blue-400/5',
}

export function AdjustmentCard({
  id,
  date,
  module,
  original,
  proposed,
  status,
  onApprove,
  onReject,
  onModify,
}: AdjustmentCardProps) {
  const [editing, setEditing] = useState(false)
  const [modifiedValue, setModifiedValue] = useState(proposed.details)

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  function handleSaveModify() {
    onModify(modifiedValue)
    setEditing(false)
  }

  return (
    <div className={`rounded-lg border p-4 space-y-3 transition-colors ${STATUS_STYLES[status]}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30">{formattedDate}</span>
          <span className={`text-xs font-semibold uppercase ${MODULE_COLORS[module]}`}>
            {module}
          </span>
        </div>
        {status === 'approved' && (
          <span className="text-xs font-medium text-green-400 flex items-center gap-1">
            <Check className="h-3 w-3" /> Accepted
          </span>
        )}
        {status === 'rejected' && (
          <span className="text-xs font-medium text-red-400 flex items-center gap-1">
            <X className="h-3 w-3" /> Keeping original
          </span>
        )}
        {status === 'modified' && (
          <span className="text-xs font-medium text-blue-400">Modified</span>
        )}
      </div>

      {/* Side-by-side original vs proposed */}
      <div className="grid grid-cols-2 gap-3">
        {/* Original */}
        <div className="rounded-md border border-white/5 bg-white/3 p-3">
          <p className="text-xs text-white/30 mb-1 uppercase tracking-wider">Original</p>
          <p className={`text-sm font-medium text-white/40 ${status === 'rejected' ? '' : 'line-through decoration-white/20'}`}>
            {status === 'rejected' ? original.label : original.label}
          </p>
          <p className="text-xs text-white/25 mt-0.5">{original.details}</p>
        </div>

        {/* Proposed */}
        <div className={`rounded-md border p-3 ${
          status === 'rejected'
            ? 'border-white/5 bg-white/3 opacity-40'
            : status === 'approved'
            ? 'border-green-500/20 bg-green-500/5'
            : status === 'modified'
            ? 'border-blue-400/20 bg-blue-400/5'
            : 'border-amber-400/20 bg-amber-400/5'
        }`}>
          <p className="text-xs text-white/30 mb-1 uppercase tracking-wider">Proposed</p>
          {editing ? (
            <textarea
              value={modifiedValue}
              onChange={(e) => setModifiedValue(e.target.value)}
              rows={2}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-amber-400/50 focus:outline-none resize-none"
            />
          ) : (
            <>
              <p className="text-sm font-medium text-white/80">
                {status === 'modified' ? modifiedValue : proposed.label}
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                {status === 'modified' ? '' : proposed.details}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Reasoning */}
      {proposed.reasoning && (
        <p className="text-xs italic text-white/30 leading-relaxed">{proposed.reasoning}</p>
      )}

      {/* Actions */}
      {editing ? (
        <div className="flex gap-2">
          <button
            onClick={handleSaveModify}
            className="flex-1 rounded-md bg-blue-500/20 border border-blue-400/30 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/30 transition-colors"
          >
            Save modification
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={status === 'approved'}
            className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              status === 'approved'
                ? 'border-green-500/40 bg-green-500/10 text-green-400 cursor-default'
                : 'border-white/10 text-white/50 hover:border-green-500/40 hover:bg-green-500/10 hover:text-green-400'
            }`}
          >
            <Check className="h-3 w-3" /> Accept
          </button>
          <button
            onClick={onReject}
            disabled={status === 'rejected'}
            className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              status === 'rejected'
                ? 'border-red-500/30 bg-red-500/10 text-red-400 cursor-default'
                : 'border-white/10 text-white/50 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400'
            }`}
          >
            <X className="h-3 w-3" /> Keep original
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/40 hover:border-blue-400/30 hover:text-blue-400 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Modify
          </button>
        </div>
      )}
    </div>
  )
}
