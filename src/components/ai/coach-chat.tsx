'use client'

// Shared streaming coach chat component (AI SDK v6)
// Supports tool-invocation rendering and proposal cards (used by Life Coach).
// Backward-compatible: existing coaches work unchanged without confirmEndpoint.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  Bot,
  SendHorizonal,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import type { UIMessage } from 'ai'
import { PlanDraftPreview } from '@/components/marathon/PlanDraftPreview'

// ── Props ───────────────────────────────────────────────────────────────────

interface CoachChatProps {
  apiEndpoint: string
  title: string
  subtitle?: string
  placeholder?: string
  accentClass?: string
  accentBgClass?: string
  accentBorderClass?: string
  extraBody?: Record<string, unknown>
  /** When set, tool proposals from the AI will show Confirm/Reject buttons that
   *  POST to this endpoint to execute the approved change. */
  confirmEndpoint?: string
  /** Session ID for conversation persistence (stored in sessionStorage by parent). */
  sessionId?: string
  /** Pre-populated messages from history (DB rows mapped to UIMessage shape). */
  initialMessages?: UIMessage[]
  /** Suggestion chips shown in the empty state. */
  suggestionChips?: string[]
  /** Max height of the messages area (Tailwind class). Defaults to max-h-96. */
  messagesMaxHeightClass?: string
}

// ── Proposal / tool result types ────────────────────────────────────────────

interface ProposalResult {
  type: 'proposal'
  action: string
  displayTitle: string
  displayBody: string
  reason: string
  params: Record<string, unknown>
}

interface ErrorResult {
  type: 'error'
  message: string
}

type ToolResult = ProposalResult | ErrorResult | Record<string, unknown>

type ProposalState = 'pending' | 'confirming' | 'confirmed' | 'rejected'

// ── Markdown helpers ────────────────────────────────────────────────────────

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
        <code key={i} className="bg-white/10 text-emerald-300 px-1 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

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
      return (
        <h4 key={i} className="text-xs font-semibold text-white/80 mt-3 mb-1">
          {line.slice(4)}
        </h4>
      )
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

// ── ProposalCard ─────────────────────────────────────────────────────────────

function ProposalCard({
  invocationId,
  proposal,
  confirmEndpoint,
  state,
  onStateChange,
}: {
  invocationId: string
  proposal: ProposalResult
  confirmEndpoint: string
  state: ProposalState
  onStateChange: (id: string, next: ProposalState) => void
}) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleConfirm = async () => {
    onStateChange(invocationId, 'confirming')
    setErrorMsg(null)
    try {
      const res = await fetch(confirmEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: proposal.action,
          params: proposal.params,
          reason: proposal.reason,
        }),
      })
      const data: { success: boolean; message?: string } = await res.json()
      if (data.success) {
        onStateChange(invocationId, 'confirmed')
      } else {
        setErrorMsg(data.message ?? 'Confirmation failed.')
        onStateChange(invocationId, 'pending')
      }
    } catch {
      setErrorMsg('Network error — please try again.')
      onStateChange(invocationId, 'pending')
    }
  }

  const handleReject = () => onStateChange(invocationId, 'rejected')

  if (state === 'confirmed') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-emerald-300">{proposal.displayTitle}</p>
          <p className="text-xs text-white/40 mt-0.5">Applied — recorded in audit trail</p>
        </div>
      </div>
    )
  }

  if (state === 'rejected') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border bg-white/5 border-white/10 opacity-50">
        <XCircle className="h-3.5 w-3.5 text-white/30 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/40">{proposal.displayTitle}</p>
          <p className="text-xs text-white/25 mt-0.5">Rejected — no changes made</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-500/20 bg-violet-500/10">
        <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
        <span className="text-xs font-semibold text-violet-300">Coach Proposal</span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        <p className="text-xs font-semibold text-white/90">{proposal.displayTitle}</p>
        <div className="text-xs text-white/60 leading-relaxed">
          {renderMarkdown(proposal.displayBody)}
        </div>
        {proposal.reason && (
          <p className="text-xs text-white/35 leading-relaxed border-t border-white/5 pt-1.5 mt-1.5">
            Reason: {proposal.reason}
          </p>
        )}
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 pt-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {errorMsg}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-violet-500/20">
        <button
          onClick={handleConfirm}
          disabled={state === 'confirming'}
          className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-40"
        >
          {state === 'confirming' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3" />
          )}
          Confirm
        </button>
        <button
          onClick={handleReject}
          disabled={state === 'confirming'}
          className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md bg-white/5 border border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          <XCircle className="h-3 w-3" />
          Reject
        </button>
      </div>
    </div>
  )
}

// ── ToolInvocationPart renderer ──────────────────────────────────────────────

