// Accountability Gate — AI coaching for pre-session readiness check

import { geminiFlash, geminiPro } from '@/lib/ai/google-model'
import { streamText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { formData, challengeConfig } = await req.json()

  const challengeContext = challengeConfig
    ? `Active challenge: ${challengeConfig.name} | Account: $${challengeConfig.account_size} | Daily loss limit: $${challengeConfig.daily_loss_limit} | Max drawdown: $${challengeConfig.max_drawdown} | Profit target: $${challengeConfig.profit_target}`
    : 'No active challenge configured.'

  const gateStatus = formData.gate_passed ? 'PASSED' : 'FAILED'
  const failReasons: string[] = []
  if (formData.alcohol_last_night) failReasons.push('alcohol consumed last night')
  if (formData.sleep_hours < 6) failReasons.push(`sleep only ${formData.sleep_hours}h (minimum 6h)`)
  if (formData.physical_score < 5) failReasons.push(`physical score ${formData.physical_score}/10 (minimum 5)`)
  if (formData.emotional_score < 5) failReasons.push(`emotional score ${formData.emotional_score}/10 (minimum 5)`)

  const systemPrompt = `You are a strict trading coach for a professional funded day-trader.
Trading instruments: MNQ, MGC, MES futures.
${challengeContext}
Trader profile: Cyprus timezone (EET), trades 04:00-08:00 local to catch London session.
Known patterns: tends to overtrade, ignores own bias when emotional.
Rules:
- Alcohol night before = OFF. No exceptions.
- Sleep < 6h = reduced risk day maximum (one trade only, half size)
- Emotional < 5 = observation only, no live trading
- Physical < 5 = note it but don't block (physical discomfort is manageable)
STYLE: Direct, brief, no sugarcoating. She won't melt.
For gate PASS: brief readiness statement + 1 specific focus for today.
For gate FAIL: state exactly why + what to do instead.`

  const userMessage = `Gate status: ${gateStatus}
Sleep: ${formData.sleep_hours}h
Physical: ${formData.physical_score}/10
Emotional: ${formData.emotional_score}/10
Alcohol last night: ${formData.alcohol_last_night ? 'Yes' : 'No'}
Notes: ${formData.feeling_notes || 'None'}
${failReasons.length > 0 ? `Fail reasons: ${failReasons.join(', ')}` : ''}`

  const result = streamText({
    model: geminiPro(),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 300,
    temperature: 0.6,
  })

  return result.toTextStreamResponse()
}
