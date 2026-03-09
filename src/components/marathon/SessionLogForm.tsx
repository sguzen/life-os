'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { PaceDisciplineAlert } from './PaceDisciplineAlert'
import { checkWentTooFast, SESSION_TYPE_LABELS } from '@/lib/marathon/plan'
import type { PlannedSession } from '@/lib/marathon/plan'

const schema = z.object({
  status: z.enum(['completed', 'skipped', 'modified']),
  actual_km: z.number().min(0).max(100).optional(),
  actual_avg_pace: z.string().regex(/^\d+:\d{2}$/).optional(),
  actual_avg_hr: z.number().int().min(40).max(220).optional(),
  actual_duration_min: z.number().int().min(0).max(600).optional(),
  perceived_effort: z.number().int().min(1).max(10).optional(),
  warmup_done: z.boolean().optional(),
  post_fuel_done: z.boolean().optional(),
  resting_hr: z.number().int().min(30).max(120).optional(),
  notes: z.string().max(1000).optional(),
})

interface SessionLogFormProps {
  date: string
  planned: PlannedSession
  weekNumber: number
  existingActual?: {
    status: string
    actual_km?: number | null
    actual_avg_pace?: string | null
    actual_avg_hr?: number | null
    actual_duration_min?: number | null
    perceived_effort?: number | null
    warmup_done?: boolean | null
    post_fuel_done?: boolean | null
    resting_hr?: number | null
    notes?: string | null
  } | null
}

