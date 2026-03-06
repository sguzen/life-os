'use client'

import { useState } from 'react'
import { Loader2, Sparkles, RefreshCw } from 'lucide-react'

interface AIAdviceProps {
  logDate: string
  existingAdvice?: string | null
  generatedAt?: string | null
}

export function AIAdvice({ logDate, existingAdvice, generatedAt }: AIAdviceProps) {
  const [advice, setAdvice] = useState(existingAdvice ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')

  async function fetchAdvice() {
    setIsStreaming(true)
    setError('')
    setAdvice('')

    try {
      const res = await fetch('/api/ai/nutrition-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logDate }),
      })

      if (!res.ok) throw new Error('AI request failed')
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setAdvice(full)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsStreaming(false)
    }
  }

  const hasAdvice = !!advice

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-white/80">AI Daily Coach</span>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && !advice && (
            <span className="text-xs text-white/25">
              Last: {new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchAdvice}
            disabled={isStreaming}
            className="flex items-center gap-1.5 rounded-lg bg-violet-500/10 border border-violet-500/25 hover:bg-violet-500/20 transition-colors px-3 py-1.5 text-xs text-violet-300 disabled:opacity-40"
          >
            {isStreaming ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : hasAdvice ? (
              <RefreshCw className="h-3 w-3" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {isStreaming ? 'Coaching…' : hasAdvice ? 'Refresh' : 'Get Today\'s Advice'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {(advice || isStreaming) && (
        <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 p-3">
          <p className="text-sm text-white/75 leading-relaxed whitespace-pre-line">
            {advice}
            {isStreaming && <span className="animate-pulse text-violet-400">▋</span>}
          </p>
        </div>
      )}

      {!advice && !isStreaming && (
        <p className="text-xs text-white/25">
          Tap &quot;Get Today&apos;s Advice&quot; after logging your meals for personalised coaching.
        </p>
      )}
    </div>
  )
}
