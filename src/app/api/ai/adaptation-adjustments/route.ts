// Adaptation Adjustments — generates concrete week plan changes as JSON

import { geminiFlash, geminiPro } from '@/lib/ai/google-model'
import { generateText } from 'ai'
import { saveProposalsAsAdjustments } from '@/lib/supabase/adapt'
import type { AdaptationProposals } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADJUSTMENTS_SYSTEM_PROMPT = `You are generating a concrete week adjustment plan for a marathon runner.
Return ONLY valid JSON, no preamble, no markdown fences.

ATHLETE: Silviya, 43F. Belgrade Marathon April 19, 2026. Limassol Half Marathon March 22.
Baseline RHR: 42-49 bpm. Easy pace target: 6:10-6:30/km.

ADJUSTMENT RULES:

ILLNESS severity 1-2:
  - Convert hard sessions (VO2, TEMPO, HILLS) → EASY @ 6:30/km, reduce km 30%
  - Keep easy runs or reduce 20%
  - Keep long run if Sunday AND feeling better by Saturday
  - Nutrition: +200-300 kcal, warm soups/legumes, +500ml water, ginger/turmeric

ILLNESS severity 3:
  - Today + tomorrow: REST
  - Remaining week: EASY only @ 6:30/km, max 6km per session
  - Skip strength training
  - Nutrition: +300-400 kcal, soft/warm foods, 3L water, B12/Vit C/Zinc

ILLNESS severity 4-5 / FEVER:
  - Full week: REST. No running.
  - Nutrition: high calories easy-to-digest, 3L+ water, electrolytes
  - Trading: no trading

INJURY severity 1-2 (running only):
  - Convert runs to EASY, reduce pace 30-45 sec/km
  - No strength targeting affected area
  - Nutrition: anti-inflammatory (turmeric, omega-3)

INJURY severity 3+ or pain at rest:
  - All runs: REST
  - Nutrition: anti-inflammatory, extra protein

FATIGUE / OVERTRAINING:
  - Hard sessions → EASY or REST
  - Long run → reduce 40% OR convert to easy
  - Extra rest day
  - Nutrition: +carbs, recovery snacks, 3L water

POOR SLEEP single night <5h:
  - Hard session today → EASY or skip
  - Rest of week unchanged unless sleep continues
  - Trading: reduced readiness today only

POOR SLEEP pattern 2+ nights: treat as FATIGUE protocol

Return JSON matching EXACTLY this structure:
{
  "summary": "string",
  "marathon_adjustments": [
    {
      "date": "YYYY-MM-DD",
      "original_type": "TEMPO",
      "original_description": "string",
      "original_km": 13,
      "adjusted_type": "REST",
      "adjusted_description": "string",
      "adjusted_km": 0,
      "reasoning": "string"
    }
  ],
  "nutrition_adjustments": [
    {
      "date": "YYYY-MM-DD",
      "water_target_ml": 3000,
      "calorie_modifier": "+300",
      "meal_modifications": {
        "breakfast": "string or null",
        "lunch": "string or null",
        "snack1": "string or null",
        "snack2": "string or null",
        "snack3": "string or null",
        "snack4": "string or null"
      },
      "supplement_additions": ["Zinc"],
      "foods_to_prioritise": ["lentil soup"],
      "foods_to_avoid": ["alcohol"],
      "reasoning": "string"
    }
  ],
  "trading_adjustments": [
    {
      "date": "YYYY-MM-DD",
      "gate_recommendation": "observation_only",
      "reasoning": "string"
    }
  ],
  "recovery_plan": {
    "daily_checkin_required": true,
    "return_to_normal_criteria": "string",
    "estimated_return_date": "YYYY-MM-DD"
  }
}`

export async function POST(req: Request) {
  try {
    const { eventId, triggerData, triageResult, remainingWeekPlan } = await req.json()

    if (!eventId || !triggerData) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    const sunday = getSundayOfWeek(today)

    const prompt = buildPrompt({ triggerData, triageResult, remainingWeekPlan, today, sunday })

    const { text } = await generateText({
      model: geminiPro(),
      system: ADJUSTMENTS_SYSTEM_PROMPT,
      prompt,
      maxTokens: 2048,
      temperature: 0.2,
    })

    // Parse and validate JSON
    let proposals: AdaptationProposals
    try {
      proposals = JSON.parse(text) as AdaptationProposals
    } catch {
      // Try to extract JSON from response if there's wrapping text
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Invalid JSON response from AI')
      proposals = JSON.parse(match[0]) as AdaptationProposals
    }

    // Save proposals as adjustment rows in DB
    await saveProposalsAsAdjustments(eventId, proposals)

    return Response.json({ proposals })
  } catch (err) {
    console.error('Adaptation adjustments error:', err)
    return Response.json({ error: 'Failed to generate adjustments' }, { status: 500 })
  }
}

function buildPrompt(ctx: {
  triggerData: Record<string, unknown>
  triageResult?: string
  remainingWeekPlan?: unknown[]
  today: string
  sunday: string
}): string {
  const lines: string[] = [
    `TODAY: ${ctx.today}`,
    `WEEK ENDS: ${ctx.sunday}`,
    '',
    'TRIGGER:',
    `  Type: ${ctx.triggerData.trigger_type}`,
    `  Severity: ${ctx.triggerData.severity}/5`,
  ]

  if (ctx.triggerData.symptoms) lines.push(`  Symptoms: ${ctx.triggerData.symptoms}`)
  if (ctx.triggerData.affected_body_part) lines.push(`  Affected area: ${ctx.triggerData.affected_body_part}`)
  if (ctx.triggerData.sleep_hours) lines.push(`  Sleep: ${ctx.triggerData.sleep_hours}h`)
  if (ctx.triggerData.resting_hr) lines.push(`  Morning RHR: ${ctx.triggerData.resting_hr} bpm`)
  if (ctx.triggerData.estimated_days) lines.push(`  Expected duration: ${ctx.triggerData.estimated_days} days`)

  if (ctx.triageResult) {
    lines.push('', 'AI TRIAGE:', ctx.triageResult)
  }

  if (ctx.remainingWeekPlan && ctx.remainingWeekPlan.length > 0) {
    lines.push('', 'REMAINING WEEK SESSIONS:')
    lines.push(JSON.stringify(ctx.remainingWeekPlan, null, 2))
  } else {
    lines.push('', 'REMAINING WEEK SESSIONS: Not provided — generate adjustments for today through Sunday based on typical marathon training week.')
  }

  lines.push('', 'Generate the adjustment plan as JSON only.')

  return lines.join('\n')
}

function getSundayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}
