// POST /api/ai/morning-briefing — thin wrapper around the shared lib function.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMorningBriefing } from '@/lib/ai/morning-briefing'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { logId } = (await req.json()) as { logId?: string }
  if (!logId) return new Response('logId required', { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  try {
    const result = await generateMorningBriefing(supabase, logId, user.id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[morning-briefing]', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    const status = message === 'Morning log not found' ? 404 : 500
    return new Response(message, { status })
  }
}
