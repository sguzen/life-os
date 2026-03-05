'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logRestingHr } from '@/app/actions/running'

export function LogRestingHrForm() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    const result = await logRestingHr(null, new FormData(e.currentTarget))
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Log resting HR manually</h3>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2">Saved!</p>
      )}

      <div className="flex gap-2 flex-wrap">
        <input
          type="date"
          name="logged_date"
          defaultValue={today}
          required
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 flex-1 min-w-[140px]"
        />
        <input
          type="number"
          name="resting_hr"
          required
          min={30}
          max={120}
          placeholder="bpm"
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-rose-500 w-24"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-rose-600/80 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 transition-colors whitespace-nowrap"
        >
          {loading ? 'Saving…' : 'Log HR'}
        </button>
      </div>
      <input
        name="notes"
        placeholder="Notes (optional)"
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-rose-500"
      />
    </form>
  )
}
