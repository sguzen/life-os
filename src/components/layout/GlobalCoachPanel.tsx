'use client'

// GlobalCoachPanel — persistent floating Life Coach accessible from any page.
// Session ID is stored in sessionStorage so the panel and /coach page share context.

import { useState, useEffect } from 'react'
import { Brain, X, ChevronRight } from 'lucide-react'
import { CoachChat } from '@/components/ai/coach-chat'
import type { UIMessage } from 'ai'

const SESSION_STORAGE_KEY = 'life-os-coach-session-id'

const SUGGESTION_CHIPS = [
  'How am I doing this week?',
  'Pause my iron supplement',
  'What changes were made recently?',
  'Am I on track for Belgrade?',
  'Connect my trading results to my recovery data',
  'Which habits are failing?',
]

// ── History row from GET /api/ai/coach/history ───────────────────────────────
interface HistoryRow {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

function rowToUIMessage(row: HistoryRow): UIMessage {
  return {
    id: row.id,
    role: row.role,
    parts: [{ type: 'text', text: row.content }],
    // @ts-expect-error – content field required by some internal AI SDK paths
    content: row.content,
  }
}

export function GlobalCoachPanel() {
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>(undefined)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // ── Initialise sessionId from sessionStorage ──────────────────────────────
  useEffect(() => {
    let sid = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid)
    }
    setSessionId(sid)
  }, [])

  // ── Load history when panel opens for the first time ─────────────────────
  useEffect(() => {
    if (!open || historyLoaded) return

    fetch('/api/ai/coach/history')
      .then((res) => res.json())
      .then((data: { messages: HistoryRow[] }) => {
        const uiMessages = (data.messages ?? []).map(rowToUIMessage)
        setInitialMessages(uiMessages)
        setHistoryLoaded(true)
      })
      .catch(() => {
        // History load failure is non-fatal; chat still works without it
        setHistoryLoaded(true)
      })
  }, [open, historyLoaded])

  // ── Keyboard shortcut: Escape closes panel ────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Life Coach"
        className={`
          fixed bottom-6 right-6 z-40
          flex items-center gap-2
          rounded-full border border-violet-500/30 bg-[#0a0a0a] px-4 py-3
          text-sm font-medium text-violet-300
          shadow-lg shadow-violet-900/20
          transition-all duration-200
          hover:bg-violet-500/10 hover:border-violet-500/50 hover:shadow-violet-900/40
          ${open ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}
      >
        <Brain className="h-4 w-4 text-violet-400" />
        <span className="hidden sm:inline">Life Coach</span>
      </button>

      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Side panel */}
      <div
        className={`
          fixed top-0 right-0 z-50 h-screen w-full sm:w-[500px]
          flex flex-col
          border-l border-white/8 bg-[#0a0a0a]
          shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Panel header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Life Coach</span>
            <span className="text-xs text-white/30">· all modules</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/30 hover:text-white/70 transition-colors"
            aria-label="Close coach panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel body — CoachChat fills available height */}
        <div className="flex-1 overflow-hidden p-4">
          {open && (
            <div className="h-full flex flex-col">
              <CoachChat
                apiEndpoint="/api/ai/coach"
                title="Life OS Coach"
                subtitle="Gemini · all modules · can make changes"
                placeholder="Ask about any module, or request a change…"
                accentClass="text-violet-400"
                accentBgClass="bg-violet-500/10"
                accentBorderClass="border-violet-500/20"
                sessionId={sessionId}
                initialMessages={initialMessages}
                suggestionChips={SUGGESTION_CHIPS}
                messagesMaxHeightClass="max-h-[calc(100vh-260px)]"
              />
            </div>
          )}
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setOpen(false)}
          className="shrink-0 flex items-center justify-center gap-1.5 border-t border-white/8 py-3 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          Close panel
        </button>
      </div>
    </>
  )
}
