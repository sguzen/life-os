// Nightly cron: compute Pearson correlations across daily_logs metrics
// and persist strong findings to user_insights.
// Vercel invokes this via cron with: Authorization: Bearer <CRON_SECRET>

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { calculateCorrelations, buildInsightText } from '@/lib/math/correlation'

// Allow up to 60 s on Vercel Pro; safe to reduce on Hobby
export const maxDuration = 60

export async function GET(req: Request) {
  // Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return new NextResponse('CRON_SECRET not configured', { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  // Use user_profiles as the source of active users (guaranteed to exist post-signup)
  const { data: profiles, error: profilesErr } = await supabase
    .from('user_profiles')
    .select('user_id')

  if (profilesErr) {
    return NextResponse.json({ error: profilesErr.message }, { status: 500 })
  }

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().split('T')[0]

  let totalInsights = 0

  for (const { user_id } of profiles ?? []) {
    const { data: logs } = await supabase
      .from('daily_logs')
      .select('metrics')
      .eq('user_id', user_id)
      .gte('date', sinceStr)
      .order('date', { ascending: true })

    if (!logs || logs.length < 5) continue

    const correlations = calculateCorrelations(
      logs as { metrics: Record<string, unknown> }[]
    )

    if (correlations.length === 0) continue

    const rows = correlations.map(({ metricA, metricB, coefficient }) => ({
      user_id,
      metric_a: metricA,
      metric_b: metricB,
      coefficient,
      confidence: parseFloat(Math.abs(coefficient).toFixed(4)),
      insight_text: buildInsightText(metricA, metricB, coefficient),
      actionable: true,
    }))

    const { error } = await supabase.from('user_insights').insert(rows)
    if (!error) totalInsights += rows.length
  }

  return NextResponse.json({ success: true, insights_created: totalInsights })
}
