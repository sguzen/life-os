'use client'

// AI Daily Brief — on-demand generation via /api/ai/daily-brief

import { useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type Status = 'idle' | 'loading' | 'done' | 'error'

export function AIDailyBrief() {
  const [brief, setBrief] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  async function generate() {
    setStatus('loading')
    try {
      const res = await fetch('/api/ai/daily-brief')
      if (!res.ok) throw new Error('bad response')
      const json = await res.json()
      setBrief(json.brief ?? null)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

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
        {status === 'done' && (
          <button
            onClick={generate}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Refresh brief"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {status === 'idle' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-sm text-muted-foreground">Your AI brief is ready to generate.</p>
          <button
            onClick={generate}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Brief
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}

      {status === 'error' && (
        <p className="text-sm text-muted-foreground italic">
          Unable to generate brief — check that GOOGLE_GENERATIVE_AI_API_KEY is set.
        </p>
      )}

      {status === 'done' && brief && (
        <p className="text-sm leading-relaxed">{brief}</p>
      )}
    </div>
  )
}
