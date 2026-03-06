// Nutrition & Supplement Coach — streaming API route
// Uses Gemini to advise on supplement adherence and nutrition patterns

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { createClient } from '@/lib/supabase/server'
import {
  NUTRITION_COACH_SYSTEM_PROMPT,
  buildNutritionCoachContext,
} from '@/lib/ai/coaching'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { messages, includeData = true } = await req.json()

  let contextBlock = ''

  if (includeData) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Fetch active supplements
      const { data: supplements } = await supabase
        .from('supplements')
        .select('name, frequency, timing, prescribed_for, is_paused, pause_reason')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      // Fetch last 14 days of nutrition logs
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 14)
      const { data: nutritionLogs } = await supabase
        .from('nutrition_logs')
        .select('log_date, adherence_score, water_ml, has_alcohol')
        .eq('user_id', user.id)
        .gte('log_date', cutoffDate.toISOString().slice(0, 10))
        .order('log_date', { ascending: false })

      // Check blood donation recovery
      const recoveryDays = 14
      const recoveryCutoff = new Date()
      recoveryCutoff.setDate(recoveryCutoff.getDate() - recoveryDays)
      const { data: recoveryData } = await supabase
        .from('running_activities')
        .select('id')
        .eq('user_id', user.id)
        .eq('blood_donation_recovery', true)
        .gte('started_at', recoveryCutoff.toISOString())
        .limit(1)
        .maybeSingle()

      contextBlock = buildNutritionCoachContext({
        supplements: supplements ?? [],
        recentAdherence: (nutritionLogs ?? []).map((l) => ({
          log_date: l.log_date,
          score: l.adherence_score ?? 0,
          water_ml: l.water_ml ?? null,
          has_alcohol: l.has_alcohol ?? false,
        })),
        bloodDonationRecoveryActive: !!recoveryData,
      })
    } catch {
      contextBlock = '(Nutrition data unavailable — coaching from message context only.)'
    }
  }

  const systemWithContext = contextBlock
    ? `${NUTRITION_COACH_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`
    : NUTRITION_COACH_SYSTEM_PROMPT

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
