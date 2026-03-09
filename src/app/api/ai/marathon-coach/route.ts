// Marathon Coach AI — streaming API route
// Strict coaching for Belgrade Marathon prep (Gemini 2.5 Flash)

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { TRAINING_PLAN, getCurrentWeek, getSessionForDate } from '@/lib/marathon/plan'

export const runtime = 'nodejs'
export const maxDuration = 60

const ATHLETE_PROFILE = `
ATHLETE: Silviya, 43F, Cyprus (EET UTC+2). Vegan. Trains fasted 04:00-06:30 EET. Nike Alphafly 3.
A-RACE: Belgrade Marathon April 19, 2026 — TARGET 3:32:00 (5:00/km average).
CHECKPOINT: Limassol Half Marathon March 22 — Target 1:44-1:45 (4:55-5:00/km).
RECENT PRs: Marathon 3:46 Amsterdam Oct 2025 | Half 1:43 Nicosia Jan 2026.
BLOOD DONATION: Week 2 (Feb 23-Mar 1) — iron supplementation daily for 2 weeks after.
GEL RULE: ONLY Maurten or SIS gels — NEVER pre-workout supplements (caused panic attack).
KNOWN PATTERN (CRITICAL): Consistently runs 4-10 sec/km FASTER than prescribed. This is the #1 threat to her plan.
MENTAL: Needs external structure. Collapsed at km 18 Amsterdam when partner left. Belgrade is redemption.
RHR BASELINE: 42-49 bpm. Flag if +5 bpm above recent average.
`.trim()

const TRAINING_PACES = `
PRESCRIBED PACES:
- Easy: 6:10-6:30/km | HR 130-145 bpm
- Goal Marathon Pace (GMP): 5:00/km | HR 165-170 bpm
- Tempo: 4:50-4:55/km | HR 165-175 bpm
- VO2 Max: 4:30-4:40/km | 90%+ max HR
- Hills: effort-based, 85-90% effort (not pace-based)
WARM-UP RULES: Tempo = 2km @ 5:30/km. VO2 Max = 15min easy jog + dynamic stretches + 4×100m strides.
`.trim()

function buildSessionContext(mode: 'pre' | 'post', sessionData: Record<string, unknown>) {
  if (mode === 'pre') {
    return `
MODE: Pre-session coaching
TODAY'S SESSION: ${JSON.stringify(sessionData, null, 2)}

PRE-SESSION coaching (max 120 words):
- Today's ONE focus (be specific)
- Exact pace reminder with numbers
- Warm-up reminder if TEMPO or VO2_MAX
- Any red flags from recent data to watch for
`.trim()
  }
  return `
MODE: Post-session debrief
LOGGED SESSION: ${JSON.stringify(sessionData, null, 2)}

POST-SESSION coaching (max 120 words):
- Pace discipline verdict — did she nail it or go too fast AGAIN?
- Execution quality (warmup done? fueling?)
- One sentence on how this fits the bigger picture
- One specific thing to do differently next time
`.trim()
}

function buildRecentContext(recentSessions: unknown[]) {
  if (!recentSessions.length) return 'No recent sessions logged.'
  return (recentSessions as Array<Record<string, unknown>>)
    .slice(0, 5)
    .map((s) => {
      const pace = s.actual_avg_pace ? `@ ${s.actual_avg_pace}/km` : '(no pace)'
      const flag = s.went_too_fast ? ` ⚠️ TOO FAST (+${s.pace_deviation_sec}s/km)` : ''
      const warmup = s.warmup_done === false && ['TEMPO','VO2_MAX'].includes(s.planned_type as string) ? ' ❌ NO WARMUP' : ''
      return `- ${s.session_date} ${s.planned_type} ${pace} [${s.status}]${flag}${warmup}`
    })
    .join('\n')
}

export async function POST(req: Request) {
  const { messages, mode = 'chat', sessionData, includeData = true } = await req.json()

  const currentWeek = getCurrentWeek()
  const today = new Date().toISOString().split('T')[0]
  const todaySession = getSessionForDate(today)

  let contextBlock = ''

  if (includeData) {
    try {
      const supabase = createClient()

      const [recentRes, rhrRes] = await Promise.all([
        supabase
          .from('training_sessions')
          .select('session_date, planned_type, status, actual_avg_pace, went_too_fast, pace_deviation_sec, warmup_done, resting_hr, perceived_effort')
          .neq('status', 'pending')
          .order('session_date', { ascending: false })
          .limit(5),
        supabase
          .from('resting_hr_logs')
          .select('logged_date, resting_hr, is_spike')
          .order('logged_date', { ascending: false })
          .limit(7),
      ])

      const recentSessions = recentRes.data ?? []
      const rhrLogs = rhrRes.data ?? []

      const rhrSummary = rhrLogs.length
        ? rhrLogs.map((r) => `${r.logged_date}: ${r.resting_hr}bpm${r.is_spike ? ' ⚠️ SPIKE' : ''}`).join(', ')
        : 'No RHR data'

      const tooFastCount = recentSessions.filter((s) => s.went_too_fast).length

      contextBlock = `
CURRENT WEEK: Week ${currentWeek?.weekNumber ?? '?'} — ${currentWeek?.label ?? 'Unknown'} (${TRAINING_PLAN.find(w => w.weekNumber === currentWeek?.weekNumber)?.plannedKm ?? '?'}km planned)
TODAY: ${today} — ${todaySession ? `${todaySession.type}: ${todaySession.description}` : 'No session'}
DAYS TO BELGRADE: ${Math.ceil((new Date('2026-04-19').getTime() - Date.now()) / 86400000)}
DAYS TO LIMASSOL: ${Math.ceil((new Date('2026-03-22').getTime() - Date.now()) / 86400000)}

RECENT SESSIONS (last 5):
${buildRecentContext(recentSessions)}

PACE DISCIPLINE ALERT: ${tooFastCount} of last ${recentSessions.length} sessions went too fast.

RESTING HR (last 7 days): ${rhrSummary}
`.trim()
    } catch {
      contextBlock = '(Training data unavailable — coaching from message context only.)'
    }
  }

  const sessionContext = sessionData
    ? buildSessionContext(mode as 'pre' | 'post', sessionData)
    : ''

  const systemPrompt = `You are a strict marathon coach. No padding. No waffle. Direct feedback only.

${ATHLETE_PROFILE}

${TRAINING_PACES}

COACHING RULES:
1. Call out going too fast EVERY time it happens. No softening.
2. Warmups are non-negotiable for Tempo and VO2 Max — call out skips.
3. Easy pace is 6:10-6:30/km. Not 6:05. Not 6:00. 6:10-6:30.
4. Max 120 words per response unless asked for detail.
5. Style: Direct. Brief. No praise unless genuinely earned.
6. She does not melt from criticism — she needs it.

${contextBlock ? `LIVE TRAINING DATA:\n${contextBlock}` : ''}

${sessionContext}`

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('gemini-2.5-pro'),
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: 600,
    temperature: 0.6,
  })

  return result.toUIMessageStreamResponse()
}
