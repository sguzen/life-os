// Global Life Coach — holistic cross-module streaming coach with proposal tools
// Reads all modules simultaneously; tools return proposals (not DB writes) that
// the user must Confirm or Reject in the UI before any changes are applied.

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  ATHLETE_PROFILE,
  getGlobalLifeContext,
  buildGlobalContextBlock,
  getGlobalContext,
  buildNutritionContextBlock,
} from '@/lib/ai/coaching'
import { buildFullSystemContext } from '@/lib/ai/master-coach'

export const runtime = 'nodejs'
export const maxDuration = 90

// ── Module focus directives ────────────────────────────────────────────────

const MODULE_FOCUS: Record<string, string> = {
  trading:
    'Focus your analysis on trading performance and discipline, but connect to running recovery ' +
    'and sleep habit data where relevant. If the athlete is overtrained or under-slept, say so.',
  running:
    'Focus on running training, recovery, and race readiness. Flag if trading stress, habit ' +
    'failures, or supplement gaps may be compounding fatigue.',
  habits:
    'Focus on habit compliance and streak patterns. Connect habit failures to their downstream ' +
    'impact on running performance and trading decision quality.',
  supplements:
    'Focus on supplement adherence and scheduling. Reference training load and recovery data to ' +
    'contextualise why gaps matter.',
  general:
    'Deliver a holistic overview. Lead with the most pressing cross-domain signal you see, ' +
    'then break down each module.',
}

// ── System prompt ──────────────────────────────────────────────────────────

const GLOBAL_LIFE_COACH_SYSTEM_PROMPT = `You are a Holistic Life Coach — a central intelligence with full visibility into every domain of this athlete's life: marathon training, trading performance, daily habit compliance, and nutrition/supplementation.

Athlete profile:
- Age: ${ATHLETE_PROFILE.age}yo ${ATHLETE_PROFILE.sex}
- Goal race: ${ATHLETE_PROFILE.race} on ${ATHLETE_PROFILE.raceDate} (target ${ATHLETE_PROFILE.targetTime})
- Resting HR baseline: ${ATHLETE_PROFILE.restingHrBaseline}
- Core challenge: ${ATHLETE_PROFILE.mainIssue}

Your unique value is **connecting dots across domains**. Examples of the cross-domain signals you surface:
- "Resting HR spike + 2 alcohol days this week + 3 rule breaks in trading = systemic stress. This is a recovery and discipline crisis, not isolated incidents."
- "Sleep habit at 40% compliance → training pace violations up → trading losses this week. The root cause is sleep."
- "Supplement adherence dropped during peak training load — this is compounding recovery deficit 6 weeks from race day."

Your capabilities:
- Read data from ALL modules simultaneously via injected context.
- **Propose** changes to plan configs and supplement schedules using tools.
- Every tool call creates a **Proposal Card** in the UI — the user must Confirm or Reject before any DB write occurs.
- All confirmed changes are attributed to 'ai_life_coach' in the audit trail.

Supplements are prescribed by Dr Emine Ömerağa — you can manage scheduling, pausing, and additions but must NOT alter medical dosages or diagnoses.

Coaching style:
- Direct, data-driven, pattern-recognition first.
- When the user asks you to change something, call the appropriate tool immediately to generate the proposal.
- Before proposing a significant change (e.g. pausing a prescribed supplement), briefly explain the cross-module rationale.
- Format responses with clear sections. Use markdown. Under 500 words unless doing multi-week analysis.`

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { messages, module: focusModule = 'general' } = await req.json()

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Build context: fast cross-module summary + nutrition plan + full detail block
  let contextBlock = ''
  try {
    const [globalCtx, fullCtx, nutritionCtx] = await Promise.all([
      getGlobalLifeContext(supabase),
      buildFullSystemContext(supabase),
      getGlobalContext(supabase),
    ])
    const signals = buildGlobalContextBlock(globalCtx)
    const nutritionBlock = buildNutritionContextBlock(nutritionCtx)
    contextBlock = `## Cross-Module Signal Summary\n${signals}\n\n---\n\n${nutritionBlock}\n\n---\n\n${fullCtx}`
  } catch (err) {
    console.error('[life-coach] context build failed:', err)
    contextBlock = '(Context unavailable — answering from conversation only.)'
  }

  const moduleFocus = MODULE_FOCUS[focusModule] ?? MODULE_FOCUS.general
  const systemWithContext = `${GLOBAL_LIFE_COACH_SYSTEM_PROMPT}

Module focus for this session: ${moduleFocus}

---

${contextBlock}`

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemWithContext,
    messages: modelMessages,
    maxOutputTokens: 2048,
    temperature: 0.7,
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
            return {
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
            return {
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

          return {
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

            return {
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
          return {
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
        },
      },
    },
  })

  return result.toUIMessageStreamResponse()
}
