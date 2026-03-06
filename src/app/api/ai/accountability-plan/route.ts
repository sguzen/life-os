// Accountability Plan — AI review of trade plan before execution

import { google } from '@ai-sdk/google'
import { streamText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { formData, challengeConfig, images } = await req.json()

  const challengeContext = challengeConfig
    ? `Challenge: ${challengeConfig.name} | Daily loss limit: $${challengeConfig.daily_loss_limit} | Max drawdown: $${challengeConfig.max_drawdown}`
    : 'No active challenge configured.'

  const systemPrompt = `You are an elite trading coach reviewing a trade plan before execution.
${challengeContext}
Trader's known issue: goes faster/more aggressive than planned. She has a pattern of entering before full confirmation and ignoring pre-defined stop levels.
ICT/SMC methodology. Cyprus EET timezone.
Review:
1. PLAN VALIDITY: Is the setup logically sound?
2. RISK CHECK: Is the risk within challenge limits?
3. EXECUTION REMINDERS: Specific things to watch
4. ONE WARNING: The most likely mistake she'll make on this specific setup
Be direct. Max 150 words.`

  const userMessage = `Trade Plan #${formData.plan_number}:
Instrument: ${formData.instrument}
Direction: ${formData.direction}
Session: ${formData.session_window}
HTF Bias: ${formData.htf_bias}
Setup Type: ${formData.setup_type}
PD Array / Entry Zone: ${formData.pd_array}
Confluence: ${formData.confluence}
Entry: ${formData.entry_price ?? 'not set'}
Stop Loss: ${formData.stop_loss ?? 'not set'}
Target 1: ${formData.target_1 ?? 'not set'}
Target 2: ${formData.target_2 ?? 'not set'}
Risk: $${formData.risk_dollars ?? 'not set'}
Conviction Lock: ${formData.conviction_lock ? 'YES — committed to ignore external input' : 'No'}`

  const messages: Array<{ role: 'user'; content: string | Array<{ type: string; text?: string; image?: string }> }> = []

  if (images && images.length > 0) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userMessage },
        ...images.map((img: string) => ({ type: 'image', image: img })),
      ],
    })
  } else {
    messages.push({ role: 'user', content: userMessage })
  }

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages,
    maxOutputTokens: 400,
    temperature: 0.6,
  })

  return result.toTextStreamResponse()
}
