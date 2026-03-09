// Life OS Command Center — holistic cross-module AI coach (Gemini 2.5 Pro)
// Every request fetches a real-time system snapshot so the model has full
// visibility before responding. Tools return proposals the user Confirms.

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ATHLETE_PROFILE } from '@/lib/ai/coaching'
import { getCoachContext, formatCoachContext } from '@/lib/ai/get-coach-context'

export const runtime = 'nodejs'
export const maxDuration = 90

// ── Module focus directives ────────────────────────────────────────────────

const MODULE_FOCUS: Record<string, string> = {
  trading:
    'Drill into the trading section of CURRENT_USER_STATE first. Cross-reference today\'s P&L ' +
    'and trade count against plan_config limits. Connect to resting HR and sleep habit data.',
  running:
    'Drill into the athletics section of CURRENT_USER_STATE. Compare today\'s scheduled target ' +
    'vs last 3 activities. Flag supplement or sleep gaps that compound fatigue.',
  habits:
    'Audit habit compliance from CURRENT_USER_STATE and downstream effects on running and trading.',
  supplements:
    'Check supplement taken_today status in CURRENT_USER_STATE. Reference training load to ' +
    'explain why gaps matter right now.',
  nutrition:
    'Analyse the nutrition section of CURRENT_USER_STATE: meals complete vs total, calories and ' +
    'protein consumed vs plan targets. Suggest adjustments if off track.',
  general:
    'Deliver a holistic system overview. Lead with the single most urgent signal from ' +
    'CURRENT_USER_STATE, then break down each module.',
}

// ── System prompt ──────────────────────────────────────────────────────────

