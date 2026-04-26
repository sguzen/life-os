// Screenshot Analysis — Gemini Vision API route
// Accepts a chart screenshot, extracts trade details, returns structured JSON with confidence scores

import { google } from '@ai-sdk/google'
import { generateObject, type LanguageModelV1 } from 'ai'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 30

const FieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({ value: valueSchema, confidence: z.number().min(0).max(1) })

const ExtractionSchema = z.object({
  instrument: FieldSchema(z.enum(['NQ', 'Gold', 'CL', '6E']).nullable()),
  direction: FieldSchema(z.enum(['long', 'short']).nullable()),
  entry_price: FieldSchema(z.number().nullable()),
  exit_price: FieldSchema(z.number().nullable()),
  session: FieldSchema(z.enum(['london', 'new_york_am', 'new_york_pm', 'overnight', 'asia']).nullable()),
})

const EXTRACTION_PROMPT = `You are a professional futures trading chart analyzer. Analyze this trading chart screenshot and extract key trade details.

Field rules:
- instrument: "NQ" (Nasdaq/MNQ futures), "Gold" (XAUUSD/GC/MGC), "CL" (Crude Oil), "6E" (EUR/USD futures), or null
- direction: "long" if BUY/LONG or entry below exit, "short" if SELL/SHORT or entry above exit, or null
- entry_price: number where trade was entered (entry markers, horizontal lines, order labels), or null
- exit_price: number where trade was closed (TP hit, SL hit, close labels), or null
- session: "london" (02-08 EST), "new_york_am" (08-12 EST), "new_york_pm" (12-17 EST), "overnight" (17-02 EST), "asia" (18-02 EST), or null
- confidence: 1.0 = certain, 0.8 = very likely, 0.5 = uncertain, 0.0 = cannot determine; use 0.0 and null when a field cannot be determined`

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

  try {
    const { object } = await generateObject({
      model: google('gemini-1.5-flash-latest') as unknown as LanguageModelV1,
      schema: ExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: base64, mimeType },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
      maxTokens: 1024,
      temperature: 0.1,
    })

    return Response.json(object)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini API error'
    return Response.json({ error: msg }, { status: 502 })
  }
}
