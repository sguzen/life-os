'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

// ── Validation ─────────────────────────────────────────────────

const formSchema = z.object({
  trigger_type: z.enum(['illness', 'injury', 'fatigue', 'poor_sleep']),
  severity: z.number().int().min(1).max(5),
  symptoms: z.string().optional(),
  affected_body_part: z.string().optional(),
  sleep_hours: z.number().min(0).max(24).optional(),
  resting_hr: z.number().int().min(30).max(120).optional(),
  estimated_days: z.number().int().min(1).max(14),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

// ── Constants ──────────────────────────────────────────────────

const TRIGGER_OPTIONS = [
  { value: 'illness', label: 'Illness', emoji: '🤒' },
  { value: 'injury', label: 'Injury', emoji: '🦵' },
  { value: 'fatigue', label: 'Fatigue', emoji: '😴' },
  { value: 'poor_sleep', label: 'Poor Sleep', emoji: '💤' },
] as const

const SEVERITY_OPTIONS = [
  { value: 1, label: 'Mild', description: 'Can push through' },
  { value: 2, label: 'Noticeable', description: 'Affects performance' },
  { value: 3, label: 'Moderate', description: 'Training compromised' },
  { value: 4, label: 'Significant', description: 'Rest needed' },
  { value: 5, label: 'Severe', description: 'Complete rest essential' },
]

const ILLNESS_SYMPTOMS = ['Fever', 'Sore throat', 'Congestion', 'Body aches', 'GI issues', 'Fatigue']

const BODY_PARTS = [
  'Foot', 'Ankle', 'Knee', 'Hip', 'IT band', 'Calf', 'Hamstring', 'Shin', 'Back', 'Other',
]

const DURATION_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 2, label: '2-3 days' },
  { value: 5, label: 'Rest of week' },
  { value: 7, label: 'Not sure (7 days)' },
]

// ── Component ──────────────────────────────────────────────────

