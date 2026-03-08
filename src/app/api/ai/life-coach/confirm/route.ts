// Life Coach Proposal Confirmation — executes user-approved AI proposals
// Every write is attributed to 'ai_life_coach' in the audit trail.
// Called from the ProposalCard "Confirm" button in the chat UI.

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ── Proposal schema ────────────────────────────────────────────────────────

const updatePlanConfigSchema = z.object({
  action: z.literal('update_plan_config'),
  params: z.object({
    module: z.string(),
    config_key: z.string(),
    config_label: z.string(),
    previous_value: z.string(),
    new_value: z.string(),
    config_unit: z.string().nullable().optional(),
  }),
  reason: z.string(),
})

const manageSupplementSchema = z.object({
  action: z.literal('manage_supplement'),
  params: z.object({
    supplement_action: z.enum(['pause', 'resume', 'expire', 'add']),
    supplement_id: z.string().optional(),
    supplement_name: z.string().optional(),
    // Fields only present for 'add'
    name: z.string().optional(),
    frequency: z.string().optional(),
    timing: z.string().nullable().optional(),
    prescribed_for: z.string().nullable().optional(),
  }),
  reason: z.string(),
})

const confirmBodySchema = z.discriminatedUnion('action', [
  updatePlanConfigSchema,
  manageSupplementSchema,
])

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
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

  const parsed = confirmBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json(
      { success: false, message: 'Invalid proposal payload', errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { action, params, reason } = parsed.data
  const changedBy = 'ai_life_coach' as const

  try {
    // ── update_plan_config ────────────────────────────────────────
    if (action === 'update_plan_config') {
      const { module, config_key, config_label, previous_value, new_value } = params

      const { error: updateError } = await supabase
        .from('plan_configs')
        .update({
          config_value: new_value,
          last_changed_at: new Date().toISOString(),
          last_changed_by: changedBy,
          change_reason: reason,
        })
        .eq('user_id', user.id)
        .eq('module', module)
        .eq('config_key', config_key)

      if (updateError) throw updateError

      await supabase.from('plan_audit_log').insert({
        user_id: user.id,
        module,
        entity_type: 'plan_config',
        entity_description: config_label,
        action: 'update',
        field_changed: config_key,
        previous_value,
        new_value,
        reason,
        changed_by: changedBy,
      })

      const unit = params.config_unit ? ` ${params.config_unit}` : ''
      return Response.json({
        success: true,
        message: `Updated "${config_label}" to "${new_value}${unit}".`,
      })
    }

    // ── manage_supplement ─────────────────────────────────────────
    if (action === 'manage_supplement') {
      const { supplement_action, supplement_id, supplement_name, name, frequency, timing, prescribed_for } =
        params

      // ADD
      if (supplement_action === 'add') {
        if (!name || !frequency) {
          return Response.json(
            { success: false, message: '"name" and "frequency" are required to add a supplement.' },
            { status: 400 }
          )
        }

        const { error } = await supabase.from('supplements').insert({
          user_id: user.id,
          name,
          frequency,
          timing: timing ?? null,
          prescribed_for: prescribed_for ?? null,
          is_active: true,
          is_paused: false,
        })
        if (error) throw error

        await supabase.from('plan_audit_log').insert({
          user_id: user.id,
          module: 'nutrition',
          entity_type: 'supplement',
          entity_description: name,
          action: 'add',
          new_value: `${name} — ${frequency}`,
          reason,
          changed_by: changedBy,
        })

        return Response.json({ success: true, message: `Added supplement: ${name} (${frequency}).` })
      }

      if (!supplement_id) {
        return Response.json(
          { success: false, message: '"supplement_id" is required for pause / resume / expire.' },
          { status: 400 }
        )
      }

      // PAUSE
      if (supplement_action === 'pause') {
        const { error } = await supabase
          .from('supplements')
          .update({
            is_paused: true,
            pause_reason: reason,
            paused_at: new Date().toISOString().slice(0, 10),
            updated_at: new Date().toISOString(),
          })
          .eq('id', supplement_id)
          .eq('user_id', user.id)
        if (error) throw error

        // Record in supplement_changes history table
        await supabase.from('supplement_changes').insert({
          supplement_id,
          user_id: user.id,
          change_type: 'paused',
          previous_value: { is_paused: false },
          new_value: { is_paused: true, pause_reason: reason },
          reason,
          changed_by: changedBy,
        })
      }

      // RESUME
      if (supplement_action === 'resume') {
        const { error } = await supabase
          .from('supplements')
          .update({
            is_paused: false,
            pause_reason: null,
            paused_at: null,
            resume_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', supplement_id)
          .eq('user_id', user.id)
        if (error) throw error
      }

      // EXPIRE / DEACTIVATE
      if (supplement_action === 'expire') {
        const { error } = await supabase
          .from('supplements')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', supplement_id)
          .eq('user_id', user.id)
        if (error) throw error
      }

      await supabase.from('plan_audit_log').insert({
        user_id: user.id,
        module: 'nutrition',
        entity_type: 'supplement',
        entity_description: supplement_name ?? supplement_id,
        action: supplement_action,
        new_value: supplement_action,
        reason,
        changed_by: changedBy,
      })

      const actionLabel: Record<string, string> = {
        pause: 'Paused',
        resume: 'Resumed',
        expire: 'Expired',
      }
      return Response.json({
        success: true,
        message: `${actionLabel[supplement_action] ?? supplement_action} ${supplement_name ?? supplement_id}.`,
      })
    }
  } catch (e) {
    console.error('[life-coach/confirm] execution error:', e)
    return Response.json({ success: false, message: String(e) }, { status: 500 })
  }

  return Response.json({ success: false, message: 'Unknown action' }, { status: 400 })
}