const COMMAND_CENTER_SYSTEM_PROMPT = `You are the Life OS Command Center — a high-performance AI coach with real-time visibility into every domain of this athlete's life.

Athlete: ${ATHLETE_PROFILE.age}yo ${ATHLETE_PROFILE.sex} | Goal: ${ATHLETE_PROFILE.race} ${ATHLETE_PROFILE.raceDate} in ${ATHLETE_PROFILE.targetTime} | HR baseline: ${ATHLETE_PROFILE.restingHrBaseline}

## CRITICAL INSTRUCTIONS
1. **Do NOT give generic advice.** Every response must reference specific values from CURRENT_USER_STATE.
2. **If the user asks for a change** (to a meal, config, or supplement), call the appropriate TOOL immediately — do not just describe the change.
3. **Connect dots across domains.** A resting HR spike + poor sleep + trading losses on the same day is a system failure, not three separate events.
4. **Tools create Proposal Cards** — the user confirms before any DB write occurs. All confirmed changes log as 'ai_life_coach' in the audit trail.

## EXAMPLES OF DATA-DRIVEN RESPONSES (required style)
- "Today's P&L: -$XX with Y trades. You've hit Z% of your max_trades_day limit. Your resting HR is N bpm (Δ+M from baseline) — this is not a good day to add risk."
- "You've completed X/Y meals today, consuming ~Z kcal of your ${ATHLETE_PROFILE.race} training target. Protein is Ng short. Snack 3 can close that gap."
- "Last 3 runs averaged Xm:Ss/km vs ${ATHLETE_PROFILE.trainingPaces.easy} easy target — consistently too fast. Proposing easy_pace_max adjustment."

## CONSTRAINTS
- Supplements prescribed by Dr Emine Ömerağa — manage scheduling/pausing/additions but never alter medical dosages or diagnoses.
- Format with markdown headers. Under 400 words unless doing multi-week analysis.`

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { messages, module: focusModule = 'general' } = await req.json()

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // ── Live context — fetched fresh on every request ────────────────────────
  let liveDataBlock = '### LIVE_OS_DATA_SNAPSHOT\n> ERROR: context unavailable — do NOT tell the user you lack their data. Ask them to refresh.'
  try {
    const ctx = await getCoachContext(supabase)
    liveDataBlock = formatCoachContext(ctx)
  } catch (err) {
    console.error('[life-coach] context fetch failed:', err)
  }

  const moduleFocus = MODULE_FOCUS[focusModule] ?? MODULE_FOCUS.general
  const systemWithContext = `${COMMAND_CENTER_SYSTEM_PROMPT}

## MODULE FOCUS FOR THIS SESSION
${moduleFocus}

---

${liveDataBlock}`

  // ── Audit helper — called by every tool on execution ────────────────────
  async function logAudit(opts: {
    module: string
    action: string
    entity_type: string
    entity_description: string
    new_value?: string
    reason?: string
  }) {
    try {
      await supabase.from('plan_audit_log').insert({
        user_id: user.id,
        changed_by: 'ai_life_coach',
        ...opts,
      })
    } catch {
      // non-fatal
    }
  }

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('models/gemini-2.5-pro'),
    system: systemWithContext,
    messages: modelMessages,
    maxOutputTokens: 2048,
    temperature: 0.6,
    maxSteps: 3,

    tools: {
      // ── updatePlanConfig ─────────────────────────────────────────
      updatePlanConfig: {
        description:
          'Propose a change to a plan configuration value (training paces, profit targets, ' +
          'trading gate thresholds, nutrition goals, etc.). Returns a proposal the user must ' +
          'confirm before the database is updated.',
        parameters: z.object({
          module: z
            .string()
            .describe('Module name: running | nutrition | trading | marathon | habits'),
          config_key: z
            .string()
            .describe('Exact config_key from the Plan Configurations section'),
          new_value: z.string().describe('Proposed new value as a string'),
          reason: z
            .string()
            .describe(
              'Why this change is proposed — include any relevant cross-module context'
            ),
        }),
        execute: async ({ module, config_key, new_value, reason }) => {
          try {
            const { data: current } = await supabase
              .from('plan_configs')
              .select('config_value, config_label, config_unit, editable_by_ai')
              .eq('user_id', user.id)
              .eq('module', module)
              .eq('config_key', config_key)
              .single()

            if (!current) {
              return {
                type: 'error' as const,
                message: `Config "${module}.${config_key}" not found.`,
              }
            }
            if (current.editable_by_ai === false) {
              return {
                type: 'error' as const,
                message: `"${current.config_label}" is locked — not AI-editable.`,
              }
            }

            const unit = current.config_unit ? ` ${current.config_unit}` : ''
            const proposal = {
              type: 'proposal' as const,
              action: 'update_plan_config',
              displayTitle: `Update ${current.config_label}`,
              displayBody: `Change **${current.config_label}** from **${current.config_value}${unit}** → **${new_value}${unit}**`,
              reason,
              params: {
                module,
                config_key,
                config_label: current.config_label,
                previous_value: current.config_value,
                new_value,
                config_unit: current.config_unit ?? null,
              },
            }
            await logAudit({
              module,
              action: 'proposal_generated',
              entity_type: 'plan_config',
              entity_description: `Proposed: ${current.config_label} → ${new_value}${unit}`,
              new_value,
              reason,
            })
            return proposal
          } catch (e) {
            return { type: 'error' as const, message: `Failed to build proposal: ${String(e)}` }
          }
        },
      },

      // ── manageSupplement ─────────────────────────────────────────
      manageSupplement: {
        description:
          'Propose a supplement management action: pause, resume, expire (deactivate), or add a ' +
          'new supplement. Returns a proposal the user must confirm before any DB change occurs.',
        parameters: z.object({
          action: z
            .enum(['pause', 'resume', 'expire', 'add'])
            .describe('Action to perform on the supplement'),
          supplement_id: z
            .string()
            .optional()
            .describe('UUID of the supplement — required for pause / resume / expire'),
          reason: z.string().describe('Why this action is proposed'),
          // Fields for 'add'
          name: z
            .string()
            .optional()
            .describe('Supplement name — required when action is "add"'),
          frequency: z
            .string()
            .optional()
            .describe('Dosage and frequency, e.g. "5g daily" — required when action is "add"'),
          timing: z
            .string()
            .optional()
            .describe('When to take it, e.g. "post-workout with food"'),
          prescribed_for: z
            .string()
            .optional()
            .describe('Goal or condition the supplement addresses'),
        }),
        execute: async ({
          action,
          supplement_id,
          reason,
          name,
          frequency,
          timing,
          prescribed_for,
        }) => {
          if (action === 'add') {
            if (!name || !frequency) {
              return {
                type: 'error' as const,
                message: 'Both "name" and "frequency" are required to add a supplement.',
              }
            }
            const addProposal = {
              type: 'proposal' as const,
              action: 'manage_supplement',
              displayTitle: `Add Supplement: ${name}`,
              displayBody:
                `Add **${name}** — ${frequency}` +
                (timing ? `, ${timing}` : '') +
                (prescribed_for ? ` *(for: ${prescribed_for})*` : ''),
              reason,
              params: {
                supplement_action: 'add',
                name,
                frequency,
                timing: timing ?? null,
                prescribed_for: prescribed_for ?? null,
              },
            }
            await logAudit({
              module: 'nutrition',
              action: 'proposal_generated',
              entity_type: 'supplement',
              entity_description: `Proposed add: ${name} — ${frequency}`,
              reason,
            })
            return addProposal
          }

          if (!supplement_id) {
            return {
              type: 'error' as const,
              message: '"supplement_id" is required for pause / resume / expire.',
            }
          }

          const { data: sup } = await supabase
            .from('supplements')
            .select('name, is_paused')
            .eq('id', supplement_id)
            .eq('user_id', user.id)
            .single()

          if (!sup) {
            return {
              type: 'error' as const,
              message: `Supplement ${supplement_id} not found.`,
            }
          }

          const actionLabel: Record<string, string> = {
            pause: 'Pause',
            resume: 'Resume',
            expire: 'Expire / Deactivate',
          }

          const supProposal = {
            type: 'proposal' as const,
            action: 'manage_supplement',
            displayTitle: `${actionLabel[action]} Supplement: ${sup.name}`,
            displayBody: `${actionLabel[action]} **${sup.name}**`,
            reason,
            params: {
              supplement_action: action,
              supplement_id,
              supplement_name: sup.name,
            },
          }
          await logAudit({
            module: 'nutrition',
            action: 'proposal_generated',
            entity_type: 'supplement',
            entity_description: `Proposed ${action}: ${sup.name}`,
            reason,
          })
          return supProposal
        },
      },

      // ── logManualAudit ───────────────────────────────────────────
      logManualAudit: {
        description:
          'Write a manual observation or coaching note to the audit trail. Use when the coach ' +
          'identifies a pattern or insight worth recording that does not correspond to a specific ' +
          'config change or supplement action.',
        parameters: z.object({
          module: z
            .string()
            .describe('Relevant module: trading | running | habits | nutrition | general'),
          note: z.string().describe('The observation or insight to log'),
          entity_type: z
            .string()
            .optional()
            .default('coaching_note')
            .describe('Entity type label for the audit row'),
        }),
        execute: async ({ module, note, entity_type }) => {
          try {
            const { error } = await supabase.from('plan_audit_log').insert({
              user_id: user.id,
              module,
              entity_type: entity_type ?? 'coaching_note',
              entity_description: note.slice(0, 200),
              action: 'note',
              reason: note,
              changed_by: 'ai_life_coach',
            })
            if (error) throw error
            return { success: true, message: 'Coaching note logged to audit trail.' }
          } catch (e) {
            return { success: false, message: `Failed to log note: ${String(e)}` }
          }
        },
      },

      // ── updateMeal ───────────────────────────────────────────────
      updateMeal: {
        description:
          'Propose an update to a meal definition (description, macros, label). Returns a ' +
          'proposal the user must confirm before the database is updated. Use this when the user ' +
          'asks to change what a meal contains, its calories, protein, carbs, or fats.',
        parameters: z.object({
          meal_name: z
            .string()
            .describe(
              'The meal_name key, e.g. "meal_breakfast", "meal_lunch", "meal_snack1"'
            ),
          updates: z
            .object({
              label: z.string().optional().describe('New display label'),
              description: z.string().optional().describe('New description of the meal contents'),
              calories: z.number().int().nonnegative().optional().describe('New calorie target'),
              protein: z.number().nonnegative().optional().describe('Protein in grams'),
              carbs: z.number().nonnegative().optional().describe('Carbohydrates in grams'),
              fats: z.number().nonnegative().optional().describe('Fats in grams'),
            })
            .describe('Fields to update — only include fields being changed'),
          reason: z
            .string()
            .describe('Why this meal change is proposed (include any relevant context)'),
        }),
        execute: async ({ meal_name, updates, reason }) => {
          try {
            const { data: meal } = await supabase
              .from('meals')
              .select('id, label, description, calories, protein, carbs, fats')
              .eq('user_id', user.id)
              .eq('meal_name', meal_name)
              .limit(1)
              .single()

            if (!meal) {
              return {
                type: 'error' as const,
                message: `Meal "${meal_name}" not found in your plan. Valid keys: meal_post_run, meal_breakfast, meal_lunch, meal_snack1-4.`,
              }
            }

            const changeLines = Object.entries(updates)
              .map(([k, v]) => `**${k}**: ${(meal as Record<string, unknown>)[k] ?? 'unset'} → ${v}`)
              .join('\n')

            const mealProposal = {
              type: 'proposal' as const,
              action: 'update_meal',
              displayTitle: `Update ${meal.label}`,
              displayBody: changeLines,
              reason,
              params: {
                meal_id: meal.id,
                meal_name,
                meal_label: meal.label,
                updates,
              },
            }
            await logAudit({
              module: 'nutrition',
              action: 'proposal_generated',
              entity_type: 'meal',
              entity_description: `Proposed update: ${meal.label} — ${Object.keys(updates).join(', ')}`,
              new_value: JSON.stringify(updates),
              reason,
            })
            return mealProposal
          } catch (e) {
            return { type: 'error' as const, message: `Failed to build proposal: ${String(e)}` }
          }
        },
      },

      // ── addSupplement ────────────────────────────────────────────
      addSupplement: {
        description:
          'Propose adding a new supplement to the user\'s protocol. Returns a proposal the user ' +
          'must confirm before the supplement is inserted. Use when the user explicitly asks to ' +
          'add a new supplement.',
        parameters: z.object({
          name: z.string().describe('Supplement name, e.g. "Creatine Monohydrate"'),
          frequency: z
            .string()
            .describe('Dosing and frequency, e.g. "5g daily" or "1000mg twice daily"'),
          timing: z
            .string()
            .optional()
            .describe('When to take it, e.g. "post-workout with food"'),
          prescribed_for: z
            .string()
            .optional()
            .describe('Goal or condition addressed, e.g. "muscle recovery, strength"'),
          reason: z.string().describe('Why this supplement is being proposed'),
        }),
        execute: async ({ name, frequency, timing, prescribed_for, reason }) => {
          const p = {
            type: 'proposal' as const,
            action: 'manage_supplement',
            displayTitle: `Add Supplement: ${name}`,
            displayBody:
              `Add **${name}** — ${frequency}` +
              (timing ? `, take ${timing}` : '') +
              (prescribed_for ? ` *(for: ${prescribed_for})*` : ''),
            reason,
            params: {
              supplement_action: 'add',
              name,
              frequency,
              timing: timing ?? null,
              prescribed_for: prescribed_for ?? null,
            },
          }
          await logAudit({
            module: 'nutrition',
            action: 'proposal_generated',
            entity_type: 'supplement',
            entity_description: `Proposed add: ${name} — ${frequency}`,
            reason,
          })
          return p
        },
      },

      // ── logMealComplete ───────────────────────────────────────────
      // Direct write — low-risk: just marks a meal status in today's log.
      logMealComplete: {
        description:
          'Mark a meal as complete (or partial/skipped) in today\'s nutrition log. ' +
          'Use when the user says they just ate a meal or want to log one. ' +
          'This is a direct write — no confirmation required.',
        parameters: z.object({
          meal_name: z
            .string()
            .describe('Key of the meal: meal_post_run | meal_breakfast | meal_lunch | meal_snack1 | meal_snack2 | meal_snack3 | meal_snack4'),
          status: z
            .enum(['complete', 'partial', 'skipped'])
            .describe('New status to set for the meal'),
          note: z
            .string()
            .optional()
            .describe('Optional note about what was eaten or why it was skipped/partial'),
        }),
        execute: async ({ meal_name, status, note }) => {
          try {
            const today = new Date().toISOString().split('T')[0]

            // Upsert nutrition_log row with updated meal status
            const updatePayload: Record<string, unknown> = {
              user_id: user.id,
              log_date: today,
              [meal_name]: status,
            }
            if (note) {
              // Merge note into meal_notes JSONB — fetch existing first
              const { data: existing } = await supabase
                .from('nutrition_logs')
                .select('meal_notes')
                .eq('user_id', user.id)
                .eq('log_date', today)
                .maybeSingle()
              const existingNotes = (existing?.meal_notes as Record<string, string>) ?? {}
              updatePayload.meal_notes = { ...existingNotes, [meal_name]: note }
            }

            const { error } = await supabase
              .from('nutrition_logs')
              .upsert(updatePayload, { onConflict: 'user_id,log_date' })

            if (error) throw error

            await logAudit({
              module: 'nutrition',
              action: 'meal_logged',
              entity_type: 'meal_log',
              entity_description: `${meal_name} marked ${status}`,
              new_value: status,
              reason: note,
            })

            return {
              success: true,
              message: `Logged **${meal_name.replace('meal_', '')}** as **${status}** for ${today}.${note ? ` Note: "${note}"` : ''}`,
            }
          } catch (e) {
            return { success: false, message: `Failed to log meal: ${String(e)}` }
          }
        },
      },

      // ── updateSupplement ──────────────────────────────────────────
      // Direct write for non-critical supplement field updates (timing, notes).
      // Significant lifecycle changes (pause/expire) still go through manageSupplement proposals.
      updateSupplement: {
        description:
          'Directly update non-critical fields of a supplement: timing, prescribed_for, or notes. ' +
          'For pause / resume / expire actions use the manageSupplement tool instead (those require user confirmation). ' +
          'Use this when the user wants to change when a supplement is taken or what it\'s for.',
        parameters: z.object({
          supplement_name: z
            .string()
            .describe('Name of the supplement to update (partial match is OK)'),
          updates: z.object({
            timing: z
              .string()
              .nullable()
              .optional()
              .describe('New timing, e.g. "post-workout with food" or "morning with breakfast"'),
            prescribed_for: z
              .string()
              .nullable()
              .optional()
              .describe('Updated goal/condition this supplement addresses'),
          }),
          reason: z.string().describe('Why the update is being made'),
        }),
        execute: async ({ supplement_name, updates, reason }) => {
          try {
            // Find supplement by partial name match
            const { data: matches } = await supabase
              .from('supplements')
              .select('id, name')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .ilike('name', `%${supplement_name}%`)
              .limit(1)

            const sup = matches?.[0]
            if (!sup) {
              return {
                success: false,
                message: `No active supplement matching "${supplement_name}" found. Check the supplement list.`,
              }
            }

            const { error } = await supabase
              .from('supplements')
              .update(updates)
              .eq('id', sup.id)
              .eq('user_id', user.id)

            if (error) throw error

            await logAudit({
              module: 'nutrition',
              action: 'supplement_updated',
              entity_type: 'supplement',
              entity_description: `Updated ${sup.name}: ${Object.keys(updates).join(', ')}`,
              new_value: JSON.stringify(updates),
              reason,
            })

            const changeDesc = Object.entries(updates)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => `${k}: "${v}"`)
              .join(', ')

            return {
              success: true,
              message: `Updated **${sup.name}** — ${changeDesc}. Recorded in audit trail.`,
            }
          } catch (e) {
            return { success: false, message: `Failed to update supplement: ${String(e)}` }
          }
        },
      },
    },
  })

  return result.toUIMessageStreamResponse()
}