export function TriggerReportForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<Partial<FormData>>({
    estimated_days: 2,
  })

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [hasFever, setHasFever] = useState(false)
  const [painAtRest, setPainAtRest] = useState(false)

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleSymptom(s: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  // Auto-escalate severity for fever or pain at rest
  function getSeverity() {
    let sev = form.severity ?? 1
    if (hasFever) sev = Math.max(sev, 4)
    if (painAtRest) sev = Math.max(sev, 4)
    return sev
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        ...form,
        severity: getSeverity(),
        symptoms: selectedSymptoms.join(', ') || form.symptoms || null,
      }

      const result = formSchema.safeParse(payload)
      if (!result.success) {
        setError('Please fill in all required fields.')
        setSubmitting(false)
        return
      }

      // Create adaptation event
      const res = await fetch('/api/adapt/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      })

      if (!res.ok) throw new Error('Failed to create event')
      const { eventId } = await res.json()

      // Run triage
      await fetch('/api/ai/adaptation-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, triggerData: result.data }),
      })

      router.push(`/adapt/review/${eventId}`)
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-amber-400' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Trigger type */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">What's happening?</h2>
          <div className="grid grid-cols-2 gap-3">
            {TRIGGER_OPTIONS.map(({ value, label, emoji }) => (
              <button
                key={value}
                onClick={() => {
                  set('trigger_type', value)
                  setStep(2)
                }}
                className={`rounded-xl border p-5 text-left transition-colors ${
                  form.trigger_type === value
                    ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/8 hover:text-white'
                }`}
              >
                <div className="text-2xl mb-2">{emoji}</div>
                <div className="font-medium text-sm">{label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Severity */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">How severe is it?</h2>
          <div className="space-y-2">
            {SEVERITY_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => {
                  set('severity', value)
                  setStep(3)
                }}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors flex items-center justify-between ${
                  form.severity === value
                    ? 'border-amber-400/60 bg-amber-400/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold w-6 text-center ${
                    value <= 2 ? 'text-green-400' : value === 3 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {value}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-white">{label}</div>
                    <div className="text-xs text-white/40">{description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-xs text-white/30 hover:text-white/50">
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Details (conditional) */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-white">Tell me more</h2>

          {form.trigger_type === 'illness' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-white/60 mb-2">Symptoms (select all that apply)</p>
                <div className="flex flex-wrap gap-2">
                  {ILLNESS_SYMPTOMS.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSymptom(s)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        selectedSymptoms.includes(s)
                          ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                          : 'border-white/20 text-white/50 hover:border-white/40'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-white/60 mb-2">Fever?</p>
                <div className="flex gap-2">
                  {['Yes', 'No'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        const yes = opt === 'Yes'
                        setHasFever(yes)
                        if (yes && selectedSymptoms.indexOf('Fever') === -1) {
                          setSelectedSymptoms((prev) => [...prev, 'Fever'])
                        }
                      }}
                      className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                        (opt === 'Yes' ? hasFever : !hasFever)
                          ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                          : 'border-white/10 bg-white/5 text-white/50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {hasFever && (
                  <p className="text-xs text-red-400 mt-2">
                    ⚠️ Fever = no running. Severity set to minimum 4.
                  </p>
                )}
              </div>
            </div>
          )}

          {form.trigger_type === 'injury' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 block mb-2">Affected body part</label>
                <select
                  value={form.affected_body_part ?? ''}
                  onChange={(e) => set('affected_body_part', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber-400/50 focus:outline-none"
                >
                  <option value="">Select...</option>
                  {BODY_PARTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-sm text-white/60 mb-2">Pain also at rest?</p>
                <div className="flex gap-2">
                  {['Yes', 'No'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPainAtRest(opt === 'Yes')}
                      className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                        (opt === 'Yes' ? painAtRest : !painAtRest)
                          ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                          : 'border-white/10 bg-white/5 text-white/50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {painAtRest && (
                  <p className="text-xs text-red-400 mt-2">
                    ⚠️ Rest-pain injuries need professional assessment. No running.
                  </p>
                )}
              </div>
            </div>
          )}

          {(form.trigger_type === 'fatigue' || form.trigger_type === 'poor_sleep') && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">
                  Hours slept last night
                </label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={form.sleep_hours ?? ''}
                  onChange={(e) => set('sleep_hours', parseFloat(e.target.value))}
                  placeholder="e.g. 5.5"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-amber-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">
                  Morning resting HR (bpm) — optional
                </label>
                <input
                  type="number"
                  min={30}
                  max={120}
                  value={form.resting_hr ?? ''}
                  onChange={(e) => set('resting_hr', parseInt(e.target.value))}
                  placeholder="e.g. 52"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-amber-400/50 focus:outline-none"
                />
                <p className="text-xs text-white/30 mt-1">Baseline: 42-49 bpm</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-white/60 block mb-1">
              Additional notes (optional)
            </label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Anything else relevant..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-amber-400/50 focus:outline-none resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex-1 rounded-lg bg-amber-500/20 border border-amber-400/30 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Duration + submit */}
      {step === 4 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-white">How long do you expect this to last?</h2>
          <div className="grid grid-cols-2 gap-2">
            {DURATION_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => set('estimated_days', value)}
                className={`rounded-lg border px-4 py-3 text-sm transition-colors ${
                  form.estimated_days === value
                    ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/8'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Summary</p>
            <p className="text-sm text-white">
              {TRIGGER_OPTIONS.find((t) => t.value === form.trigger_type)?.emoji}{' '}
              {form.trigger_type} — Severity {getSeverity()}/5
            </p>
            {selectedSymptoms.length > 0 && (
              <p className="text-xs text-white/50">{selectedSymptoms.join(', ')}</p>
            )}
            <p className="text-xs text-white/40">
              Expected: ~{form.estimated_days} day{(form.estimated_days ?? 1) > 1 ? 's' : ''}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit & Get AI Assessment →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
