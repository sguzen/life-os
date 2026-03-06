// Adaptation events CRUD

import { createAdaptationEvent, updateAdaptationEventStatus } from '@/lib/supabase/adapt'
import { z } from 'zod'

const createSchema = z.object({
  trigger_type: z.enum(['illness', 'injury', 'fatigue', 'poor_sleep']),
  severity: z.number().int().min(1).max(5),
  symptoms: z.string().optional().nullable(),
  affected_body_part: z.string().optional().nullable(),
  sleep_hours: z.number().optional().nullable(),
  resting_hr: z.number().int().optional().nullable(),
  estimated_days: z.number().int().min(1).max(30),
  notes: z.string().optional().nullable(),
})

const patchSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(['pending', 'adjustments_proposed', 'approved', 'rejected', 'recovered']),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 })
    }

    const event = await createAdaptationEvent(parsed.data)
    return Response.json({ eventId: event.id, event })
  } catch (err) {
    console.error('Create adaptation event error:', err)
    return Response.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input' }, { status: 400 })
    }

    const extra = parsed.data.status === 'recovered'
      ? { recovery_confirmed_at: new Date().toISOString() }
      : undefined

    await updateAdaptationEventStatus(parsed.data.eventId, parsed.data.status, extra)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('Update adaptation event error:', err)
    return Response.json({ error: 'Failed to update event' }, { status: 500 })
  }
}
