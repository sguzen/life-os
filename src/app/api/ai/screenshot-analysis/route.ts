// Screenshot Analysis — Gemini Vision API route
// Accepts a chart screenshot, extracts trade details, returns structured JSON with confidence scores

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 30

const EXTRACTION_PROMPT = `You are a professional futures trading chart analyzer. Analyze this trading chart screenshot and extract key trade details.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation. Example of the exact format to return:
{
  "instrument": { "value": "NQ", "confidence": 0.95 },
  "direction": { "value": "long", "confidence": 0.9 },
  "entry_price": { "value": 17234.5, "confidence": 0.85 },
  "exit_price": { "value": 17289.0, "confidence": 0.8 },
  "session": { "value": "new_york_am", "confidence": 0.75 }
}

Field rules:
- instrument: one of "NQ" (Nasdaq/MNQ futures), "Gold" (XAUUSD/GC/MGC), "CL" (Crude Oil), "6E" (EUR/USD futures), or null
- direction: "long" if BUY/LONG or entry below exit, "short" if SELL/SHORT or entry above exit, or null
- entry_price: number where trade was entered (entry markers, horizontal lines, order labels), or null
- exit_price: number where trade was closed (TP hit, SL hit, close labels), or null
- session: "london" (02-08 EST), "new_york_am" (08-12 EST), "new_york_pm" (12-17 EST), "overnight" (17-02 EST), "asia" (18-02 EST), or null
- confidence: 1.0 = certain, 0.8 = very likely, 0.5 = uncertain, 0.0 = cannot determine; use 0.0 and null when a field cannot be determined

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

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'Image too large. Max 10 MB.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  let result: Awaited<ReturnType<typeof generateText>>
  try {
    result = await generateText({
      model: google('gemini-2.5-flash'),
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini API error'
    return Response.json({ error: msg }, { status: 502 })
  }

  const stripped = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  const raw = jsonMatch ? jsonMatch[0] : stripped

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'Failed to parse AI response', raw: result.text }, { status: 422 })
  }

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