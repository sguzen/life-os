import { sampleCorrelation } from 'simple-statistics'

export interface CorrelationResult {
  metricA: string
  metricB: string
  coefficient: number
  sampleSize: number
}

// Minimum overlapping data points required to trust the correlation
const MIN_SAMPLE_SIZE = 5
// Only surface correlations with strong signal
const SIGNIFICANCE_THRESHOLD = 0.7

export function calculateCorrelations(logs: { metrics: Record<string, unknown> }[]): CorrelationResult[] {
  // Build aligned pairs per metric combination directly from logs.
  // We iterate logs once per pair rather than pre-bucketing, so sparse
  // metrics (e.g. hrv only logged some days) align correctly with each other.
  const keys = extractNumericKeys(logs)
  const results: CorrelationResult[] = []

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i]
      const b = keys[j]
      const pairsA: number[] = []
      const pairsB: number[] = []

      for (const log of logs) {
        if (!log.metrics) continue
        const na = toNumber(log.metrics[a])
        const nb = toNumber(log.metrics[b])
        if (na !== null && nb !== null) {
          pairsA.push(na)
          pairsB.push(nb)
        }
      }

      if (pairsA.length < MIN_SAMPLE_SIZE) continue

      // sampleCorrelation throws if a series has zero variance (constant values)
      let coefficient: number
      try {
        coefficient = sampleCorrelation(pairsA, pairsB)
      } catch {
        continue
      }

      if (!isFinite(coefficient)) continue
      if (Math.abs(coefficient) < SIGNIFICANCE_THRESHOLD) continue

      results.push({
        metricA: a,
        metricB: b,
        coefficient: parseFloat(coefficient.toFixed(4)),
        sampleSize: pairsA.length,
      })
    }
  }

  return results
}

export function buildInsightText(metricA: string, metricB: string, coefficient: number): string {
  const direction = coefficient > 0 ? 'positive' : 'negative'
  const strength = Math.abs(coefficient) >= 0.9 ? 'very strong' : 'strong'
  const rounded = coefficient.toFixed(2)
  return `Your '${metricA}' and '${metricB}' have a ${strength} ${direction} correlation (${rounded}).`
}

// ── helpers ────────────────────────────────────────────────────────────────────

function extractNumericKeys(logs: { metrics: Record<string, unknown> }[]): string[] {
  const seen = new Set<string>()
  for (const log of logs) {
    if (!log.metrics) continue
    for (const [key, value] of Object.entries(log.metrics)) {
      if (toNumber(value) !== null) seen.add(key)
    }
  }
  return Array.from(seen)
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return isFinite(n) ? n : null
  }
  return null
}
