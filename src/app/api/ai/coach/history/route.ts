// GET /api/ai/coach/history
// Returns the last 20 coach conversation turns for the current user.
// Used by GlobalCoachPanel and /coach page to pre-populate message history.

import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data, error } = await supabase
    .from('coach_conversations')
    .select('id, session_id, role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[coach/history] query failed:', error)
    return Response.json({ messages: [] })
  }

  // Return in chronological order (oldest first) for display
  const messages = (data ?? []).reverse().map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: row.created_at,
  }))

  return Response.json({ messages })
}
