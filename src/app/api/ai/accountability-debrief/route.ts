// Accountability Debrief — AI end-of-day summary and coaching

import { google } from '@ai-sdk/google'
import { streamText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { formData, sessionData, challengeConfig } = await req.json()

  const challengeContext = challengeConfig
    ? `Challenge: ${challengeConfig.name} | Daily loss limit: $${challengeConfig.daily_loss_limit} | Max drawdown: $${challengeConfig.max_drawdown}`
    : 'No active challenge.'

  // Build session summary
  const gateInfo = sessionData
    ? `Gate: ${sessionData.gate_passed ? 'PASSED' : 'FAILED'} | Sleep: ${sessionData.sleep_hours}h | Physical: ${sessionData.physical_score}/10 | Emotional: ${sessionData.emotional_score}/10 | Alcohol: ${sessionData.alcohol_last_night ? 'Yes' : 'No'}`
    : 'Gate: not completed'

  const guardrailInfo = sessionData
    ? `Consecutive losses: ${sessionData.consecutive_losses} | Revenge lock triggered: ${sessionData.revenge_lock_triggered ? 'YES' : 'No'} | External influence flagged: ${sessionData.external_influence_flagged ? 'YES' : 'No'}`
    : ''

  const plansInfo = (sessionData?.plans ?? []).map((p: {
    plan_number: number;
    instrument: string;
    direction: string;
    setup_type: string;
    review?: {
      outcome: string;
      actual_pnl: number | null;
      followed_plan: boolean;
      execution_quality: number | null;
      external_influence: boolean;
    } | null;
  }, i: number) => {
    const r = p.review
    return `Plan ${p.plan_number}: ${p.instrument} ${p.direction} (${p.setup_type}) → ${r ? `${r.outcome} $${r.actual_pnl ?? '?'} | Followed plan: ${r.followed_plan ? 'Yes' : 'No'} | Exec quality: ${r.execution_quality}/10 | External influence: ${r.external_influence ? 'Yes' : 'No'}` : 'No review yet'}`
  }).join('\n')

  const systemPrompt = `You are giving an end-of-day debrief to a funded day-trader.
${challengeContext}
Known challenge: building discipline for Belgrade Marathon April 19 while trading funded accounts.
She's in a full life overhaul (diet, alcohol, training, trading all being restructured simultaneously).
Give:
1. SESSION GRADE with one-line reason
2. TOP PATTERN (what was the dominant theme today — good or bad)
3. ONE THING that if fixed would have the highest impact
4. TOMORROW'S RULE (one specific behavioural rule for tomorrow's session)
Max 180 words. No fluff.`

  const userMessage = `Today's Session Data:
${gateInfo}
${guardrailInfo}

Trade Plans:
${plansInfo || 'No trades taken'}

EOD Report:
Net P&L: $${formData.net_pnl}
Trade management: ${formData.trade_management_review}
Emotional state during session: ${formData.emotional_state_score}/10 — ${formData.emotional_state_notes}
Best decision: ${formData.best_decision}
Worst decision: ${formData.worst_decision}
Rule violations: ${formData.rule_violations || 'None'}
Self-grade: ${formData.session_grade}
Tomorrow's focus: ${formData.tomorrows_focus}`

  const result = streamText({
    model: google('gemini-2.5-pro'),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 500,
    temperature: 0.6,
  })

  return result.toTextStreamResponse()
}
