// P5-02: Trading Coach — streaming API route
// Uses Gemini Pro to provide personalised ICT trading coaching

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { createClient } from '@/lib/supabase/server'
import {
  TRADING_COACH_SYSTEM_PROMPT,
  buildTradingContext,
} from '@/lib/ai/coaching'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { messages, includeData = true, days = 30 } = await req.json()

  let contextBlock = ''

  if (includeData) {
    try {
      const supabase = createClient()
      const since = new Date()
      since.setDate(since.getDate() - days)

      const { data: trades } = await supabase
        .from('trades')
        .select(
          'instrument, direction, entry_time, gross_pnl, net_pnl, outcome, session, setup_tags, confluence_notes, followed_rules, pre_emotion, post_emotion, lessons'
        )
        .gte('entry_time', since.toISOString())
        .order('entry_time', { ascending: false })

      contextBlock = buildTradingContext({
        trades: trades ?? [],
        periodLabel: `Last ${days} days`,
      })
    } catch {
      contextBlock = '(Trade data unavailable — coaching from message context only.)'
    }
  }

  const systemWithContext = contextBlock
    ? `${TRADING_COACH_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`
    : TRADING_COACH_SYSTEM_PROMPT

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemWithContext,
    messages: modelMessages,
    maxOutputTokens: 1024,
    temperature: 0.7,
  })

  return result.toUIMessageStreamResponse()
}
