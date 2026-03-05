'use client'

// AI Daily Brief — loads async from Gemini via /api/ai/daily-brief

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function AIDailyBrief() {
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/ai/daily-brief')
      if (!res.ok) throw new Error('bad response')
      const json = await res.json()
      setBrief(json.brief ?? null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            AI Daily Brief
          </p>
          <span className="text-[10px] text-muted-foreground/60 font-normal">Gemini</span>
        </div>
        {!loading && (
          <button
            onClick={load}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Refresh brief"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : error || !brief ? (
        <p className="text-sm text-muted-foreground italic">
          Unable to generate brief — check that GOOGLE_GENERATIVE_AI_API_KEY is set.
        </p>
      ) : (
        <p className="text-sm leading-relaxed">{brief}</p>
      )}
    </div>
  )
}
