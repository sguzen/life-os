'use client'

import { useState, useEffect, useTransition } from 'react'
import { Sunrise, Loader2, CheckCircle2 } from 'lucide-react'
import { submitMorningLog, getTodaysMorningLog } from '@/app/actions/morning-log'
import type { MorningLogInput, MorningLog } from '@/lib/types/morning-log'

// ── Score selector (1-10 clickable dots) ────────────────────────────────────

function ScoreSelector({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">{label}</span>
        {value != null && (
          <span className="text-xs font-medium text-violet-400">{value}/10</span>
        )}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${label} ${n}`}
            className={`flex-1 h-6 rounded text-xs font-medium transition-colors ${
              value != null && n <= value
                ? 'bg-violet-500/60 text-white'
                : 'bg-white/5 text-white/20 hover:bg-white/10 hover:text-white/50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Number input ─────────────────────────────────────────────────────────────

function VitalInput({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  unit,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  min: number
  max: number
  step?: number
  unit?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">
        {label}
        {unit && <span className="text-white/30"> ({unit})</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step ?? 1}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40"
      />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function MorningCheckin() {
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  // Form state
  const [sleepHours, setSleepHours] = useState<string>('')
  const [rhr, setRhr] = useState<string>('')
  const [hrv, setHrv] = useState<string>('')
  const [moodScore, setMoodScore] = useState<number | null>(null)
  const [energyLevel, setEnergyLevel] = useState<number | null>(null)
  const [journalNotes, setJournalNotes] = useState<string>('')

  // UI state
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [alreadyLogged, setAlreadyLogged] = useState(false)

  // On mount: pre-populate if already logged today
  useEffect(() => {
    getTodaysMorningLog().then((log) => {
      if (!log) return
      populateFromLog(log)
      setAlreadyLogged(true)
    })
  }, [])

  function populateFromLog(log: MorningLog) {
    if (log.sleep_hours != null) setSleepHours(String(log.sleep_hours))
    if (log.rhr != null) setRhr(String(log.rhr))
    if (log.hrv != null) setHrv(String(log.hrv))
    if (log.mood_score != null) setMoodScore(log.mood_score)
    if (log.energy_level != null) setEnergyLevel(log.energy_level)
    if (log.journal_notes) setJournalNotes(log.journal_notes)
  }

  function resetForm() {
    setSleepHours('')
    setRhr('')
    setHrv('')
    setMoodScore(null)
    setEnergyLevel(null)
    setJournalNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const input: MorningLogInput = {
      sleep_hours: sleepHours ? Number(sleepHours) : null,
      rhr: rhr ? Number(rhr) : null,
      hrv: hrv ? Number(hrv) : null,
      mood_score: moodScore,
      energy_level: energyLevel,
      journal_notes: journalNotes.trim() || null,
    }

    startTransition(async () => {
      const result = await submitMorningLog(input)
      if (result.success) {
        setSuccess(true)
        setAlreadyLogged(true)
        // Auto-hide toast after 3s
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error ?? 'Failed to save log')
      }
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-amber-500/5">
        <div className="flex items-center gap-2">
          <Sunrise className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Morning Check-In</span>
          {alreadyLogged && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Logged
            </span>
          )}
        </div>
        <span className="text-xs text-white/40">{dateLabel}</span>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">
        {/* Vitals row */}
        <div className="grid grid-cols-3 gap-3">
          <VitalInput
            label="Sleep"
            unit="hrs"
            value={sleepHours}
            onChange={setSleepHours}
            placeholder="7.5"
            min={0}
            max={14}
            step={0.5}
          />
          <VitalInput
            label="RHR"
            unit="bpm"
            value={rhr}
            onChange={setRhr}
            placeholder="46"
            min={30}
            max={120}
          />
          <VitalInput
            label="HRV"
            unit="ms"
            value={hrv}
            onChange={setHrv}
            placeholder="62"
            min={10}
            max={200}
          />
        </div>

        {/* 1–10 score selectors */}
        <div className="space-y-4">
          <ScoreSelector label="Mood" value={moodScore} onChange={setMoodScore} />
          <ScoreSelector label="Energy" value={energyLevel} onChange={setEnergyLevel} />
        </div>

        {/* Journal */}
        <div className="space-y-1">
          <label className="text-xs text-white/50">Journal (optional)</label>
          <textarea
            value={journalNotes}
            onChange={(e) => setJournalNotes(e.target.value)}
            rows={2}
            placeholder="How are you feeling? Any context for today…"
            className="w-full resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40"
          />
        </div>

        {/* Success toast */}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Morning log saved!
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-between">
          {alreadyLogged && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-sm text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {alreadyLogged ? 'Update Check-In' : 'Submit Check-In'}
          </button>
        </div>
      </form>
    </div>
  )
}
