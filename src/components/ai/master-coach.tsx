'use client'

// Master AI Coach — full-system chat with tool-call result cards
// Handles cross-module changes (supplement pause/resume, plan config updates)

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  Bot,
  SendHorizonal,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Pill,
  History,
  Zap,
} from 'lucide-react'
import type { UIMessage } from 'ai'

// ── Markdown helpers (shared pattern from coach-chat.tsx) ──────────────────

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="bg-white/10 text-violet-300 px-1 py-0.5 rounded text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## '))
      return (
        <h3 key={i} className="text-sm font-semibold text-white/90 mt-4 mb-1 first:mt-0">
          {line.slice(3)}
        </h3>
      )
    if (line.startsWith('### '))
      return (
        <h4 key={i} className="text-xs font-semibold text-white/80 mt-3 mb-1">
          {line.slice(4)}
        </h4>
      )
    if (line.startsWith('- ') || line.startsWith('* '))
      return (
        <li key={i} className="text-sm text-white/70 ml-3 list-disc list-inside leading-relaxed">
          {formatInline(line.slice(2))}
        </li>
      )
    if (line.match(/^\d+\. /))
      return (
        <li key={i} className="text-sm text-white/70 ml-3 list-decimal list-inside leading-relaxed">
          {formatInline(line.replace(/^\d+\. /, ''))}
        </li>
      )
    if (line === '---') return <hr key={i} className="border-white/10 my-3" />
    if (line.trim() === '') return <div key={i} className="h-1.5" />
    return (
      <p key={i} className="text-sm text-white/70 leading-relaxed">
        {formatInline(line)}
      </p>
    )
  })
}

// ── Tool result card ───────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  pause_supplement: { label: 'Paused supplement', Icon: Pill, color: 'text-amber-400' },
  resume_supplement: { label: 'Resumed supplement', Icon: Pill, color: 'text-emerald-400' },
  update_plan_config: { label: 'Updated plan config', Icon: Settings, color: 'text-violet-400' },
  get_recent_changes: { label: 'Fetched audit log', Icon: History, color: 'text-sky-400' },
}

interface ToolResult {
  success?: boolean
  message?: string
  entries?: Array<{ date: string; module: string; what: string; change: string; reason?: string; by: string }>
}

function ToolCard({
  toolName,
  state,
  result,
}: {
  toolName: string
  state: string
  result?: ToolResult
}) {
  const meta = TOOL_META[toolName] ?? { label: toolName, Icon: Zap, color: 'text-white/40' }
  const { label, Icon, color } = meta
  const isPending = state === 'call' || state === 'partial-call'
  const isSuccess = result?.success !== false

  if (isPending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/40">
        <Loader2 className={`h-3.5 w-3.5 ${color} animate-spin`} />
        <span>{label}…</span>
      </div>
    )
  }

  // get_recent_changes returns an entries list, not a simple message
  if (toolName === 'get_recent_changes' && result?.entries?.length) {
    return (
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-sky-500/15">
          <History className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-xs font-medium text-sky-300">Recent Changes</span>
        </div>
        <div className="px-3 py-2 space-y-1">
          {result.entries.map((e, i) => (
            <div key={i} className="text-xs text-white/50">
              <span className="text-white/30">{e.date}</span>
              {' · '}
              <span className="text-white/60">[{e.module}]</span>
              {' '}
              {e.change}
              {e.reason ? <span className="text-white/30"> — {e.reason}</span> : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs ${
        isSuccess
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-red-500/5 border-red-500/20'
      }`}
    >
      {isSuccess ? (
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">
        <span className={`font-medium ${isSuccess ? 'text-emerald-300' : 'text-red-300'}`}>
          {label}
        </span>
        {result?.message && (
          <p className="text-white/40 mt-0.5 leading-relaxed">{result.message}</p>
        )}
      </div>
    </div>
  )
}

// ── Message renderer ────────────────────────────────────────────────────────

function MessageContent({ msg }: { msg: UIMessage }) {
  const textPart = msg.parts.find((p) => p.type === 'text')
  const text = textPart && 'text' in textPart ? textPart.text : ''

  const toolParts = msg.parts.filter((p) => p.type === 'tool-invocation') as Array<{
    type: 'tool-invocation'
    toolInvocationId: string
    toolName: string
    args: Record<string, unknown>
    state: string
    result?: ToolResult
  }>

  if (!text && toolParts.length === 0) return null

  return (
    <div className="space-y-2.5">
      {toolParts.length > 0 && (
        <div className="space-y-1.5">
          {toolParts.map((tp) => (
            <ToolCard
              key={tp.toolInvocationId}
              toolName={tp.toolName}
              state={tp.state}
              result={tp.result}
            />
          ))}
        </div>
      )}
      {text && <div className="space-y-1">{renderMarkdown(text)}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function MasterCoach() {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/coach' }),
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
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-violet-500/10">
        <Bot className="h-4 w-4 shrink-0 text-violet-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Life OS Coach</p>
          <p className="text-xs text-white/40 truncate">
            Gemini · all modules · can make changes
          </p>
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
      <div className="flex-1 overflow-y-auto max-h-[520px] px-5 py-4 space-y-4 min-h-[140px]">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-28 gap-2 text-center">
            <Bot className="h-9 w-9 text-violet-400 opacity-30" />
            <p className="text-xs text-white/30 max-w-xs leading-relaxed">
              Ask about any module — training, nutrition, supplements, habits, trading.
              I can also make changes: pause a supplement, adjust a training pace, etc.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            const textPart = msg.parts.find((p) => p.type === 'text')
            const text = textPart && 'text' in textPart ? textPart.text : ''
            if (!text) return null
            return (
              <div key={msg.id} className="flex gap-3 justify-end">
                <div className="max-w-[85%] rounded-xl px-4 py-3 bg-white/10 border border-white/10">
                  <p className="text-sm text-white/80">{text}</p>
                </div>
              </div>
            )
          }

          const content = <MessageContent msg={msg} />
          // Check if there's anything to render
          const hasText = msg.parts.some((p) => p.type === 'text' && 'text' in p && (p as { text: string }).text)
          const hasTools = msg.parts.some((p) => p.type === 'tool-invocation')
          if (!hasText && !hasTools) return null

          return (
            <div key={msg.id} className="flex gap-3 justify-start">
              <div className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-0.5 bg-violet-500/10 border border-violet-500/20">
                <Bot className="h-3 w-3 text-violet-400" />
              </div>
              <div className="max-w-[90%] rounded-xl px-4 py-3 bg-white/5 border border-white/10">
                {content}
              </div>
            </div>
          )
        })}

        {isLoading &&
          (messages.length === 0 ||
            messages[messages.length - 1]?.role !== 'assistant') && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                <Loader2 className="h-3 w-3 text-violet-400 animate-spin" />
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

      {/* Suggestion chips */}
      {!hasMessages && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {[
            'How am I doing this week?',
            'Pause my iron supplement',
            'What changes were made recently?',
            'Am I on track for Belgrade?',
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setInput(prompt)
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-3 px-5 py-4 border-t border-white/10 bg-white/[0.02]"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about any module, or request a change…"
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
              : 'bg-violet-500/10 hover:opacity-80'
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4 text-violet-400" />
          )}
        </button>
      </form>
    </div>
  )
}
