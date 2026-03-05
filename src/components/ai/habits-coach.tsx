'use client'

// P5-05: Habits Coach chat component
// Gemini-powered with habit tracking context (last 14 days)

import { CoachChat } from './coach-chat'

export function HabitsCoach() {
  return (
    <CoachChat
      apiEndpoint="/api/ai/habits-coach"
      title="Habits Coach"
      subtitle="Gemini · 14-day habit analysis"
      placeholder="Which habits am I slipping on? What patterns do you see?"
      accentClass="text-violet-400"
      accentBgClass="bg-violet-400/10"
      accentBorderClass="border-violet-400/20"
    />
  )
}
