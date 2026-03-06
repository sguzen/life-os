// P5-02 / P5-06: Bulk Trade Analysis — streaming API route
// Uses Gemini 2.0 Flash (long context) to analyse a full month of trades
// This is a one-shot generation (no chat history), optimised for deep analysis

import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { TRADING_COACH_SYSTEM_PROMPT, buildTradingContext } from '@/lib/ai/coaching'

export const runtime = 'nodejs'
export const maxDuration = 120

const BULK_ANALYSIS_PROMPT = `You are performing a comprehensive monthly trade review.

Analyse ALL trades in the dataset provided and produce a structured report with these sections:

## 1. Executive Summary
- Overall performance (P&L, win rate, key stats)
- Best and worst sessions
- Rule compliance rate

## 2. Pattern Analysis
- Which setups (OB, FVG, BOS, etc.) are performing best and worst?
- Which instruments and sessions are most/least profitable?
- Time-of-day patterns in wins vs losses

## 3. Discipline Review
- Trades where rules were broken — what happened and why?
- Emotional patterns (pre/post mood) and correlation to outcomes
- Over-trading instances (>2 trades per session)

## 4. Key Insights
- Top 3 strengths to maintain
- Top 3 areas needing improvement
- Specific rule adjustments to consider

## 5. Action Plan for Next Month
- 3–5 specific, measurable commitments
- One thing to START doing, one to STOP doing

Be data-driven, direct, and specific. Reference actual trade dates and instruments.`

export async function POST(req: Request) {
  const { month, year } = await req.json()

  // Default to current month
  const now = new Date()
  const targetYear = year ?? now.getFullYear()
  const targetMonth = month ?? now.getMonth() + 1

  const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString()
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59).toISOString()

  const monthLabel = new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  let contextBlock = ''
  try {
    const supabase = createClient()

    const { data: trades } = await supabase
      .from('trades')
      .select(
        'instrument, direction, entry_time, exit_time, gross_pnl, net_pnl, fees, outcome, session, setup_tags, confluence_notes, entry_notes, exit_notes, lessons, followed_rules, pre_emotion, post_emotion'
      )
      .gte('entry_time', startDate)
      .lte('entry_time', endDate)
      .order('entry_time', { ascending: true })

    contextBlock = buildTradingContext({
      trades: trades ?? [],
      periodLabel: monthLabel,
    })
  } catch {
    contextBlock = '(Trade data unavailable.)'
  }

  const system = `${TRADING_COACH_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system,
    messages: [
      {
        role: 'user',
        content: `${BULK_ANALYSIS_PROMPT}\n\nAnalyse my ${monthLabel} trading performance.`,
      },
    ],
    maxOutputTokens: 4096,
    temperature: 0.5,
  })

  return result.toDataStreamResponse()
}
