'use client'

// P5-03: Running Coach chat component
// Gemini-powered with athlete profile + recent training context

import { CoachChat } from './coach-chat'

export function RunningCoach() {
  return (
    <CoachChat
      apiEndpoint="/api/ai/running-coach"
      title="Running Coach"
      subtitle="Gemini · Belgrade Marathon prep · 3:32 target"
      placeholder="How was my easy run pace this week? Am I on track for Belgrade?"
      accentClass="text-indigo-400"
      accentBgClass="bg-indigo-400/10"
      accentBorderClass="border-indigo-400/20"
    />
  )
}