function ToolInvocationRenderer({
  part,
  confirmEndpoint,
  proposalStates,
  onProposalStateChange,
}: {
  part: {
    type: 'tool-invocation'
    toolInvocationId: string
    toolName: string
    state: string
    result?: ToolResult
  }
  confirmEndpoint?: string
  proposalStates: Record<string, ProposalState>
  onProposalStateChange: (id: string, next: ProposalState) => void
}) {
  const isPending = part.state === 'call' || part.state === 'partial-call'

  if (isPending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/40">
        <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin" />
        <span>Running {part.toolName}…</span>
      </div>
    )
  }

  const result = part.result

  // Generative UI: render interactive plan preview for draft_running_plan results
  if (
    part.toolName === 'draft_running_plan' &&
    result &&
    'draftedSessions' in result &&
    Array.isArray((result as Record<string, unknown>).draftedSessions)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <PlanDraftPreview draftedSessions={(result as any).draftedSessions} />
  }

  if (result && 'type' in result && result.type === 'proposal' && confirmEndpoint) {
    const proposalState = proposalStates[part.toolInvocationId] ?? 'pending'
    return (
      <ProposalCard
        invocationId={part.toolInvocationId}
        proposal={result as ProposalResult}
        confirmEndpoint={confirmEndpoint}
        state={proposalState}
        onStateChange={onProposalStateChange}
      />
    )
  }

  if (result && 'type' in result && result.type === 'error') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg border bg-red-500/5 border-red-500/20 text-xs">
        <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
        <p className="text-red-300">{(result as ErrorResult).message}</p>
      </div>
    )
  }

  if (result && 'success' in result && result.success === true && 'message' in result) {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg border bg-emerald-500/5 border-emerald-500/20 text-xs">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-emerald-300">{result.message as string}</p>
      </div>
    )
  }

  if (result && 'success' in result && result.success === false && 'message' in result) {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg border bg-red-500/5 border-red-500/20 text-xs">
        <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
        <p className="text-red-300">{result.message as string}</p>
      </div>
    )
  }

  return null
}

// ── Extract plain text from v6 UIMessage parts ───────────────────────────────

function getMessageText(msg: UIMessage): string {
  const textPart = msg.parts.find((p) => p.type === 'text')
  return textPart && 'text' in textPart ? textPart.text : ''
}

// ── Main component ───────────────────────────────────────────────────────────

export function CoachChat({
  apiEndpoint,
  title,
  subtitle,
  placeholder = 'Ask your coach…',
  accentClass = 'text-indigo-400',
  accentBgClass = 'bg-indigo-400/10',
  accentBorderClass = 'border-indigo-400/20',
  extraBody = {},
  confirmEndpoint,
  sessionId,
  initialMessages,
  suggestionChips,
  messagesMaxHeightClass = 'max-h-96',
}: CoachChatProps) {
  const [input, setInput] = useState('')
  const [proposalStates, setProposalStates] = useState<Record<string, ProposalState>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  // Merge sessionId into body if provided
  const body = sessionId ? { ...extraBody, sessionId } : extraBody

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: apiEndpoint, body }),
    initialMessages,
  })

  const isLoading = status === 'submitted' || status === 'streaming'
  const hasMessages = messages.length > 0

  // Update messages when initialMessages changes (e.g. history loads after mount)
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleProposalStateChange = useCallback((id: string, next: ProposalState) => {
    setProposalStates((prev) => ({ ...prev, [id]: next }))
  }, [])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage({ text })
  }

  const handleChipClick = (chip: string) => {
    setInput(chip)
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
      <div className={`flex-1 overflow-y-auto ${messagesMaxHeightClass} px-5 py-4 space-y-4 min-h-[120px]`}>
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-center">
            <Bot className={`h-8 w-8 ${accentClass} opacity-40`} />
            <p className="text-xs text-white/30">Ask a question to start your coaching session</p>
          </div>
        )}

        {messages.map((msg) => {
          const text = getMessageText(msg)

          const toolParts = msg.parts.filter(
            (p) => p.type === 'tool-invocation'
          ) as Array<{
            type: 'tool-invocation'
            toolInvocationId: string
            toolName: string
            state: string
            result?: ToolResult
          }>

          const hasContent = text || toolParts.length > 0
          if (!hasContent) return null

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-0.5 ${accentBgClass} border ${accentBorderClass}`}
                >
                  <Bot className={`h-3 w-3 ${accentClass}`} />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 space-y-2.5 ${
                  msg.role === 'user'
                    ? 'bg-white/10 border border-white/10'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm text-white/80">{text}</p>
                ) : (
                  <>
                    {toolParts.map((tp) => (
                      <ToolInvocationRenderer
                        key={tp.toolInvocationId}
                        part={tp}
                        confirmEndpoint={confirmEndpoint}
                        proposalStates={proposalStates}
                        onProposalStateChange={handleProposalStateChange}
                      />
                    ))}
                    {text && <div className="space-y-1">{renderMarkdown(text)}</div>}
                  </>
                )}
              </div>
            </div>
          )
        })}

        {isLoading &&
          (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant') && (
            <div className="flex gap-3 justify-start">
              <div
                className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${accentBgClass} border ${accentBorderClass}`}
              >
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

      {/* Suggestion chips (shown when no messages) */}
      {!hasMessages && suggestionChips && suggestionChips.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
            >
              {chip}
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
