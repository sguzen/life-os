// Master AI Coach — streaming API with cross-module tool-calling
// Reads all modules for context, can modify supplements and plan configs

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MASTER_COACH_SYSTEM_PROMPT, buildFullSystemContext } from '@/lib/ai/master-coach'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(req: Request) {
  const { messages } = await req.json()

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let contextBlock = ''
  try {
    contextBlock = await buildFullSystemContext(supabase)
  } catch (err) {
    console.error('[coach] context build failed:', err)
    contextBlock = '(Context unavailable — answering from conversation only.)'
  }

  const systemWithContext = `${MASTER_COACH_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`
  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemWithContext,
    messages: modelMessages,
    maxOutputTokens: 2048,
    temperature: 0.7,
    maxSteps: 3, // allow tool call → result → follow-up

    tools: {
      // ── Supplement tools ────────────────────────────────────────

      pause_supplement: {
        description:
          'Pause a supplement so it no longer appears in the daily checklist. ' +
          'Use when the user asks to skip, stop, or pause a specific supplement.',
        parameters: z.object({
          supplement_id: z.string().describe('UUID of the supplement (shown in brackets in the context)'),
          reason: z.string().describe('Why the supplement is being paused'),
        }),
        execute: async ({ supplement_id, reason }) => {
          try {
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

            await supabase.from('supplement_changes').insert({
              supplement_id,
              user_id: user.id,
              change_type: 'paused',
              previous_value: { is_paused: false },
              new_value: { is_paused: true, pause_reason: reason },
              reason,
              changed_by: 'ai_coach',
            })

            await supabase.from('plan_audit_log').insert({
              user_id: user.id,
              module: 'nutrition',
              entity_type: 'supplement',
              entity_description: supplement_id,
              action: 'pause',
              new_value: 'paused',
              reason,
              changed_by: 'ai_coach',
            })

            return { success: true, message: `Supplement paused. Reason recorded: "${reason}"` }
          } catch (e) {
            return { success: false, message: `Failed to pause supplement: ${String(e)}` }
          }
        },
      },

      resume_supplement: {
        description:
          'Resume a paused supplement so it shows in the daily checklist again.',
        parameters: z.object({
          supplement_id: z.string().describe('UUID of the supplement to resume'),
        }),
        execute: async ({ supplement_id }) => {
          try {
            const { data: sup } = await supabase
              .from('supplements')
              .select('name')
              .eq('id', supplement_id)
              .eq('user_id', user.id)
              .single()

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

            await supabase.from('plan_audit_log').insert({
              user_id: user.id,
              module: 'nutrition',
              entity_type: 'supplement',
              entity_description: sup?.name ?? supplement_id,
              action: 'resume',
              new_value: 'active',
              changed_by: 'ai_coach',
            })

            return { success: true, message: `${sup?.name ?? 'Supplement'} resumed.` }
          } catch (e) {
            return { success: false, message: `Failed to resume supplement: ${String(e)}` }
          }
        },
      },

      // ── Plan config tools ───────────────────────────────────────

      update_plan_config: {
        description:
          'Update a plan configuration value. Use to adjust training paces, nutrition targets, ' +
          'daily calorie or water goals, trading parameters, or any other plan setting. ' +
          'Only update configs that are relevant to the user\'s request.',
        parameters: z.object({
          module: z.string().describe(
            'Module name: running | nutrition | trading | marathon | habits'
          ),
          config_key: z.string().describe(
            'Exact config_key from the Plan Configurations section, e.g. "easy_pace_min"'
          ),
          new_value: z.string().describe('New value as a string'),
          reason: z.string().describe('Why this change is being made'),
        }),
        execute: async ({ module, config_key, new_value, reason }) => {
          try {
            const { data: current } = await supabase
              .from('plan_configs')
              .select('config_value, config_label')
              .eq('user_id', user.id)
              .eq('module', module)
              .eq('config_key', config_key)
              .single()

            if (!current) {
              return { success: false, message: `Config "${module}.${config_key}" not found.` }
            }

            const { error } = await supabase
              .from('plan_configs')
              .update({
                config_value: new_value,
                last_changed_at: new Date().toISOString(),
                last_changed_by: 'ai_coach',
                change_reason: reason,
              })
              .eq('user_id', user.id)
              .eq('module', module)
              .eq('config_key', config_key)

            if (error) throw error

            await supabase.from('plan_audit_log').insert({
              user_id: user.id,
              module,
              entity_type: 'plan_config',
              entity_description: current.config_label,
              action: 'update',
              field_changed: config_key,
              previous_value: current.config_value,
              new_value,
              reason,
              changed_by: 'ai_coach',
            })

            return {
              success: true,
              message: `Updated "${current.config_label}" from "${current.config_value}" to "${new_value}". Reason: ${reason}`,
            }
          } catch (e) {
            return { success: false, message: `Failed to update config: ${String(e)}` }
          }
        },
      },

      // ── Audit log read tool ─────────────────────────────────────

      get_recent_changes: {
        description:
          'Fetch the most recent changes across all modules from the audit log. ' +
          'Useful when the user asks "what did you change?" or "show me recent updates".',
        parameters: z.object({
          limit: z.number().default(10).describe('Number of entries to return (max 20)'),
        }),
        execute: async ({ limit }) => {
          try {
            const { data } = await supabase
              .from('plan_audit_log')
              .select('changed_at, module, entity_description, action, field_changed, previous_value, new_value, reason, changed_by')
              .eq('user_id', user.id)
              .order('changed_at', { ascending: false })
              .limit(Math.min(limit, 20))

            if (!data?.length) return { entries: [], message: 'No changes logged yet.' }

            const formatted = data.map((e) => ({
              date: new Date(e.changed_at).toLocaleString('en-GB'),
              module: e.module,
              what: e.entity_description ?? e.action,
              change: e.field_changed ? `${e.field_changed}: ${e.previous_value} → ${e.new_value}` : e.action,
              reason: e.reason,
              by: e.changed_by,
            }))

            return { entries: formatted, message: `Found ${formatted.length} recent change(s).` }
          } catch (e) {
            return { entries: [], message: `Failed to fetch audit log: ${String(e)}` }
          }
        },
      },
    },
  })

  return result.toUIMessageStreamResponse()
}
