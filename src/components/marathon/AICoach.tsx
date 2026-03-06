'use client'

import { CoachChat } from '@/components/ai/coach-chat'

interface AICoachProps {
  mode?: 'pre' | 'post' | 'chat'
  sessionData?: Record<string, unknown>
  initialPrompt?: string
}

export function AICoach({ mode = 'chat', sessionData, initialPrompt }: AICoachProps) {
  const subtitleMap = {
    pre: 'Pre-session · What to focus on today',
    post: 'Post-session debrief · Pace verdict + feedback',
    chat: 'Belgrade Marathon prep · 3:32 target',
  }

  const placeholderMap = {
    pre: 'What should I focus on today?',
    post: 'How did I do? Any concerns?',
    chat: 'How is my training going? Am I on track for 3:32?',
  }

  return (
    <CoachChat
      apiEndpoint="/api/ai/marathon-coach"
      title="Marathon Coach"
      subtitle={subtitleMap[mode]}
      placeholder={initialPrompt ?? placeholderMap[mode]}
      accentClass="text-orange-400"
      accentBgClass="bg-orange-400/10"
      accentBorderClass="border-orange-400/20"
      extraBody={{ mode, sessionData: sessionData ?? null, includeData: true }}
    />
  )
}
