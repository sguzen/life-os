'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { AdaptationEvent, RecoveryCheckin as RecoveryCheckinType } from '@/lib/types'

interface RecoveryCheckinProps {
  event: AdaptationEvent
  existingCheckin?: RecoveryCheckinType | null
  dayNumber: number
  onRecovered: () => void
}

export function RecoveryCheckin({ event, existingCheckin, dayNumber, onRecovered }: RecoveryCheckinProps) {
  const [score, setScore] = useState(existingCheckin?.feeling_score ?? 0)
  const [symptoms, setSymptoms] = useState(existingCheckin?.symptoms_present ?? true)
  const [rhr, setRhr] = useState<string>(existingCheckin?.resting_hr?.toString() ?? '')
  const [notes, setNotes] = useState(existingCheckin?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    recommendation: string
    message: string
    ready_for_normal_training: boolean
  } | null>(null)
  const [markingRecovered, setMarkingRecovered] = useState(false)

  const alreadySubmitted = !!existingCheckin && !result

  async function handleSubmit() {
    if (score === 0) return
    setSubmitting(true)

    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/api/ai/adaptation-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          checkinData: {
            checkin_date: today,
            feeling_score: score,
            symptoms_present: symptoms,
            resting_hr: rhr ? parseInt(rhr) : null,
            notes: notes || null,
            trigger_type: event.trigger_type,
            severity: event.severity,
            day_number: dayNumber,
          },
        }),
      })

      if (!res.ok) throw new Error('Failed to submit')
      const { recommendation } = await res.json()
      setResult(recommendation)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkRecovered() {
    setMarkingRecovered(true)
    try {
      await fetch('/api/adapt/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, status: 'recovered' }),
      })
      onRecovered()
    } finally {
      setMarkingRecovered(false)
    }
  }

  const recommendation = result ?? (existingCheckin?.ai_recommendation
    ? { recommendation: existingCheckin.ai_recommendation, message: '', ready_for_normal_training: false }
    : null)

  const recColor = {
    return_to_normal: 'border-green-500/30 bg-green-500/10 text-green-300',
    continue_modified: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    extend_adaptation: 'border-red-500/30 bg-red-500/10 text-red-300',
  }[recommendation?.recommendation ?? 'continue_modified'] ?? 'border-amber-400/30 bg-amber-400/10 text-amber-300'

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">How are you feeling today?</h3>
        <p className="text-xs text-white/40">Recovery day {dayNumber}</p>
      </div>

      {/* Score selector */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-xs text-white/30">Terrible</span>
          <span className="text-xs text-white/30">Great</span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setScore(n)}
              className={`flex-1 rounded-md py-2 text-xs font-bold transition-colors ${
                score === n
                  ? n >= 7
                    ? 'bg-green-500/30 text-green-300 border border-green-500/40'
                    : n >= 4
                    ? 'bg-amber-400/30 text-amber-300 border border-amber-400/40'
                    : 'bg-red-500/30 text-red-300 border border-red-500/40'
                  : 'bg-white/5 text-white/30 border border-white/10 hover:bg-white/8'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Symptoms */}
      <div>
        <p className="text-sm text-white/60 mb-2">Still have symptoms?</p>
        <div className="flex gap-2">
          {['Yes', 'No'].map((opt) => (
            <button
              key={opt}
              onClick={() => setSymptoms(opt === 'Yes')}
              className={`rounded-lg border px-5 py-2 text-sm transition-colors ${
                (opt === 'Yes' ? symptoms : !symptoms)
                  ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                  : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/8'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* RHR */}
      <div>
        <label className="text-sm text-white/60 block mb-1">
          Morning RHR (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={30}
            max={120}
            value={rhr}
            onChange={(e) => setRhr(e.target.value)}
            placeholder="bpm"
            className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-amber-400/50 focus:outline-none"
          />
          <span className="text-xs text-white/30">baseline: 42-49 bpm</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-sm text-white/60 block mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="How you're feeling, anything notable..."
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-amber-400/50 focus:outline-none resize-none"
        />
      </div>

      {/* Submit */}
      {!alreadySubmitted && (
        <button
          onClick={handleSubmit}
          disabled={score === 0 || submitting}
          className="w-full rounded-lg bg-amber-500/20 border border-amber-400/30 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit →'}
        </button>
      )}

      {/* AI Recommendation */}
      {recommendation && (
        <div className={`rounded-lg border px-4 py-3 space-y-2 ${recColor}`}>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
            AI Recommendation
          </p>
          <p className="text-sm font-medium">
            {recommendation.recommendation === 'return_to_normal' && '✅ Return to normal training'}
            {recommendation.recommendation === 'continue_modified' && '🔄 Continue modified plan'}
            {recommendation.recommendation === 'extend_adaptation' && '⚠️ Extend rest period'}
          </p>
          {result?.message && (
            <p className="text-xs opacity-80 leading-relaxed">{result.message}</p>
          )}
          {(recommendation.recommendation === 'return_to_normal' || result?.ready_for_normal_training) && (
            <button
              onClick={handleMarkRecovered}
              disabled={markingRecovered}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-green-500/20 border border-green-500/30 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/30 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {markingRecovered ? 'Marking...' : 'Mark as Recovered'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
