// PATCH /api/nutrition/meals/[id]
// Updates a meal definition. Called by MealEditDialog (manual edits)
// and by the life-coach confirm endpoint (AI-proposed edits).
// All changes are logged to plan_audit_log with the appropriate changed_by value.

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const patchBodySchema = z.object({
  updates: z.object({
    label: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    calories: z.number().int().nonnegative().nullable().optional(),
    protein: z.number().nonnegative().nullable().optional(),
    carbs: z.number().nonnegative().nullable().optional(),
    fats: z.number().nonnegative().nullable().optional(),
    icon: z.string().optional(),
  }),
  reason: z.string().optional(),
  changed_by: z.enum(['user', 'ai_life_coach']).default('user'),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return Response.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json(
      { success: false, message: 'Invalid request', errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { updates, reason, changed_by } = parsed.data
  const mealId = params.id

  // Fetch current for audit
  const { data: current, error: fetchError } = await supabase
    .from('meals')
    .select('*')
    .eq('id', mealId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !current) {
    return Response.json({ success: false, message: 'Meal not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('meals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', mealId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 })
  }

  // Audit: meal_changes
  await supabase.from('meal_changes').insert({
    meal_id: mealId,
    user_id: user.id,
    changed_by,
    previous_value: current,
    new_value: data,
    reason: reason ?? null,
  })

  // Audit: plan_audit_log
  const previousSnippet = JSON.stringify(
    Object.fromEntries(Object.keys(updates).map((k) => [k, (current as Record<string, unknown>)[k]]))
  )
  await supabase.from('plan_audit_log').insert({
    user_id: user.id,
    module: 'nutrition',
    entity_type: 'meal',
    entity_description: current.label as string,
    action: 'update',
    field_changed: Object.keys(updates).join(', '),
    previous_value: previousSnippet,
    new_value: JSON.stringify(updates),
    reason: reason ?? null,
    changed_by,
  })

  return Response.json({ success: true, meal: data })
}
