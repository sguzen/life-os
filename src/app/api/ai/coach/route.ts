// Master AI Coach — streaming API with cross-module tool-calling
// Reads all modules for context, can modify supplements and plan configs.
// Persists every turn to coach_conversations for session continuity.

import { streamText, tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { geminiFlashForTools } from '@/lib/ai/google-model';

export const maxDuration = 60;


export async function POST(req: Request) {
  const { messages, systemOverride } = await req.json();
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Fetch the 5 most recent actionable insights produced by the correlation engine
  // Graceful fallback: user_insights table may not exist yet
  const { data: insights } = await supabase
    .from('user_insights')
    .select('insight_text, confidence')
    .eq('user_id', user.id)
    .eq('actionable', true)
    .order('created_at', { ascending: false })
    .limit(5)
    .then((res) => ({ data: res.data }))
    .catch(() => ({ data: null }));

  const insightBlock = insights && insights.length > 0
    ? `\n\nRecent Mathematical Insights from the Correlation Engine:\n${insights.map((ins, i) => `${i + 1}. ${ins.insight_text}${ins.confidence != null ? ` (confidence: ${(ins.confidence * 100).toFixed(0)}%)` : ''}`).join('\n')}\nRely on these facts instead of attempting to calculate statistical trends yourself.`
    : '';

  const result = await streamText({
    model: geminiFlashForTools(),
    system: systemOverride ?? `You are the Life OS orchestrator. You help the user set up their life goals across Training, Nutrition, Work, Hobbies, and Morning routines. You track their data flexibly. If they lack a setup, guide them through it.

    Current Date and Time: ${new Date().toISOString()}${insightBlock}

    Rules:
    - Never guess vitals. If you don't know, use the fetch_vitals tool.
    - Be concise, direct, and actionable.
    - During onboarding, gather the user's name, key life domains, and specific goals, then call \`complete_onboarding\` to save their profile.
    - For each goal, extract a \`target_metrics\` JSONB object with measurable keys (e.g. {"sessions_per_week": 3} for training, {"protein_g": 150} for nutrition).
    - If the user wants to start a fresh running plan or states their race is soon, use \`clear_running_plan\` to wipe the slate, then use \`draft_running_plan\` to propose a new schedule for them to approve.
    - When the user asks for a summary, progress report, dashboard, or "how am I doing" for any category, call \`show_metrics_dashboard\` to render a visual widget. Populate dataPoints from context — do not fetch data first unless you genuinely need live values.
    - When the user asks to see their data visually, or when you identify a trend they should track over time, call \`suggest_dashboard_widget\` to propose a chart they can pin to their dashboard.`,
    messages,

    // CRITICAL: maxSteps > 1 allows the LLM to call a tool, parse the JSON result, and formulate a human-readable reply.
    maxSteps: 5,
    onError: ({ error }) => {
      console.error('[coach/route] streamText error:', error)
    },

    tools: {
      // Tool 1: Fetch Morning Vitals
      fetch_vitals: tool({
        description: 'Get the user\'s resting heart rate (RHR), sleep hours, HRV, mood, and morning journal for a specific date.',
        parameters: z.object({
          date: z.string().describe('The date to query in YYYY-MM-DD format. Default to today if not specified.'),
        }),
        execute: async ({ date }) => {
          const { data, error } = await supabase
            .from('morning_logs')
            .select('sleep_hours, rhr, hrv, mood_score, energy_level, journal_notes')
            .eq('user_id', user.id)
            .eq('log_date', date)
            .single();

          if (error || !data) {
            return { status: `No vitals logged yet for ${date}.` };
          }
          return data;
        },
      }),

      // Tool 2: Fetch Daily Tasks
      fetch_tasks: tool({
        description: 'Get the user\'s specific coach-assigned or daily tasks for a target date.',
        parameters: z.object({
          date: z.string().describe('The date to query in YYYY-MM-DD format.'),
        }),
        execute: async ({ date }) => {
          const { data, error } = await supabase
            .from('coach_tasks')
            .select('id, task_description, completed')
            .eq('user_id', user.id)
            .eq('target_date', date);

          if (error) return { error: error.message };
          return data || [];
        },
      }),

      // Tool 3: Create a Task (Proactive Coaching)
      create_task: tool({
        description: 'Assign a new task to the user based on our conversation (e.g., "Take Magnesium before bed", "Lower trade size today").',
        parameters: z.object({
          task_description: z.string(),
          target_date: z.string().describe('YYYY-MM-DD format')
        }),
        execute: async ({ task_description, target_date }) => {
           const { error } = await supabase
             .from('coach_tasks')
             .insert({
                user_id: user.id,
                task_description,
                target_date,
                completed: false
             });

           if (error) return { status: 'Failed to create task.' };
           return { status: 'Task successfully added to the user\'s agenda.' };
        }
      }),

      // Tool 4: Clear future running plan
      // NOTE: Gemini rejects tools with a fully-empty parameters schema, so we
      // include a no-op optional field as a workaround.
      clear_running_plan: tool({
        description: 'Deletes all future scheduled running sessions (scheduled_date >= today) from the marathon_plan table. Use this before drafting a fresh plan.',
        parameters: z.object({ _confirm: z.boolean().optional() }),
        execute: async () => {
          const today = new Date().toISOString().split('T')[0];
          const { error } = await supabase
            .from('marathon_plan')
            .delete()
            .eq('user_id', user.id)
            .gte('scheduled_date', today);

          if (error) return { success: false, message: 'Failed to clear running plan.' };
          return { success: true, message: 'Running plan cleared. Ready to draft a new schedule.' };
        },
      }),

      // Tool 5: Complete onboarding — saves user profile and goals
      complete_onboarding: tool({
        description: 'Called when the user has finished the setup conversation. Saves their profile summary and goals, then marks setup as complete.',
        parameters: z.object({
          profile_summary: z.string().describe('A 2-3 sentence summary of who the user is and what they want to achieve.'),
          goals: z.array(
            z.object({
              category: z.enum(['training', 'nutrition', 'work', 'hobby', 'morning']),
              title: z.string().describe('Short title for the goal, e.g. "Run 30 km/week"'),
              description: z.string().optional(),
              target_metrics: z.record(z.unknown()).describe('Key-value pairs of measurable targets, e.g. {"sessions_per_week": 3}'),
            })
          ).describe('List of user goals, one per life domain they mentioned.'),
        }),
        execute: async ({ profile_summary, goals }) => {
          // Upsert user_profiles
          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
              user_id: user.id,
              ai_context: profile_summary,
              setup_completed: true,
            }, { onConflict: 'user_id' });

          if (profileError) return { success: false, error: profileError.message };

          // Insert goals (clear old ones first so re-setup is idempotent)
          await supabase
            .from('user_goals')
            .update({ is_active: false })
            .eq('user_id', user.id);

          const goalRows = goals.map((g) => ({
            user_id: user.id,
            category: g.category,
            title: g.title,
            description: g.description ?? null,
            target_metrics: g.target_metrics,
            is_active: true,
          }));

          const { error: goalsError } = await supabase
            .from('user_goals')
            .insert(goalRows);

          if (goalsError) return { success: false, error: goalsError.message };

          return {
            success: true,
            setup_completed: true,
            message: "Your Life OS is now configured! I've saved your goals and profile. Let's get started.",
          };
        },
      }),

      // Tool 6: Generative UI — render a metrics dashboard widget in the chat
      show_metrics_dashboard: tool({
        description: 'Call this tool whenever the user asks for a summary, progress report, or visual dashboard of their metrics for a specific category (e.g., training, work, nutrition). Populate dataPoints from your knowledge of the conversation context.',
        parameters: z.object({
          category: z.string().describe('Life domain: training, nutrition, work, hobby, or morning'),
          summaryText: z.string().describe('1-2 sentence narrative summary of the user\'s current status in this category.'),
          dataPoints: z.array(
            z.object({
              label: z.string().describe('Short metric name, e.g. "Sessions this week"'),
              value: z.union([z.string(), z.number()]).describe('The metric value, e.g. 4 or "4 km"'),
            })
          ).describe('Key metrics to display. Use 2-6 points for best layout.'),
        }),
        execute: async ({ category, summaryText, dataPoints }) => {
          // Return params directly — the frontend renders the widget.
          return { category, summaryText, dataPoints };
        },
      }),

      // Tool 7: Suggest a dashboard widget (Generative UI — pinnable by user)
      suggest_dashboard_widget: tool({
        description: 'Suggest a visual dashboard widget when the user asks to see their data or when you identify a trend they should track over time. The frontend will render the chart inside the chat with a "Pin to Dashboard" button.',
        parameters: z.object({
          chart_type: z.enum(['line', 'bar', 'scatter']).describe('The Recharts chart type to render'),
          metric_keys: z.array(z.string()).describe('The metric keys from daily_logs.metrics to plot, e.g. ["sleep_hours", "deep_work_hours"]'),
          title: z.string().optional().describe('Optional human-readable title for the widget'),
        }),
        execute: async ({ chart_type, metric_keys, title }) => {
          // Return the raw config — the frontend renders DynamicWidget and handles pinning.
          return { chart_type, metric_keys, title: title ?? null };
        },
      }),

      // Tool 9: Render an interactive chart with live daily_logs data
      render_dashboard_widget: tool({
        description: 'Generates an interactive visual chart for the user when they ask about their metrics, or when you want to visually prove a correlation or insight. Fetches real data from the last 14 days.',
        parameters: z.object({
          chartType: z.enum(['line', 'bar']).describe('line for trends over time, bar for comparing totals'),
          metricKeys: z.array(z.string()).describe('Metric keys to plot from daily_logs.metrics, e.g. ["hrv", "sleep_hours"]'),
          explanation: z.string().describe('A brief natural language summary of what the chart shows and why it matters'),
        }),
        execute: async ({ chartType, metricKeys, explanation }) => {
          const since = new Date();
          since.setDate(since.getDate() - 14);
          const sinceStr = since.toISOString().split('T')[0];

          const { data: logs, error: logsErr } = await supabase
            .from('daily_logs')
            .select('date, metrics')
            .eq('user_id', user.id)
            .gte('date', sinceStr)
            .order('date', { ascending: true });

          if (logsErr) {
            return { config: { chartType, metricKeys }, data: [], explanation: `${explanation} (No data yet — seed mock data or log some entries first.)` };
          }

          // Reshape sparse JSONB rows into flat Recharts-compatible objects
          const formattedData: Record<string, unknown>[] = (logs ?? []).map((log) => {
            const metrics = (log.metrics ?? {}) as Record<string, unknown>;
            const point: Record<string, unknown> = {
              // Trim to MM-DD for compact x-axis labels
              date: log.date.slice(5),
            };
            for (const key of metricKeys) {
              const v = metrics[key];
              if (typeof v === 'number') {
                point[key] = v;
              } else if (typeof v === 'string') {
                const n = parseFloat(v);
                if (isFinite(n)) point[key] = n;
              }
              // Absent keys are omitted — connectNulls handles gaps on LineChart
            }
            return point;
          });

          return {
            config: { chartType, metricKeys },
            data: formattedData,
            explanation,
          };
        },
      }),

      // Tool 8: Draft a running plan (returns sessions to client for interactive approval)
      draft_running_plan: tool({
        description: "Drafts a multi-day or multi-week running plan based on the user's goals. This will display a preview to the user for approval. Do NOT hallucinate past dates.",
        parameters: z.object({
          sessions: z.array(
            z.object({
              scheduled_date: z.string().describe('YYYY-MM-DD format. Must be today or a future date.'),
              workout_type: z.string().describe('e.g. Easy Run, Tempo, Long Run, Intervals, Rest'),
              target_distance: z.number().describe('Distance in kilometres'),
              target_pace: z.string().describe('Target pace string, e.g. "5:30/km" or "Easy"'),
            })
          ).describe('Ordered list of training sessions for the plan'),
        }),
        execute: async ({ sessions }) => {
          // Return the drafted sessions to the client — the frontend renders
          // PlanDraftPreview so the user can edit and approve before saving.
          return { draftedSessions: sessions };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
