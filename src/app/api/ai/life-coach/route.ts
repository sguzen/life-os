// src/app/api/ai/life-coach/route.ts
import { google } from '@ai-sdk/google';
import { streamText, convertToCoreMessages } from 'ai';
import { getSystemSnapshot } from '@/lib/ai/get-system-snapshot';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    // 1. Fetch the live data snapshot BEFORE talking to Gemini
    const liveDataSnapshot = await getSystemSnapshot();
    
    // 2. Construct the ultimate System Prompt
    const systemPrompt = `
You are the Life OS Command Center. You are an expert Life Coach, Trading Psychologist, and Marathon Coach.

CRITICAL INSTRUCTION:
You HAVE FULL ACCESS to the user's database via the LIVE_OS_DATA_SNAPSHOT provided below. 
You are FORBIDDEN from saying "I cannot directly retrieve details" or "I do not have access." 
If a user asks about their runs or trades, you MUST read the JSON below and give them the exact numbers.

### LIVE_OS_DATA_SNAPSHOT:
${liveDataSnapshot}

RULES:
1. Be concise, blunt, and data-driven.
2. If the user asks about their trading, look at the 'recent_trades' array.
3. If they ask about running, look at the 'recent_runs' array.
4. If the arrays are empty, tell them "You have no trades/runs logged in the database yet," but do NOT say you lack access.
    `;

    // 3. Call Gemini (Using 2.5 Flash)
    const result = await streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: convertToCoreMessages(messages),
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Coach API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to connect to Coach" }), { status: 500 });
  }
}