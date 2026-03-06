'use client'

// Reusable streaming AI response component for accountability checkpoints

import { useEffect, useRef } from 'react'
import { Bot, Loader2 } from 'lucide-react'

interface AIFeedbackProps {
  response: string
  isStreaming: boolean
  accentClass?: string
  accentBgClass?: string
  accentBorderClass?: string
  title?: string
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h3 key={i} className="text-sm font-semibold text-white/90 mt-4 mb-1 first:mt-0">
          {line.slice(3)}
        </h3>
      )
    }
    if (line.startsWith('### ')) {
      return <h4 key={i} className="text-xs font-semibold text-white/80 mt-3 mb-1">{line.slice(4)}</h4>
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={i} className="text-sm text-white/70 ml-3 list-disc list-inside leading-relaxed">
          {formatInline(line.slice(2))}
        </li>
      )
    }
    if (line.match(/^\d+\. /)) {
      return (
        <li key={i} className="text-sm text-white/70 ml-3 list-decimal list-inside leading-relaxed">
          {formatInline(line.replace(/^\d+\. /, ''))}
        </li>
      )
    }
    if (line === '---') return <hr key={i} className="border-white/10 my-3" />
    if (line.trim() === '') return <div key={i} className="h-1" />
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
      return (
        <code key={i} className="bg-white/10 text-emerald-300 px-1 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

export function AIFeedback({
  response,
  isStreaming,
  accentClass = 'text-emerald-400',
  accentBgClass = 'bg-emerald-400/10',
  accentBorderClass = 'border-emerald-400/20',
  title = 'AI Coach',
}: AIFeedbackProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isStreaming) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [response, isStreaming])

  if (!response && !isStreaming) return null

  return (
    <div className={`rounded-xl border ${accentBorderClass} ${accentBgClass} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${accentBorderClass}`}>
        {isStreaming ? (
          <Loader2 className={`h-3.5 w-3.5 ${accentClass} animate-spin`} />
        ) : (
          <Bot className={`h-3.5 w-3.5 ${accentClass}`} />
        )}
        <span className={`text-xs font-semibold ${accentClass}`}>{title}</span>
        {isStreaming && (
          <span className="text-xs text-white/30 ml-auto">Generating…</span>
        )}
      </div>
      <div className="px-4 py-4 space-y-1">
        {renderMarkdown(response)}
        {isStreaming && (
          <span className="inline-block h-4 w-0.5 bg-white/40 animate-pulse ml-0.5" />
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
