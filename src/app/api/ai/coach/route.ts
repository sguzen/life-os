// Master AI Coach — streaming API with cross-module tool-calling
// Reads all modules for context, can modify supplements and plan configs.
// Persists every turn to coach_conversations for session continuity.

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { MASTER_COACH_SYSTEM_PROMPT, buildFullSystemContext } from '@/lib/ai/master-coach'
import { evaluateTrainingSession } from '@/lib/ai/training-evaluation'
import { generateMorningBriefing } from '@/lib/ai/morning-briefing'
import { maybeFireAdaptEvent } from '@/lib/adapt/trigger'
import type { UIMessage } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 90

// ── Session context cache (5-min TTL) ──────────────────────────────────────
// Avoids re-fetching the full system context on every turn of the same session.
const contextCache = new Map<string, { context: string; ts: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

function getCachedContext(sessionId: string): string | null {
  const entry = contextCache.get(sessionId)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    contextCache.delete(sessionId)
    return null
  }
  return entry.context
}

function setCachedContext(sessionId: string, context: string) {
  contextCache.set(sessionId, { context, ts: Date.now() })
}

// ── Helper: extract plain text from a UIMessage ─────────────────────────────
function getMessageText(msg: UIMessage): string {
  const textPart = msg.parts?.find((p) => p.type === 'text')
  return (textPart && 'text' in textPart && textPart.text) ? textPart.text : ''
}

