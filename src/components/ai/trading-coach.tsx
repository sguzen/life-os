'use client'

// P5-04: Trading Coach chat component
// Gemini-powered with ICT methodology context + recent trade data

import { CoachChat } from './coach-chat'

export function TradingCoach() {
  return (
    <CoachChat
      apiEndpoint="/api/ai/trading-coach"
      title="Trading Coach"
      subtitle="Gemini · ICT methodology · Prop firm challenges"
      placeholder="Review my last 5 trades — am I following the 2-trade rule?"
      accentClass="text-emerald-400"
      accentBgClass="bg-emerald-400/10"
      accentBorderClass="border-emerald-400/20"
    />
  )
}