export function SessionLogForm({ date, planned, weekNumber, existingActual }: SessionLogFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertData, setAlertData] = useState<{ actual: string; deviation: number } | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState<{ evaluation: string; flag: string } | null>(null)

  const isRest = planned.type === 'REST'
  const needsWarmup = ['TEMPO', 'VO2_MAX'].includes(planned.type)

  const [form, setForm] = useState({
    status: (existingActual?.status as 'completed' | 'skipped' | 'modified') ?? 'completed',
    actual_km: existingActual?.actual_km?.toString() ?? planned.plannedKm?.toString() ?? '',
    actual_avg_pace: existingActual?.actual_avg_pace ?? planned.paceMin ?? '',
    actual_avg_hr: existingActual?.actual_avg_hr?.toString() ?? '',
    actual_duration_min: existingActual?.actual_duration_min?.toString() ?? '',
    perceived_effort: existingActual?.perceived_effort?.toString() ?? '',
    warmup_done: existingActual?.warmup_done ?? (needsWarmup ? false : true),
    post_fuel_done: existingActual?.post_fuel_done ?? false,
    resting_hr: existingActual?.resting_hr?.toString() ?? '',
    notes: existingActual?.notes ?? '',
  })

  const set = (key: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: Record<string, unknown> = {
      status: form.status,
      actual_km: form.actual_km ? parseFloat(form.actual_km) : undefined,
      actual_avg_pace: form.actual_avg_pace || undefined,
      actual_avg_hr: form.actual_avg_hr ? parseInt(form.actual_avg_hr) : undefined,
      actual_duration_min: form.actual_duration_min ? parseInt(form.actual_duration_min) : undefined,
      perceived_effort: form.perceived_effort ? parseInt(form.perceived_effort) : undefined,
      warmup_done: form.warmup_done,
      post_fuel_done: form.post_fuel_done,
      resting_hr: form.resting_hr ? parseInt(form.resting_hr) : undefined,
      notes: form.notes || undefined,
    }

    // Pace discipline check
    let wentTooFast = false
    let paceDeviationSec = 0
    let paceTargetMet = true

    if (form.actual_avg_pace && planned.paceMin && form.status !== 'skipped') {
      const check = checkWentTooFast(form.actual_avg_pace, planned.paceMin)
      wentTooFast = check.went
      paceDeviationSec = check.deviationSec
      paceTargetMet = !wentTooFast
    }

    // Warmup check
    const skippedWarmup = needsWarmup && form.warmup_done === false

    // RHR spike check (>49 bpm is above baseline max)
    const rhrSpike = form.resting_hr ? parseInt(form.resting_hr) > 49 : false

    try {
      const res = await fetch(`/api/marathon/session/${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          week_number: weekNumber,
          day_of_week: planned.dayOfWeek,
          planned_type: planned.type,
          planned_description: planned.description,
          planned_km: planned.plannedKm,
          planned_pace_min: planned.paceMin,
          planned_pace_max: planned.paceMax,
          has_strength: planned.hasStrength,
          strength_workout: planned.strengthWorkout,
          went_too_fast: wentTooFast,
          skipped_warmup: skippedWarmup,
          pace_target_met: paceTargetMet,
          pace_deviation_sec: paceDeviationSec,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      if (wentTooFast && !acknowledged) {
        setAlertData({ actual: form.actual_avg_pace, deviation: paceDeviationSec })
        setShowAlert(true)
        return
      }

      if (rhrSpike) {
        // just show a note — don't block
      }

      setSaved(true)
      startTransition(() => { router.refresh() })

      // Fetch session ID then trigger eval
      try {
        setIsEvaluating(true)
        const sessionRes = await fetch(`/api/marathon/session/${date}`)
        const sessionData = sessionRes.ok ? await sessionRes.json() : null
        const sessionId = sessionData?.id

        if (sessionId) {
          const evalRes = await fetch('/api/ai/training-eval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          })
          if (evalRes.ok) {
            const data = await evalRes.json()
            setEvalResult(data)
          }
        }
      } catch {
        // eval failed silently — user can still navigate away
      } finally {
        setIsEvaluating(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session')
    }
  }

  if (saved) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
          <p className="text-base font-semibold text-white">Session logged</p>
        </div>

        {isEvaluating && (
          <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400 shrink-0" />
            <p className="text-sm text-violet-300">Coach is evaluating your session…</p>
          </div>
        )}

        {evalResult && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                evalResult.flag === 'ok' ? 'bg-emerald-400' :
                evalResult.flag === 'warning' ? 'bg-amber-400' : 'bg-red-400'
              }`} />
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Coach Evaluation</span>
            </div>
            <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{evalResult.evaluation}</div>
          </div>
        )}

        <a
          href="/marathon"
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Back to training hub
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showAlert && alertData && planned.paceMin && (
        <PaceDisciplineAlert
          plannedPace={planned.paceMin}
          actualPace={alertData.actual}
          deviationSec={alertData.deviation}
          sessionType={planned.type}
          onAcknowledge={async () => {
            setAcknowledged(true)
            setShowAlert(false)
            setSaved(true)
            startTransition(() => { router.refresh() })
            try {
              setIsEvaluating(true)
              const sessionRes = await fetch(`/api/marathon/session/${date}`)
              const sessionData = sessionRes.ok ? await sessionRes.json() : null
              if (sessionData?.id) {
                const evalRes = await fetch('/api/ai/training-eval', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: sessionData.id }),
                })
                if (evalRes.ok) setEvalResult(await evalRes.json())
              }
            } catch { /* silent */ } finally {
              setIsEvaluating(false)
            }
          }}
        />
      )}

      {!showAlert && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session type badge */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              {planned.dayOfWeek} · {SESSION_TYPE_LABELS[planned.type]}
            </span>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Status</label>
            <div className="flex gap-2">
              {(['completed', 'modified', 'skipped'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                    form.status === s
                      ? s === 'skipped'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {form.status !== 'skipped' && !isRest && (
            <>
              {/* Morning RHR */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Morning RHR (bpm) <span className="text-white/25 normal-case">— log before getting up</span>
                </label>
                <input
                  type="number"
                  value={form.resting_hr}
                  onChange={(e) => set('resting_hr', e.target.value)}
                  placeholder="42–49 normal"
                  className="input-field w-32"
                  min={30}
                  max={120}
                />
                {form.resting_hr && parseInt(form.resting_hr) > 49 && (
                  <p className="text-xs text-amber-400">
                    RHR above baseline (42-49 bpm). Monitor fatigue today.
                  </p>
                )}
              </div>

              {/* Actual km */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Distance (km)</label>
                  <input
                    type="number"
                    value={form.actual_km}
                    onChange={(e) => set('actual_km', e.target.value)}
                    step="0.1"
                    placeholder={planned.plannedKm?.toString() ?? '0'}
                    className="input-field"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Avg Pace</label>
                  <input
                    type="text"
                    value={form.actual_avg_pace}
                    onChange={(e) => set('actual_avg_pace', e.target.value)}
                    placeholder={planned.paceMin ?? '6:20'}
                    className="input-field font-mono"
                  />
                  {planned.paceMin && form.actual_avg_pace && form.actual_avg_pace.match(/^\d+:\d{2}$/) && (
                    <p className={`text-xs font-mono ${
                      checkWentTooFast(form.actual_avg_pace, planned.paceMin).went
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}>
                      Target: {planned.paceMin}/km
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Avg HR</label>
                  <input
                    type="number"
                    value={form.actual_avg_hr}
                    onChange={(e) => set('actual_avg_hr', e.target.value)}
                    placeholder="145"
                    className="input-field"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Duration (min)</label>
                  <input
                    type="number"
                    value={form.actual_duration_min}
                    onChange={(e) => set('actual_duration_min', e.target.value)}
                    placeholder="60"
                    className="input-field"
                  />
                </div>
              </div>

              {/* RPE */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Perceived Effort (RPE 1-10)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('perceived_effort', n.toString())}
                      className={`h-9 w-9 rounded-lg text-sm font-mono font-medium transition-colors ${
                        form.perceived_effort === n.toString()
                          ? n <= 3 ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                            : n <= 6 ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40'
                            : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                {needsWarmup && (
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.warmup_done === true}
                      onChange={(e) => set('warmup_done', e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 accent-orange-500"
                    />
                    <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                      Warm-up completed
                      {planned.type === 'TEMPO' && <span className="text-white/30 text-xs ml-2">(2km @ 5:30/km)</span>}
                      {planned.type === 'VO2_MAX' && <span className="text-white/30 text-xs ml-2">(15min easy + strides)</span>}
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.post_fuel_done === true}
                    onChange={(e) => set('post_fuel_done', e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 accent-orange-500"
                  />
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                    Post-run fuel within 30min
                  </span>
                </label>
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="How did it feel? Anything unusual?"
              rows={3}
              className="input-field resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Session
          </button>
        </form>
      )}

      <style jsx>{`
        .input-field {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: rgba(255,255,255,0.25);
        }
        .input-field::placeholder {
          color: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  )
}