// ── POST — main chat handler ────────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.json()
  const { messages, sessionId } = body as { messages: UIMessage[]; sessionId?: string }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Build system context (cached per session) ───────────────────────────
  let contextBlock: string
  if (sessionId) {
    const cached = getCachedContext(sessionId)
    if (cached) {
      contextBlock = cached
    } else {
      try {
        contextBlock = await buildFullSystemContext(supabase)
      } catch (err) {
        console.error('[coach] context build failed:', err)
        contextBlock = '(Context unavailable — answering from conversation only.)'
      }
      setCachedContext(sessionId, contextBlock)
    }
  } else {
    try {
      contextBlock = await buildFullSystemContext(supabase)
    } catch (err) {
      console.error('[coach] context build failed:', err)
      contextBlock = '(Context unavailable — answering from conversation only.)'
    }
  }

  const systemWithContext = `${MASTER_COACH_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`

  // ── Load DB history and deduplicate with client messages ────────────────
  // Client pre-populates messages from the history endpoint using DB row IDs,
  // so we only include DB rows whose IDs are NOT already in the client list.
  const { data: dbHistory } = await supabase
    .from('coach_conversations')
    .select('id, role, content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(30)

  const clientMessageIds = new Set(messages.map((m) => m.id))
  const uniqueDbMessages = (dbHistory ?? []).filter((row) => !clientMessageIds.has(row.id))

  const dbCoreMessages = uniqueDbMessages.map((row) => ({
    role: row.role as 'user' | 'assistant',
    content: row.content,
  }))

  const clientModelMessages = await convertToModelMessages(messages)
  const modelMessages = [...dbCoreMessages, ...clientModelMessages]

  // ── Identify the new user message to persist ────────────────────────────
  // Last user message in the client array that wasn't loaded from DB (new turn).
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const lastUserText = lastUserMsg ? getMessageText(lastUserMsg) : null
  // If the message ID exists in DB history, it was pre-loaded — don't save again.
  const isNewUserMsg = lastUserMsg
    ? !(dbHistory ?? []).some((row) => row.id === lastUserMsg.id)
    : false

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemWithContext,
    messages: modelMessages,
    maxOutputTokens: 2048,
    temperature: 0.7,
    maxSteps: 5,

    onFinish: async ({ text }) => {
      try {
        const sid = sessionId ?? crypto.randomUUID()

        if (lastUserText && isNewUserMsg) {
          await supabase.from('coach_conversations').insert({
            user_id: user.id,
            session_id: sid,
            role: 'user',
            content: lastUserText,
          })
        }

        if (text) {
          await supabase.from('coach_conversations').insert({
            user_id: user.id,
            session_id: sid,
            role: 'assistant',
            content: text,
          })
        }
      } catch (err) {
        console.error('[coach] failed to persist conversation:', err)
      }
    },

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

      // ── Task tools ──────────────────────────────────────────────

      create_task: {
        description:
          'Create a task or reminder for the user. Use when the user says ' +
          '"remind me to X", "add a task to Y", "don\'t let me forget Z on [date]", ' +
          'or asks the coach to track something for a specific date. ' +
          'Always confirm after creating: "Added to your tasks: [title] for [date]."',
        parameters: z.object({
          title: z.string().describe('Clear, actionable task title'),
          notes: z.string().optional().describe('Additional context or details'),
          due_date: z.string().optional().describe('ISO date YYYY-MM-DD'),
          due_time: z.string().optional().describe('HH:MM 24h format'),
          recurrence: z.enum(['none', 'daily', 'weekly', 'weekdays']).default('none'),
          module: z
            .enum(['general', 'training', 'nutrition', 'trading', 'health', 'personal'])
            .default('general'),
          coach_context: z.string().describe('Why this task was created'),
        }),
        execute: async ({ title, notes, due_date, due_time, recurrence, module: taskModule, coach_context }) => {
          try {
            const { data: row, error } = await supabase
              .from('coach_tasks')
              .insert({
                user_id: user.id,
                title,
                notes: notes ?? null,
                due_date: due_date ?? null,
                due_time: due_time ?? null,
                recurrence,
                module: taskModule,
                source: 'ai_coach',
                coach_context,
              })
              .select('id, title')
              .single()

            if (error) throw error

            const dateStr = due_date ? ` for ${due_date}` : ''
            const timeStr = due_time ? ` at ${due_time}` : ''
            return {
              success: true,
              id: row?.id,
              message: `Added to your tasks: "${title}"${dateStr}${timeStr}.`,
            }
          } catch (e) {
            return { success: false, message: `Failed to create task: ${String(e)}` }
          }
        },
      },

      complete_task: {
        description:
          'Mark a task as complete. Use when user says "done", "completed", ' +
          '"mark X as done", or similar. Provide either the task id or a partial title to match.',
        parameters: z.object({
          task_id: z.string().optional().describe('UUID of the task if known'),
          title_hint: z.string().optional().describe('Partial title to match if no id available'),
        }),
        execute: async ({ task_id, title_hint }) => {
          try {
            let resolvedId = task_id

            if (!resolvedId && title_hint) {
              const { data: matches } = await supabase
                .from('coach_tasks')
                .select('id, title')
                .eq('user_id', user.id)
                .is('completed_at', null)
                .ilike('title', `%${title_hint}%`)
                .order('created_at', { ascending: false })
                .limit(1)

              resolvedId = matches?.[0]?.id
              if (!resolvedId) {
                return { success: false, message: `No pending task found matching "${title_hint}".` }
              }
            }

            if (!resolvedId) {
              return { success: false, message: 'Provide task_id or title_hint to complete a task.' }
            }

            const { data: task, error } = await supabase
              .from('coach_tasks')
              .update({ completed_at: new Date().toISOString() })
              .eq('id', resolvedId)
              .eq('user_id', user.id)
              .select('title')
              .single()

            if (error) throw error
            return { success: true, message: `Completed: "${task?.title ?? resolvedId}".` }
          } catch (e) {
            return { success: false, message: `Failed to complete task: ${String(e)}` }
          }
        },
      },

      get_tasks: {
        description:
          'Fetch the user\'s current tasks. Use when user asks "what do I have to do", ' +
          '"what\'s on my list", "any reminders today", or similar.',
        parameters: z.object({
          scope: z
            .enum(['today', 'upcoming', 'all_pending'])
            .default('today')
            .describe('today=due today | upcoming=next 7 days | all_pending=all incomplete'),
        }),
        execute: async ({ scope }) => {
          try {
            const todayStr = new Date().toISOString().slice(0, 10)
            const futureStr = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

            let query = supabase
              .from('coach_tasks')
              .select('id, title, notes, due_date, due_time, module, source, recurrence')
              .eq('user_id', user.id)
              .is('completed_at', null)

            if (scope === 'today') {
              query = query.eq('due_date', todayStr)
            } else if (scope === 'upcoming') {
              query = query.gte('due_date', todayStr).lte('due_date', futureStr)
            }

            const { data } = await query.order('due_date', { ascending: true, nullsFirst: false })

            const tasks = (data ?? []).map((t) => ({
              id: t.id,
              title: t.title,
              due: t.due_date ? `${t.due_date}${t.due_time ? ' ' + t.due_time : ''}` : 'no date',
              module: t.module ?? 'general',
              source: t.source,
              recurrence: t.recurrence,
              notes: t.notes ?? undefined,
            }))

            return { tasks, count: tasks.length, message: `Found ${tasks.length} task(s).` }
          } catch (e) {
            return { tasks: [], count: 0, message: `Failed to fetch tasks: ${String(e)}` }
          }
        },
      },

      // ── Training eval tool ──────────────────────────────────────

      evaluate_training_session: {
        description:
          'Run the AI coach evaluation on a completed training session. ' +
          'Use when the user asks "evaluate my run", "what did you think of my session", ' +
          '"rate my training today", or similar. ' +
          'If no session_id is provided, evaluates the most recent completed session.',
        parameters: z.object({
          session_id: z.string().optional().describe('UUID of the training session to evaluate. If omitted, the most recent completed session is used.'),
        }),
        execute: async ({ session_id }) => {
          try {
            let targetId = session_id

            if (!targetId) {
              const { data: latest } = await supabase
                .from('training_sessions')
                .select('id, session_date, planned_type')
                .eq('user_id', user.id)
                .neq('status', 'pending')
                .order('session_date', { ascending: false })
                .limit(1)
                .single()

              if (!latest) return { success: false, message: 'No completed sessions found to evaluate.' }
              targetId = latest.id
            }

            const result = await evaluateTrainingSession(supabase, targetId, user.id)
            return {
              success: true,
              flag: result.flag,
              evaluation: result.evaluation,
              message: `Session evaluated (flag: ${result.flag}).`,
            }
          } catch (e) {
            return { success: false, message: `Evaluation failed: ${String(e)}` }
          }
        },
      },

      // ── Morning briefing tool ───────────────────────────────────

      generate_morning_briefing: {
        description:
          'Surface or generate the AI morning briefing for today. ' +
          'Use when user asks "what\'s my briefing", "how am I doing today", ' +
          '"give me my morning briefing", or similar. ' +
          'Fetches today\'s morning log and returns the readiness briefing.',
        parameters: z.object({
          date: z.string().optional().describe('ISO date YYYY-MM-DD. Defaults to today.'),
        }),
        execute: async ({ date }) => {
          try {
            const targetDate = date ?? new Date().toISOString().slice(0, 10)
            const { data: log } = await supabase
              .from('morning_logs')
              .select('id, ai_briefing')
              .eq('user_id', user.id)
              .eq('log_date', targetDate)
              .maybeSingle()

            if (!log) {
              return { success: false, message: `No morning log found for ${targetDate}. Ask the user to complete their morning check-in.` }
            }

            const result = await generateMorningBriefing(supabase, log.id, user.id)
            return { success: true, briefing: result.briefing }
          } catch (e) {
            return { success: false, message: `Failed to generate briefing: ${String(e)}` }
          }
        },
      },

      // ── Nutrition summary tool ──────────────────────────────────

      nutrition_summary: {
        description:
          'Fetch and summarise today\'s (or a specific day\'s) nutrition tracking. ' +
          'Use when user asks "how was my nutrition", "what did I eat today", ' +
          '"did I hit my targets", or similar.',
        parameters: z.object({
          date: z.string().optional().describe('ISO date YYYY-MM-DD. Defaults to today.'),
        }),
        execute: async ({ date }) => {
          try {
            const targetDate = date ?? new Date().toISOString().slice(0, 10)

            const [logRes, mealsRes] = await Promise.allSettled([
              supabase
                .from('nutrition_logs')
                .select('*')
                .eq('user_id', user.id)
                .eq('log_date', targetDate)
                .maybeSingle(),

              supabase
                .from('meals')
                .select('meal_type, description, calories, protein_g, carbs_g, fat_g, logged_at')
                .eq('user_id', user.id)
                .gte('logged_at', `${targetDate}T00:00:00`)
                .lt('logged_at', `${targetDate}T23:59:59`)
                .order('logged_at', { ascending: true }),
            ])

            const log = logRes.status === 'fulfilled' ? logRes.value.data : null
            const meals = mealsRes.status === 'fulfilled' ? (mealsRes.value.data ?? []) : []

            if (!log && meals.length === 0) {
              return { success: true, message: `No nutrition data logged for ${targetDate}.` }
            }

            const parts: string[] = [`Nutrition for ${targetDate}:`]

            if (log) {
              if (log.adherence_score != null) parts.push(`Adherence: ${log.adherence_score}/100`)
              if (log.total_calories != null) parts.push(`Calories: ${log.total_calories} kcal`)
              if (log.protein_g != null) parts.push(`Protein: ${log.protein_g}g`)
              if (log.has_alcohol) parts.push('⚠️ Alcohol consumed')
              if (log.water_ml != null) parts.push(`Water: ${log.water_ml}ml`)
              if (log.notes) parts.push(`Notes: ${log.notes}`)
            }

            if (meals.length > 0) {
              parts.push(`\nMeals (${meals.length}):`)
              for (const m of meals) {
                const macros = [
                  m.calories ? `${m.calories}kcal` : null,
                  m.protein_g ? `P:${m.protein_g}g` : null,
                  m.carbs_g ? `C:${m.carbs_g}g` : null,
                  m.fat_g ? `F:${m.fat_g}g` : null,
                ].filter(Boolean).join(' ')
                parts.push(`- [${m.meal_type ?? 'meal'}] ${m.description ?? 'unlabelled'}${macros ? ` (${macros})` : ''}`)
              }
            }

            return { success: true, summary: parts.join('\n') }
          } catch (e) {
            return { success: false, message: `Failed to fetch nutrition: ${String(e)}` }
          }
        },
      },

      // ── Trading session summary tool ─────────────────────────────

      trading_session_summary: {
        description:
          'Fetch today\'s (or a specific day\'s) trading performance and rule compliance. ' +
          'Use when user asks "how was my trading", "show me my trades", ' +
          '"did I follow my rules today", or similar. ' +
          'Automatically fires an adapt event if 3+ consecutive losing days detected.',
        parameters: z.object({
          date: z.string().optional().describe('ISO date YYYY-MM-DD. Defaults to today.'),
        }),
        execute: async ({ date }) => {
          try {
            const targetDate = date ?? new Date().toISOString().slice(0, 10)

            // Fetch today's trades
            const { data: trades } = await supabase
              .from('trades')
              .select('instrument, direction, gross_pnl, net_pnl, outcome, session, setup_tags, entry_time, exit_time, followed_rules, rules_broken, notes')
              .eq('user_id', user.id)
              .gte('entry_time', `${targetDate}T00:00:00`)
              .lt('entry_time', `${targetDate}T23:59:59`)
              .order('entry_time', { ascending: true })

            // Fetch last 7 days of trades to detect loss streaks
            const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
            const { data: recentTrades } = await supabase
              .from('trades')
              .select('entry_time, net_pnl, outcome')
              .eq('user_id', user.id)
              .gte('entry_time', `${sevenDaysAgo}T00:00:00`)
              .neq('outcome', 'open')
              .order('entry_time', { ascending: false })

            if (!trades?.length) {
              return { success: true, message: `No trades logged for ${targetDate}.` }
            }

            const totalPnl = trades.reduce((sum, t) => sum + (t.net_pnl ?? 0), 0)
            const wins = trades.filter((t) => t.outcome === 'win').length
            const losses = trades.filter((t) => t.outcome === 'loss').length
            const rulesFollowed = trades.filter((t) => t.followed_rules === true).length

            const parts: string[] = [
              `Trading summary for ${targetDate}:`,
              `Trades: ${trades.length} (${wins}W / ${losses}L)`,
              `Net P&L: $${totalPnl.toFixed(2)}`,
              rulesFollowed < trades.length
                ? `⚠️ Rules broken on ${trades.length - rulesFollowed}/${trades.length} trades`
                : `Rules followed on all trades ✅`,
            ]

            for (const t of trades) {
              const pnl = t.net_pnl != null ? ` $${t.net_pnl.toFixed(2)}` : ''
              const tags = t.setup_tags?.length ? ` [${t.setup_tags.join(',')}]` : ''
              parts.push(`- ${t.instrument} ${t.direction} ${t.outcome}${pnl}${tags}`)
            }

            // Detect consecutive losing days
            if (recentTrades && recentTrades.length > 0) {
              // Group by date
              const byDate = new Map<string, number>()
              for (const t of recentTrades) {
                const d = t.entry_time.slice(0, 10)
                byDate.set(d, (byDate.get(d) ?? 0) + (t.net_pnl ?? 0))
              }
              const sortedDates = [...byDate.keys()].sort().reverse()
              let streak = 0
              for (const d of sortedDates) {
                if ((byDate.get(d) ?? 0) < 0) streak++
                else break
              }
              if (streak >= 3) {
                maybeFireAdaptEvent(supabase, user.id, 'trading_loss_streak', {
                  streak_days: streak,
                  total_pnl: sortedDates.slice(0, streak).reduce((s, d) => s + (byDate.get(d) ?? 0), 0),
                  as_of_date: targetDate,
                }).catch((e) => console.error('[coach/trading] adapt trigger failed:', e))
                parts.push(`\n⚠️ ${streak} consecutive losing days detected — adapt event fired.`)
              }
            }

            return { success: true, summary: parts.join('\n') }
          } catch (e) {
            return { success: false, message: `Failed to fetch trading data: ${String(e)}` }
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
