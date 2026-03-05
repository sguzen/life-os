'use client'

// P5-03/04/05: Shared streaming coach chat component (AI SDK v6)
// Used by RunningCoach, TradingCoach, HabitsCoach

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, SendHorizonal, RefreshCw, Loader2 } from 'lucide-react'
import type { UIMessage } from 'ai'

interface CoachChatProps {
  apiEndpoint: string
  title: string
  subtitle?: string
  placeholder?: string
  accentClass?: string
  accentBgClass?: string
  accentBorderClass?: string
  extraBody?: Record<string, unknown>
}

// Extract plain text from v6 UIMessage parts
function getMessageText(msg: UIMessage): string {
  const textPart = msg.parts.find((p) => p.type === 'text')
  return textPart && 'text' in textPart ? textPart.text : ''
}

// Simple markdown-ish renderer
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
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

export function CoachChat({
  apiEndpoint,
  title,
  subtitle,
  placeholder = 'Ask your coach…',
  accentClass = 'text-indigo-400',
  accentBgClass = 'bg-indigo-400/10',
  accentBorderClass = 'border-indigo-400/20',
  extraBody = {},
}: CoachChatProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: apiEndpoint, body: extraBody }),
  })

  const isLoading = status === 'submitted' || status === 'streaming'
  const hasMessages = messages.length > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage({ text })
  }

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-white/10 ${accentBgClass}`}>
        <Bot className={`h-4 w-4 shrink-0 ${accentClass}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          {subtitle && <p className="text-xs text-white/40 truncate">{subtitle}</p>}
        </div>
        {hasMessages && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-h-96 px-5 py-4 space-y-4 min-h-[120px]">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-center">
            <Bot className={`h-8 w-8 ${accentClass} opacity-40`} />
            <p className="text-xs text-white/30">Ask a question to start your coaching session</p>
          </div>
        )}

        {messages.map((msg) => {
          const text = getMessageText(msg)
          if (!text) return null
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-0.5 ${accentBgClass} border ${accentBorderClass}`}>
                  <Bot className={`h-3 w-3 ${accentClass}`} />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-white/10 border border-white/10'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm text-white/80">{text}</p>
                ) : (
                  <div className="space-y-1">{renderMarkdown(text)}</div>
                )}
              </div>
            </div>
          )
        })}

        {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant') && (
          <div className="flex gap-3 justify-start">
            <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${accentBgClass} border ${accentBorderClass}`}>
              <Loader2 className={`h-3 w-3 ${accentClass} animate-spin`} />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-3 px-5 py-4 border-t border-white/10 bg-white/[0.02]"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          className="flex-1 resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 disabled:opacity-40 max-h-32 leading-relaxed"
          style={{ minHeight: '38px' }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className={`shrink-0 h-[38px] w-[38px] flex items-center justify-center rounded-lg transition-colors ${
            isLoading || !input.trim()
              ? 'opacity-30 cursor-not-allowed bg-white/5'
              : `${accentBgClass} hover:opacity-80`
          }`}
        >
          {isLoading ? (
            <Loader2 className={`h-4 w-4 ${accentClass} animate-spin`} />
          ) : (
            <SendHorizonal className={`h-4 w-4 ${accentClass}`} />
          )}
        </button>
      </form>
    </div>
  )
}
