'use client'

// P5-06: Bulk Trade Analysis — long-context monthly review
// One-shot Gemini 2.0 Flash analysis of a full calendar month of trades

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { BarChart3, ChevronDown, Loader2, Bot, RefreshCw } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h3 key={i} className="text-sm font-semibold text-white/90 mt-5 mb-2 first:mt-0 border-b border-white/10 pb-1">
          {line.slice(3)}
        </h3>
      )
    }
    if (line.startsWith('### ')) {
      return <h4 key={i} className="text-xs font-semibold text-white/80 mt-3 mb-1">{line.slice(4)}</h4>
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={i} className="text-sm text-white/70 ml-4 list-disc leading-relaxed">
          {formatInline(line.slice(2))}
        </li>
      )
    }
    if (line.match(/^\d+\. /)) {
      return (
        <li key={i} className="text-sm text-white/70 ml-4 list-decimal leading-relaxed">
          {formatInline(line.replace(/^\d+\. /, ''))}
        </li>
      )
    }
    if (line === '---') return <hr key={i} className="border-white/10 my-3" />
    if (line.trim() === '') return <div key={i} className="h-1.5" />
    return (
      <p key={i} className="text-sm text-white/70 leading-relaxed">
        {formatInline(line)}
      </p>
    )
  })
}

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-white/10 text-emerald-300 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}

export function BulkTradeAnalysis() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, append, isLoading, stop, setMessages } = useChat({
    api: '/api/ai/trade-analysis',
    body: { month, year },
  })

  const completion = messages.filter(m => m.role === 'assistant').at(-1)?.content ?? ''

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [completion])

  const monthLabel = `${MONTHS[month - 1]} ${year}`

  const handleAnalyse = () => {
    setMessages([])
    append({ role: 'user', content: `Analyse ${monthLabel}` })
  }

  // Year options: current year and previous 2
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-emerald-400/10">
        <BarChart3 className="h-4 w-4 shrink-0 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Monthly Trade Analysis</p>
          <p className="text-xs text-white/40">Gemini long-context · Full month deep-dive</p>
        </div>
        {completion && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        {/* Month selector */}
        <div className="relative">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            disabled={isLoading}
            className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-white/25 disabled:opacity-40 cursor-pointer"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1} className="bg-gray-900">
                {m}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
        </div>

        {/* Year selector */}
        <div className="relative">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={isLoading}
            className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-white/25 disabled:opacity-40 cursor-pointer"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y} className="bg-gray-900">
                {y}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
        </div>

        <div className="flex-1" />

        {isLoading ? (
          <button
            onClick={stop}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Stop
          </button>
        ) : (
          <button
            onClick={handleAnalyse}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-xs text-emerald-400 hover:bg-emerald-400/20 transition-colors font-medium"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analyse {monthLabel}
          </button>
        )}
      </div>

      {/* Output */}
      <div className="max-h-[600px] overflow-y-auto px-5 py-4 min-h-[160px]">
        {!completion && !isLoading && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <Bot className="h-8 w-8 text-emerald-400 opacity-40" />
            <p className="text-xs text-white/30">
              Select a month and click Analyse to get a full deep-dive review
            </p>
          </div>
        )}

        {isLoading && !completion && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
            <p className="text-xs text-white/40">Analysing {monthLabel} trades…</p>
          </div>
        )}

        {completion && (
          <div className="space-y-1">
            {renderMarkdown(completion)}
            {isLoading && (
              <div className="flex gap-1 items-center mt-2 pt-2">
                <span className="h-1 w-1 rounded-full bg-emerald-400/60 animate-pulse" />
                <span className="text-xs text-white/30 ml-1">streaming…</span>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
