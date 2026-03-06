'use client'

// Nutrition & Supplement Coach chat component
// Gemini-powered with supplement adherence + nutrition log context

import { CoachChat } from './coach-chat'

export function NutritionCoach() {
  return (
    <CoachChat
      apiEndpoint="/api/ai/nutrition-coach"
      title="Nutrition Coach"
      subtitle="Gemini · supplements &amp; adherence analysis"
      placeholder="How's my supplement adherence? Any patterns in my nutrition this week?"
      accentClass="text-emerald-400"
      accentBgClass="bg-emerald-400/10"
      accentBorderClass="border-emerald-400/20"
    />
  )
}
