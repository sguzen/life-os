// POST /api/marathon/session/[date] — upsert a training session log

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { date: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { date } = params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  const { error } = await supabase
    .from('training_sessions')
    .upsert(
      { ...body, user_id: user.id, session_date: date },
      { onConflict: 'user_id,session_date' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update week actual_km
  if (body.week_number && body.actual_km != null) {
    const { data: weekSessions } = await supabase
      .from('training_sessions')
      .select('actual_km')
      .eq('user_id', user.id)
      .eq('week_number', body.week_number)
      .not('actual_km', 'is', null)

    const weekTotal = (weekSessions ?? []).reduce((s: number, r: { actual_km: number | null }) => s + (r.actual_km ?? 0), 0)

    await supabase
      .from('training_weeks')
      .upsert(
        {
          user_id: user.id,
          week_number: body.week_number,
          week_label: body.week_label ?? `Week ${body.week_number}`,
          week_type: body.week_type ?? 'normal',
          actual_km: weekTotal,
          status: 'in_progress',
        },
        { onConflict: 'user_id,week_number' },
      )
  }

  return NextResponse.json({ ok: true })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { date: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('session_date', params.date)
    .single()

  if (error) return NextResponse.json(null)
  return NextResponse.json(data)
}
