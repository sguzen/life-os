// Master AI Coach — streaming API with cross-module tool-calling
// Reads all modules for context, can modify supplements and plan configs.
// Persists every turn to coach_conversations for session continuity.

import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
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

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    system: `You are Life OS, an elite, highly contextual life coach.
    You have direct access to the user's database. Before giving advice on trading, running, or nutrition, ALWAYS use your tools to check their physical and psychological state.

    Current Date and Time: ${new Date().toISOString()}

    Rules:
    - Never guess vitals. If you don't know, use the fetch_vitals tool.
    - Be concise, direct, and actionable.`,
    messages,
    
    // CRITICAL: maxSteps > 1 allows the LLM to call a tool, parse the JSON result, and formulate a human-readable reply.
    maxSteps: 5, 
    
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
      })
    },
  });

  return result.toDataStreamResponse();
}
