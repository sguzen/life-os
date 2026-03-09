// PATCH /api/adapt/events/[id]
// Approve or reject an AI-generated adapt_events proposal.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  status: z.enum(['approved', 'rejected']),
})

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'status must be "approved" or "rejected"' }, { status: 400 })
  }

  const { error } = await supabase
    .from('adapt_events')
    .update({
      status: parsed.data.status,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .in('status', ['proposed'])  // only resolve proposed events

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
