// P5-02: Running Coach — streaming API route
// Uses Gemini Pro to provide personalised running coaching

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { createClient } from '@/lib/supabase/server'
import {
  RUNNING_COACH_SYSTEM_PROMPT,
  buildRunningContext,
} from '@/lib/ai/coaching'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { messages, includeData = true } = await req.json()

  let contextBlock = ''

  if (includeData) {
    try {
      const supabase = createClient()

      const [activitiesRes, hrRes, racesRes] = await Promise.all([
        supabase
          .from('running_activities')
          .select('workout_type, distance_meters, duration_seconds, avg_pace_sec_per_km, avg_hr, max_hr, started_at, title')
          .order('started_at', { ascending: false })
          .limit(10),
        supabase
          .from('resting_hr_logs')
          .select('log_date, bpm, is_spike')
          .order('log_date', { ascending: false })
          .limit(7),
        supabase
          .from('race_targets')
          .select('name, race_date, target_time_seconds')
          .order('race_date', { ascending: true }),
      ])

      contextBlock = buildRunningContext({
        activities: activitiesRes.data ?? [],
        recentRestingHr: hrRes.data ?? [],
        races: racesRes.data ?? [],
      })
    } catch {
      // Non-fatal — coach can still reply without data
      contextBlock = '(Training data unavailable — coaching from message context only.)'
    }
  }

  const systemWithContext = contextBlock
    ? `${RUNNING_COACH_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`
    : RUNNING_COACH_SYSTEM_PROMPT

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
