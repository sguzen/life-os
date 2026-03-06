// Apply approved adaptation adjustments to the relevant module tables

import { createClient } from '@/lib/supabase/server'
import {
  getAdjustmentsForEvent,
  updateAdjustmentApproval,
  applyMarathonAdjustments,
  applyNutritionAdjustments,
  applyTradingAdjustments,
  updateAdaptationEventStatus,
} from '@/lib/supabase/adapt'
import { z } from 'zod'

const applySchema = z.object({
  eventId: z.string().uuid(),
  decisions: z.array(z.object({
    id: z.string().uuid(),
    approved: z.boolean(),
    userOverride: z.string().optional().nullable(),
  })),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = applySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { eventId, decisions } = parsed.data

    // Save all approval decisions
    await Promise.all(
      decisions.map((d) =>
        updateAdjustmentApproval(d.id, d.approved, d.userOverride ?? undefined)
      )
    )

    // Fetch updated adjustments
    const adjustments = await getAdjustmentsForEvent(eventId)

    // Apply approved changes to each module
    await Promise.all([
      applyMarathonAdjustments(eventId, adjustments),
      applyNutritionAdjustments(eventId, adjustments),
      applyTradingAdjustments(eventId, adjustments),
    ])

    // Update event status to approved
    await updateAdaptationEventStatus(eventId, 'approved')

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Apply adjustments error:', err)
    return Response.json({ error: 'Failed to apply changes' }, { status: 500 })
  }
}
