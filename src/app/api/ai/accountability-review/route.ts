// Accountability Review — AI post-trade analysis

import { geminiFlash, geminiPro } from '@/lib/ai/google-model'
import { streamText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { formData, planData } = await req.json()

  const systemPrompt = `You are reviewing a completed trade for a funded day-trader.
Known failure patterns: revenge trading after losses, external influence changing plan mid-trade.
Review the execution vs the original plan. Be specific about:
1. ADHERENCE: Did execution match plan?
2. LEAK IDENTIFIED: What was the #1 mistake (if any)?
3. PATTERN FLAG: Is this a recurring issue? (external influence, premature entry, ignored stop)
4. NEXT TRADE READINESS: Yes/No + reason
Max 120 words. Brutal honesty.`

  const userMessage = `Original Plan:
Instrument: ${planData?.instrument ?? 'N/A'}
Direction: ${planData?.direction ?? 'N/A'}
Setup: ${planData?.setup_type ?? 'N/A'}
Entry zone: ${planData?.pd_array ?? 'N/A'}
Confluence: ${planData?.confluence ?? 'N/A'}
Planned entry: ${planData?.entry_price ?? 'N/A'}
Planned SL: ${planData?.stop_loss ?? 'N/A'}
Planned risk: $${planData?.risk_dollars ?? 'N/A'}

Actual Execution:
Outcome: ${formData.outcome}
Actual entry: ${formData.actual_entry ?? 'N/A'}
Actual exit: ${formData.actual_exit ?? 'N/A'}
P&L: $${formData.actual_pnl ?? 'N/A'}
Execution quality: ${formData.execution_quality}/10
Followed plan: ${formData.followed_plan ? 'Yes' : 'No'}
External influence: ${formData.external_influence ? `Yes — ${formData.external_influence_details}` : 'No'}
What went right: ${formData.what_went_right || 'Nothing noted'}
What went wrong: ${formData.what_went_wrong || 'Nothing noted'}
Lesson: ${formData.lesson || 'None written'}`

  const result = streamText({
    model: geminiPro(),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 350,
    temperature: 0.6,
  })

  return result.toTextStreamResponse()
}
