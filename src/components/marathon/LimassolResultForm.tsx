'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function timeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parts[0] * 60 + (parts[1] ?? 0)
}

export function LimassolResultForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [finish, setFinish] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!finish.match(/^\d+:\d{2}:\d{2}$/)) {
      setError('Use format H:MM:SS (e.g. 1:44:32)')
      return
    }

    const finishSec = timeToSeconds(finish)
    const avgPaceSec = Math.round(finishSec / 21.0975)
    const m = Math.floor(avgPaceSec / 60)
    const s = avgPaceSec % 60
    const avgPace = `${m}:${String(s).padStart(2, '0')}`

    try {
      const res = await fetch('/api/marathon/race-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          race_date: '2026-03-22',
          race_name: 'Limassol Half Marathon',
          distance_km: 21.0975,
          finish_time: finish,
          finish_time_seconds: finishSec,
          avg_pace: avgPace,
          notes,
          official: true,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-6">
      <h2 className="text-sm font-semibold text-white">Log Limassol Result</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Finish Time (H:MM:SS)</label>
          <input
            type="text"
            value={finish}
            onChange={(e) => setFinish(e.target.value)}
            placeholder="1:44:32"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-lg placeholder:text-white/20 focus:outline-none focus:border-white/25"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did the race go? Splits? How you felt at km 15?"
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 resize-none"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Result
        </button>
      </form>
    </div>
  )
}
