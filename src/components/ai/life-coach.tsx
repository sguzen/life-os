'use client'

// Global Life Coach — holistic cross-module chat with module focus selector
// Uses CoachChat with proposal cards; changes require user Confirm before DB write.

import { useState } from 'react'
import { Brain } from 'lucide-react'
import { CoachChat } from './coach-chat'

const MODULES = [
  { value: 'general', label: 'Overview' },
  { value: 'trading', label: 'Trading' },
  { value: 'running', label: 'Running' },
  { value: 'habits', label: 'Habits' },
  { value: 'supplements', label: 'Supplements' },
] as const

type Module = (typeof MODULES)[number]['value']

const SUGGESTION_CHIPS: Record<Module, string[]> = {
  general: [
    'How am I doing across all systems?',
    'What patterns do you see this week?',
    'Where is my biggest risk right now?',
  ],
  trading: [
    'Connect my trading results to my recovery data',
    'Change my daily profit target to $200',
    'Am I in the right state to trade today?',
  ],
  running: [
    'Is my resting HR elevated? Should I rest?',
    'Am I on track for Belgrade?',
    'Adjust my easy pace range',
  ],
  habits: [
    'Which habits are failing this week?',
    'How do my habits correlate with trading outcomes?',
    'What should I fix first?',
  ],
  supplements: [
    'Which supplements have I missed today?',
    'Add 5g Creatine daily post-workout',
    'Pause my iron supplement temporarily',
  ],
}

export function LifeCoach() {
  const [focusModule, setFocusModule] = useState<Module>('general')

  return (
    <div className="space-y-3">
      {/* Module focus selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-white/40 shrink-0">
          <Brain className="h-3.5 w-3.5 text-violet-400" />
          Focus:
        </div>
        {MODULES.map((m) => (
          <button
            key={m.value}
            onClick={() => setFocusModule(m.value)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              focusModule === m.value
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Suggestion chips (shown before first message via extraBody watch) */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTION_CHIPS[focusModule].map((chip) => (
          <span
            key={chip}
            className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/35 select-none"
          >
            {chip}
          </span>
        ))}
      </div>

      <CoachChat
        key={focusModule} // remount on module change to start fresh context
        apiEndpoint="/api/ai/life-coach"
        confirmEndpoint="/api/ai/life-coach/confirm"
        title="Global Life Coach"
        subtitle={`Holistic · ${focusModule} focus · proposals require your approval`}
        placeholder="Ask me anything — or request a change…"
        accentClass="text-violet-400"
        accentBgClass="bg-violet-500/10"
        accentBorderClass="border-violet-500/20"
        extraBody={{ module: focusModule }}
      />
    </div>
  )
}
