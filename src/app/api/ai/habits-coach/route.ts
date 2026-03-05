// P5-02: Habits Coach — streaming API route
// Uses Gemini Pro to provide personalised habit coaching

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { createClient } from '@/lib/supabase/server'
import {
  HABITS_COACH_SYSTEM_PROMPT,
  buildHabitsContext,
} from '@/lib/ai/coaching'
import { getHabitsWithLogs } from '@/lib/supabase/habits'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { messages, includeData = true, days = 14 } = await req.json()

  let contextBlock = ''

  if (includeData) {
    try {
      const supabase = createClient()
      const habits = await getHabitsWithLogs(supabase)

      contextBlock = buildHabitsContext({ habits, periodDays: days })
    } catch {
      contextBlock = '(Habit data unavailable — coaching from message context only.)'
    }
  }

  const systemWithContext = contextBlock
    ? `${HABITS_COACH_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`
    : HABITS_COACH_SYSTEM_PROMPT

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('gemini-1.5-flash'),
    system: systemWithContext,
    messages: modelMessages,
    maxOutputTokens: 1024,
    temperature: 0.7,
  })

  return result.toUIMessageStreamResponse()
}
