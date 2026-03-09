// POST /api/ai/training-eval — evaluate a completed training session
// Calls the shared evaluateTrainingSession function and returns the result.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateTrainingSession } from '@/lib/ai/training-evaluation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { sessionId } = (await req.json()) as { sessionId: string }
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await evaluateTrainingSession(supabase, sessionId, user.id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[training-eval]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Evaluation failed' },
      { status: 500 },
    )
  }
}
