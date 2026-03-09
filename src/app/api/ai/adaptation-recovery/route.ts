// Adaptation Recovery — AI recommendation from daily check-in

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createRecoveryCheckin } from '@/lib/supabase/adapt'

export const runtime = 'nodejs'
export const maxDuration = 30

const RECOVERY_SYSTEM_PROMPT = `You are assessing daily recovery progress for a marathon runner.
Be direct. Return ONLY a JSON object with this structure:
{
  "recommendation": "continue_modified" | "return_to_normal" | "extend_adaptation",
  "message": "1-2 sentence explanation",
  "ready_for_normal_training": boolean
}

CRITERIA:
- return_to_normal: feeling score >= 7 AND no symptoms AND RHR within normal range (42-54 bpm)
- extend_adaptation: feeling score <= 4 OR symptoms present AND high RHR
- continue_modified: everything else

ATHLETE baseline RHR: 42-49 bpm. Elevated = >54 bpm.`

export async function POST(req: Request) {
  try {
    const { eventId, checkinData } = await req.json()

    if (!eventId || !checkinData) {
      return Response.json({ error: 'Missing eventId or checkinData' }, { status: 400 })
    }

    const { feeling_score, symptoms_present, resting_hr, notes, trigger_type, severity, day_number } = checkinData

    const prompt = [
      `TRIGGER: ${trigger_type} (severity ${severity}/5)`,
      `RECOVERY DAY: ${day_number ?? 1}`,
      `FEELING SCORE: ${feeling_score}/10`,
      `SYMPTOMS PRESENT: ${symptoms_present ? 'Yes' : 'No'}`,
      resting_hr ? `RESTING HR: ${resting_hr} bpm` : 'RESTING HR: Not provided',
      notes ? `NOTES: ${notes}` : '',
    ].filter(Boolean).join('\n')

    const { text } = await generateText({
      model: google('gemini-2.5-pro'),
      system: RECOVERY_SYSTEM_PROMPT,
      prompt,
      maxTokens: 256,
      temperature: 0.2,
    })

    let recommendation: { recommendation: string; message: string; ready_for_normal_training: boolean }
    try {
      recommendation = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Invalid JSON from AI')
      recommendation = JSON.parse(match[0])
    }

    // Save check-in to DB with AI recommendation
    const today = new Date().toISOString().split('T')[0]
    await createRecoveryCheckin({
      event_id: eventId,
      checkin_date: checkinData.checkin_date ?? today,
      feeling_score,
      symptoms_present: symptoms_present ?? false,
      resting_hr: resting_hr ?? null,
      notes: notes ?? null,
      ai_recommendation: recommendation.recommendation,
    })

    return Response.json({ recommendation })
  } catch (err) {
    console.error('Adaptation recovery error:', err)
    return Response.json({ error: 'Failed to process check-in' }, { status: 500 })
  }
}
