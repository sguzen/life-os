// Screenshot Analysis — Gemini Vision API route
// Accepts a chart screenshot, extracts trade details, returns structured JSON with confidence scores

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 30

const EXTRACTION_PROMPT = `You are a professional futures trading chart analyzer. Analyze this trading chart screenshot and extract key trade details.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "instrument": { "value": "NQ" | "Gold" | "CL" | "6E" | null, "confidence": 0.0-1.0 },
  "direction": { "value": "long" | "short" | null, "confidence": 0.0-1.0 },
  "entry_price": { "value": <number> | null, "confidence": 0.0-1.0 },
  "exit_price": { "value": <number> | null, "confidence": 0.0-1.0 },
  "session": { "value": "london" | "new_york_am" | "new_york_pm" | "overnight" | "asia" | null, "confidence": 0.0-1.0 }
}

Rules:
- instrument: NQ = Nasdaq/MNQ futures, Gold = XAUUSD/GC/MGC, CL = Crude Oil, 6E = EUR/USD futures
- direction: long if entry is below exit or arrow/label says BUY/LONG, short if entry is above exit or says SELL/SHORT
- entry_price: the price where the trade was entered (look for entry markers, horizontal lines, order labels)
- exit_price: the price where the trade was closed (look for exit markers, TP hit, SL hit, close labels)
- session: based on time visible on chart — london=02:00-08:00 EST, new_york_am=08:00-12:00 EST, new_york_pm=12:00-17:00 EST, overnight=17:00-02:00 EST, asia=18:00-02:00 EST
- confidence: 1.0 = certain, 0.8 = very likely, 0.5 = uncertain, 0.0 = cannot determine
- Set value to null and confidence to 0.0 if you cannot determine a field

Return ONLY the JSON object, nothing else.`

export async function POST(req: Request) {
  let file: File | null = null
  try {
    const formData = await req.formData()
    file = formData.get('screenshot') as File | null
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!file) {
    return Response.json({ error: 'No screenshot provided' }, { status: 400 })
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return Response.json({ error: 'Unsupported image type. Use JPEG, PNG, or WebP.' }, { status: 400 })
  }

  // 10 MB limit
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'Image too large. Max 10 MB.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const result = await generateText({
    model: google('gemini-1.5-flash-latest'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: base64,
            mimeType,
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
    maxOutputTokens: 512,
    temperature: 0.1,
  })

  // Strip any markdown code fences Gemini may add
  const raw = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'Failed to parse AI response', raw: result.text }, { status: 422 })
  }

  // Validate shape and clamp confidence values
  function field(data: unknown, validValues?: string[]) {
    if (!data || typeof data !== 'object') return { value: null, confidence: 0 }
    const d = data as Record<string, unknown>
    const confidence = Math.min(1, Math.max(0, typeof d.confidence === 'number' ? d.confidence : 0))
    const value = d.value ?? null
    if (value !== null && validValues && !validValues.includes(value as string)) {
      return { value: null, confidence: 0 }
    }
    return { value, confidence }
  }

  const p = parsed as Record<string, unknown>
  const sanitised = {
    instrument: field(p.instrument, ['NQ', 'Gold', 'CL', '6E']),
    direction: field(p.direction, ['long', 'short']),
    entry_price: (() => {
      const f = field(p.entry_price)
      return { value: typeof f.value === 'number' ? f.value : null, confidence: f.confidence }
    })(),
    exit_price: (() => {
      const f = field(p.exit_price)
      return { value: typeof f.value === 'number' ? f.value : null, confidence: f.confidence }
    })(),
    session: field(p.session, ['london', 'new_york_am', 'new_york_pm', 'overnight', 'asia']),
  }

  return Response.json(sanitised)
}
