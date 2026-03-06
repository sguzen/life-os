// Adaptation Triage — AI severity assessment for a reported trigger

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { updateAdaptationEventTriage } from '@/lib/supabase/adapt'

export const runtime = 'nodejs'
export const maxDuration = 60

const TRIAGE_SYSTEM_PROMPT = `You are a sports medicine-aware running coach assessing whether a training adaptation is needed.

ATHLETE: Silviya, 43F, marathon runner. Belgrade Marathon April 19, 2026.
Limassol Half Marathon March 22, 2026 (checkpoint race — cannot miss).
Week 7 (Mar 30) is PEAK WEEK — most important training week.
Current weekly mileage: ~45-55km.

TRIAGE RULES:
- Fever = no running. Non-negotiable.
- Pain at rest = no running until professionally assessed.
- Neck check rule: symptoms above neck only (congestion, mild sore throat) = very easy OK
- Symptoms below neck (chest, body aches, fever, GI) = rest
- Overtraining signs (elevated RHR + fatigue + declining performance) = mandatory deload
- With ~44 days to race, 2-3 rest days now costs nothing. Forced DNS costs everything.

ASSESS the reported trigger and return a structured triage result.

ASSESSMENT FORMAT (respond with this exact structure):
SEVERITY_VERDICT: [1-5] — [brief label]
TRAINING_TODAY: [Full training / Easy only / Very easy only / Rest / Complete rest]
TRAINING_THIS_WEEK: [brief guidance for remaining days]
RISK_ASSESSMENT: [1-2 sentences on risk of training vs resting]
NUTRITION_IMPACT: [specific nutrition adjustments needed]
TRADING_IMPACT: [observation only / reduced / normal]
RECOVERY_TIMELINE: [realistic estimate in days]
SUMMARY: [Direct 2-3 sentence summary. Be honest and direct.]

Be direct. Max 200 words total.`

export async function POST(req: Request) {
  try {
    const { eventId, triggerData } = await req.json()

    if (!eventId || !triggerData) {
      return Response.json({ error: 'Missing eventId or triggerData' }, { status: 400 })
    }

    // Build context from trigger data
    const triggerContext = buildTriggerContext(triggerData)

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: TRIAGE_SYSTEM_PROMPT,
      prompt: `REPORTED TRIGGER:\n${triggerContext}`,
      maxTokens: 512,
      temperature: 0.3,
    })

    // Save triage to DB and update event status
    await updateAdaptationEventTriage(eventId, text)

    return Response.json({ triage: text })
  } catch (err) {
    console.error('Adaptation triage error:', err)
    return Response.json({ error: 'Failed to generate triage' }, { status: 500 })
  }
}

function buildTriggerContext(data: Record<string, unknown>): string {
  const lines: string[] = [
    `Trigger type: ${data.trigger_type}`,
    `Self-reported severity: ${data.severity}/5`,
  ]

  if (data.symptoms) lines.push(`Symptoms: ${data.symptoms}`)
  if (data.affected_body_part) lines.push(`Affected body part: ${data.affected_body_part}`)
  if (data.sleep_hours) lines.push(`Sleep last night: ${data.sleep_hours} hours`)
  if (data.resting_hr) lines.push(`Resting HR this morning: ${data.resting_hr} bpm (baseline 42-49)`)
  if (data.estimated_days) lines.push(`Estimated duration: ${data.estimated_days} day(s)`)
  if (data.notes) lines.push(`Additional notes: ${data.notes}`)

  return lines.join('\n')
}
