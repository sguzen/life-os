// Adapt event trigger — fired automatically when data patterns cross thresholds.
// Idempotent: if an identical unresolved event exists in the last 7 days, it is skipped.
// After inserting, fires the /api/adapt/process route to generate an AI proposal.

import type { SupabaseClient } from '@supabase/supabase-js'

export type AdaptEventType =
  | 'brutal_training_session'   // PE >= 5 or flag = 'warning'
  | 'consecutive_poor_sleep'    // 3+ days avg sleep_quality <= 2
  | 'alcohol_pattern'           // alcohol_consumed 3+ days in last 7
  | 'low_energy_pattern'        // 3+ days avg energy_level <= 2
  | 'race_checkpoint_result'    // after Limassol half result logged
  | 'trading_loss_streak'       // 3+ consecutive losing days

export async function maybeFireAdaptEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: AdaptEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  // Idempotency check: skip if identical open event exists in last 7 days
  const { data: existing } = await supabase
    .from('adapt_events')
    .select('id')
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .in('status', ['pending', 'proposed'])
    .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
    .limit(1)

  if (existing?.length) return

  const { data: row, error } = await supabase
    .from('adapt_events')
    .insert({ user_id: userId, event_type: eventType, payload })
    .select('id')
    .single()

  if (error || !row) {
    console.error('[adapt/trigger] insert failed:', error)
    return
  }

  // Fire-and-forget: trigger the AI proposal generation
  // Uses CRON_SECRET as an internal shared secret (process route is not public).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  fetch(`${appUrl}/api/adapt/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.CRON_SECRET ?? '',
    },
    body: JSON.stringify({ eventId: row.id, userId }),
  }).catch((e) => console.error('[adapt] process trigger failed:', e))
}
