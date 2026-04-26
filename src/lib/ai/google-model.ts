// Version compatibility shim: @ai-sdk/google v3.0.60 vs ai v3.4.9
//
// The Google provider emits chunks that the older AI SDK core can't process:
//   1. Unknown chunk types (stream-start, text-start, text-end, reasoning-*, file, …)
//      → dropped via allowlist
//   2. text-delta chunks use `delta` field; SDK expects `textDelta`
//      → renamed
//   3. tool-call chunks use `input` field; SDK core expects `args`
//      → renamed
//   4. tool-call-delta chunks use `inputDelta`; SDK core expects `argsTextDelta`
//      → renamed
//   5. finish.usage is nested { inputTokens: { total }, outputTokens: { total } }
//      SDK's calculateLanguageModelUsage() expects flat { promptTokens, completionTokens }
//      → translated

import { google } from '@ai-sdk/google'

const SDK_KNOWN_CHUNK_TYPES = new Set([
  'text-delta',
  'response-metadata',
  'error',
  'tool-call-delta',
  'tool-call',
  'tool-result',
  'tool-call-streaming-start',
  'finish',
])

function normaliseFinishUsage(usage: any): { promptTokens: number; completionTokens: number } {
  if (!usage) return { promptTokens: 0, completionTokens: 0 }
  // New nested shape from @ai-sdk/google v3.0.60
  if (usage.inputTokens !== undefined || usage.outputTokens !== undefined) {
    return {
      promptTokens: usage.inputTokens?.total ?? 0,
      completionTokens: usage.outputTokens?.total ?? 0,
    }
  }
  // Old flat shape — already correct
  return {
    promptTokens: usage.promptTokens ?? 0,
    completionTokens: usage.completionTokens ?? 0,
  }
}

function patchModel(model: any): any {
  return {
    ...model,
    async doStream(options: any) {
      const response = await model.doStream(options)
      return {
        ...response,
        stream: response.stream.pipeThrough(
          new TransformStream({
            transform(chunk: any, controller: TransformStreamDefaultController) {
              if (!SDK_KNOWN_CHUNK_TYPES.has(chunk.type)) return

              if (chunk.type === 'text-delta') {
                // Provider uses `delta`, SDK expects `textDelta`
                controller.enqueue({
                  ...chunk,
                  textDelta: chunk.textDelta ?? chunk.delta ?? '',
                })
                return
              }

              if (chunk.type === 'tool-call') {
                // Provider uses `input` (JSON string), SDK core expects `args`
                controller.enqueue({
                  ...chunk,
                  args: chunk.args ?? chunk.input ?? '{}',
                })
                return
              }

              if (chunk.type === 'tool-call-delta') {
                // Provider uses `inputDelta`, SDK core expects `argsTextDelta`
                controller.enqueue({
                  ...chunk,
                  argsTextDelta: chunk.argsTextDelta ?? chunk.inputDelta ?? '',
                })
                return
              }

              if (chunk.type === 'finish') {
                controller.enqueue({ ...chunk, usage: normaliseFinishUsage(chunk.usage) })
                return
              }

              controller.enqueue(chunk)
            },
          }),
        ),
      }
    },
  }
}

export function geminiFlash() {
  return patchModel(google('gemini-2.5-flash'))
}

// Tool-calling variant: gemini-2.0-flash handles structured tool calls reliably
// without the thinking model complications of 2.5-flash.
export function geminiFlashForTools() {
  return patchModel(google('gemini-2.0-flash'))
}

export function geminiPro() {
  return patchModel(google('gemini-2.5-pro'))
}
