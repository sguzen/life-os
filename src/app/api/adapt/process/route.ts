// POST /api/adapt/process
// Internal server-to-server route — NOT callable by the browser.
// Secured by x-internal-secret header matching CRON_SECRET env var.
// Called fire-and-forget from src/lib/adapt/trigger.ts after an adapt_event is inserted.
// Generates an AI proposal array and persists it to adapt_events.

import { NextResponse } from 'next/server'
import { geminiFlash, geminiPro } from '@/lib/ai/google-model'
import { generateText } from 'ai'
import { createServiceClient } from '@/lib/supabase/service'
// Service client needed — this route has no user session (called server-to-server).
// buildFullSystemContext accepts overrideUserId so service role can build context.
import { buildFullSystemContext } from '@/lib/ai/master-coach'

export const runtime = 'nodejs'
export const maxDuration = 60

const PROPOSAL_SYSTEM = `You are the Life OS plan adaptation engine.
You receive an automated event that crossed a performance or health threshold, plus full system context.
Your job: propose concrete, minimal plan changes to address the event.

Return ONLY a JSON array (no markdown, no explanation) with 1-4 objects:
[
  {
    "module": "running|nutrition|trading|habits|supplements",
    "change_type": "reduce_load|adjust_pace|add_rest|modify_target|pause_item|add_item|other",
    "description": "One clear sentence describing the proposed change",
    "params": { "key": "value" }
  }
]

Rules:
- Minimum changes needed — don't overhaul the plan
- Be specific (reference actual values where possible)
- If the event is a brutal training session, propose the recovery action
- If it's poor sleep, propose a training load reduction or trading size reduction
- If it's a trading loss streak, propose a rule compliance focus or position sizing reduction
- Never propose changes that contradict medical advice
- If you have no useful proposal, return an empty array []`

export async function POST(req: Request) {
  // ── Auth: internal secret ───────────────────────────────────────────────────
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const { eventId, userId } = body ?? {}

  if (!eventId || !userId) {
    return NextResponse.json({ error: 'eventId and userId required' }, { status: 400 })
  }

  // ── Service client (bypasses RLS — no user session here) ───────────────────
  const supabase = createServiceClient()

  // ── Fetch adapt event ───────────────────────────────────────────────────────
  const { data: event, error: eventErr } = await supabase
    .from('adapt_events')
    .select('*')
    .eq('id', eventId)
    .eq('user_id', userId)
    .single()

  if (eventErr || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Only process pending events — guard against duplicate calls
  if (event.status !== 'pending') {
    return NextResponse.json({ success: true, message: 'Already processed', status: event.status })
  }

  // ── Build system context ────────────────────────────────────────────────────
  let systemContext = ''
  try {
    systemContext = await buildFullSystemContext(supabase, userId)
  } catch (e) {
    console.error('[adapt/process] context build failed:', e)
    // Continue with empty context — better a weak proposal than no proposal
  }

  // ── Build prompt ────────────────────────────────────────────────────────────
  const prompt = [
    `## Adapt Event`,
    `Type: ${event.event_type}`,
    `Payload: ${JSON.stringify(event.payload, null, 2)}`,
    `Triggered at: ${event.created_at}`,
    '',
    systemContext ? `## User Context\n${systemContext}` : null,
  ].filter(Boolean).join('\n')

  // ── Generate proposal ───────────────────────────────────────────────────────
  let proposal: unknown[] = []

  try {
    const { text } = await generateText({
      model: geminiFlash(),
      system: PROPOSAL_SYSTEM,
      prompt,
      maxTokens: 600,
      temperature: 0.3,
    })

    try {
      const parsed = JSON.parse(text.trim())
      if (Array.isArray(parsed)) proposal = parsed
    } catch {
      // JSON parse failed — extract array from text if wrapped in markdown
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          if (Array.isArray(parsed)) proposal = parsed
        } catch {
          console.error('[adapt/process] JSON parse failed, storing empty proposal')
        }
      }
    }
  } catch (e) {
    console.error('[adapt/process] Gemini call failed:', e)
    // Don't error the route — update status so it's not stuck as pending
  }

  // ── Persist proposal ────────────────────────────────────────────────────────
  await supabase
    .from('adapt_events')
    .update({
      status: 'proposed',
      proposal,
      proposal_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  return NextResponse.json({ success: true, proposal })
}
