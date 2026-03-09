'use client'

// /coach — Full-screen Life Coach page.
// Uses the same CoachChat component and sessionId as GlobalCoachPanel so
// conversations are continuous between the floating panel and this page.

import { useState, useEffect } from 'react'
import { Bot, Pill, Settings, TrendingUp, Activity, BarChart2 } from 'lucide-react'
import { CoachChat } from '@/components/ai/coach-chat'
import { MorningCheckin } from '@/components/morning/MorningCheckin'
import type { UIMessage } from 'ai'

const SESSION_STORAGE_KEY = 'life-os-coach-session-id'

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

const SUGGESTION_CHIPS = [
  'How am I doing this week?',
  'Pause my iron supplement',
  'What changes were made recently?',
  'Am I on track for Belgrade?',
  'Connect my trading results to my recovery data',
  'Which habits are failing?',
  'Am I in the right state to trade today?',
  'Is my resting HR elevated? Should I rest?',
]

const CAPABILITIES = [
  { icon: Activity, label: 'Running', desc: 'Pace analysis, HR trends, race prep' },
  { icon: Pill, label: 'Supplements', desc: 'Pause, resume, timing guidance' },
  { icon: TrendingUp, label: 'Marathon', desc: 'Training sessions, week reviews' },
  { icon: Settings, label: 'Plan Configs', desc: 'Adjust paces, targets, thresholds' },
  { icon: BarChart2, label: 'Nutrition', desc: 'Adherence scores, hydration, violations' },
  { icon: Bot, label: 'Habits', desc: 'Streak tracking, completion rates' },
]

export default function CoachPage() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>(undefined)

  useEffect(() => {
    // Share sessionId with GlobalCoachPanel via sessionStorage
    let sid = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid)
    }
    setSessionId(sid)

    fetch('/api/ai/coach/history')
      .then((res) => res.json())
      .then((data: { messages: HistoryRow[] }) => {
        setInitialMessages((data.messages ?? []).map(rowToUIMessage))
      })
      .catch(() => {
        // Non-fatal — chat still works without pre-populated history
      })
  }, [])

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-5 w-5 text-violet-400" />
          <h1 className="text-xl font-semibold text-white">Life OS Coach</h1>
        </div>
        <p className="text-sm text-white/40">
          Full-system AI coach with visibility across all modules.
          Ask questions or request changes — it can pause supplements, update plan configs, and more.
        </p>
      </div>

      {/* Morning Check-In */}
      <MorningCheckin />

      {/* Capabilities grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CAPABILITIES.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex flex-col gap-1.5 px-3 py-3 rounded-lg bg-white/5 border border-white/10"
          >
            <Icon className="h-4 w-4 text-violet-400/70" />
            <p className="text-xs font-medium text-white/70">{label}</p>
            <p className="text-[11px] text-white/30 leading-snug">{desc}</p>
          </div>
        ))}
      </div>

      {/* Coach chat — full width, taller message area for the dedicated page */}
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
        messagesMaxHeightClass="max-h-[520px]"
      />
    </div>
  )
}
