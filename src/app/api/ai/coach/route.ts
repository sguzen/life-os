// Master AI Coach — streaming API with cross-module tool-calling
// Reads all modules for context, can modify supplements and plan configs.
// Persists every turn to coach_conversations for session continuity.

import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages, StreamingTextResponse, tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // NOTE: do NOT await streamText — in AI SDK v6 it returns a StreamTextResult
  // synchronously. Awaiting it resolves to the final text and loses the streaming
  // helper methods like toDataStreamResponse().
  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: `You are Life OS, an elite, highly contextual life coach.
    You have direct access to the user's database. Before giving advice on trading, running, or nutrition, ALWAYS use your tools to check their physical and psychological state.

    Current Date and Time: ${new Date().toISOString()}

    Rules:
    - Never guess vitals. If you don't know, use the fetch_vitals tool.
    - Be concise, direct, and actionable.
    - If the user wants to start a fresh running plan or states their race is soon, use \`clear_running_plan\` to wipe the slate, then use \`draft_running_plan\` to propose a new schedule for them to approve.`,
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

      // Tool 5: Draft a running plan (returns sessions to client for interactive approval)
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

  return new StreamingTextResponse(result.toAIStream());
}
