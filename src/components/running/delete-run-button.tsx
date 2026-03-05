'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteRun } from '@/app/actions/running'

export function DeleteRunButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await deleteRun(id)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/50">Delete this run?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          {loading ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-white/40 hover:text-white"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" /> Delete run
    </button>
  )
}
