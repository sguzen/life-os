'use client'

// Morning Check-In card — vitals form + AI briefing panel.
// On mount: loads today's log; if ai_briefing exists, shows it immediately.
// On submit: saves log → fetches briefing → renders it.

import { useState, useEffect, useTransition } from 'react'
import { Sunrise, Loader2, Circle, CircleDot } from 'lucide-react'
import { saveMorningLog, getTodaysMorningLog } from '@/app/actions/morning-log'
import type { MorningLog, MorningLogInput } from '@/lib/types/morning-log'

// ── Markdown renderer (minimal, matches CoachChat style) ─────────────────────

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h3 key={i} className="text-sm font-semibold text-white/90 mt-4 mb-1 first:mt-0">
          {line.slice(3)}
        </h3>
      )
    }
    if (line.startsWith('- ')) {
      return (
        <li key={i} className="text-sm text-white/70 ml-3 list-disc list-inside leading-relaxed">
          {line.slice(2)}
        </li>
      )
    }
    if (line.trim() === '') return <div key={i} className="h-1.5" />
    return (
      <p key={i} className="text-sm text-white/70 leading-relaxed">
        {line}
      </p>
    )
  })
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DotSelector({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-white/50 w-28 shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${label} ${n}`}
            className="transition-colors"
          >
            {value != null && n <= value ? (
              <CircleDot className="h-4 w-4 text-violet-400" />
            ) : (
              <Circle className="h-4 w-4 text-white/20 hover:text-white/40" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-white/50 w-28 shrink-0">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            value === true
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
              : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            value === false
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
              : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

type DreamQuality = 'good' | 'neutral' | 'bad' | 'nightmare'

// ── Main component ───────────────────────────────────────────────────────────

export function MorningCheckin() {
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  // Form state
  const [restingHr, setRestingHr] = useState<string>('')
  const [sleepHours, setSleepHours] = useState<string>('')
  const [sleepQuality, setSleepQuality] = useState<number | null>(null)
  const [energyLevel, setEnergyLevel] = useState<number | null>(null)
  const [mood, setMood] = useState<number | null>(null)
  const [bodyReadiness, setBodyReadiness] = useState<number | null>(null)
  const [wokeEasily, setWokeEasily] = useState<boolean | null>(null)
  const [hadDreams, setHadDreams] = useState<boolean | null>(null)
  const [dreamQuality, setDreamQuality] = useState<DreamQuality | null>(null)
  const [notes, setNotes] = useState<string>('')

  // UI state
  const [briefing, setBriefing] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [fetchingBriefing, setFetchingBriefing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // On mount: load today's log
  useEffect(() => {
    getTodaysMorningLog().then((log) => {
      if (!log) return
      populateFromLog(log)
    })
  }, [])

  function populateFromLog(log: MorningLog) {
    if (log.resting_hr_bpm != null) setRestingHr(String(log.resting_hr_bpm))
    if (log.sleep_hours != null) setSleepHours(String(log.sleep_hours))
    if (log.sleep_quality != null) setSleepQuality(log.sleep_quality)
    if (log.energy_level != null) setEnergyLevel(log.energy_level)
    if (log.mood != null) setMood(log.mood)
    if (log.body_readiness != null) setBodyReadiness(log.body_readiness)
    if (log.woke_easily != null) setWokeEasily(log.woke_easily)
    if (log.had_dreams != null) setHadDreams(log.had_dreams)
    if (log.dream_quality) setDreamQuality(log.dream_quality as DreamQuality)
    if (log.notes) setNotes(log.notes)
    if (log.ai_briefing) {
      setBriefing(log.ai_briefing)
      setSubmitted(true)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const input: MorningLogInput = {
      resting_hr_bpm: restingHr ? Number(restingHr) : null,
      sleep_hours: sleepHours ? Number(sleepHours) : null,
      sleep_quality: sleepQuality,
      energy_level: energyLevel,
      mood,
      body_readiness: bodyReadiness,
      woke_easily: wokeEasily,
      had_dreams: hadDreams,
      dream_quality: hadDreams ? dreamQuality : null,
      notes: notes.trim() || null,
    }

    startTransition(async () => {
      try {
        const { id } = await saveMorningLog(input)
        setSubmitted(true)

        // Fetch briefing only if we don't already have one
        if (!briefing) {
          setFetchingBriefing(true)
          const res = await fetch('/api/ai/morning-briefing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId: id }),
          })
          const data = await res.json() as { briefing?: string; error?: string }
          if (data.briefing) {
            setBriefing(data.briefing)
          } else {
            setError('Failed to generate briefing — your log was saved.')
          }
          setFetchingBriefing(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setFetchingBriefing(false)
      }
    })
  }

  // Derive readiness colour from briefing header
  const readinessColor = briefing?.includes('🟢')
    ? 'text-emerald-400'
    : briefing?.includes('🔴')
      ? 'text-red-400'
      : 'text-amber-400'

  return (
    <div className="space-y-4">
      {/* ── Form card ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <Sunrise className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Morning Check-In</span>
          </div>
          <span className="text-xs text-white/40">{dateLabel}</span>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">
          {/* Vitals row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-white/50">RHR (bpm)</label>
              <input
                type="number"
                value={restingHr}
                onChange={(e) => setRestingHr(e.target.value)}
                min={30}
                max={120}
                placeholder="e.g. 46"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Sleep (hours)</label>
              <input
                type="number"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                min={0}
                max={14}
                step={0.5}
                placeholder="e.g. 7.5"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
              />
            </div>
          </div>

          {/* 1–5 dot selectors */}
          <div className="space-y-3">
            <DotSelector label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
            <DotSelector label="Energy" value={energyLevel} onChange={setEnergyLevel} />
            <DotSelector label="Mood" value={mood} onChange={setMood} />
            <DotSelector label="Body readiness" value={bodyReadiness} onChange={setBodyReadiness} />
          </div>

          {/* Yes/No toggles */}
          <div className="space-y-3">
            <YesNoToggle label="Woke easily?" value={wokeEasily} onChange={setWokeEasily} />
            <YesNoToggle label="Dreams?" value={hadDreams} onChange={setHadDreams} />
          </div>

          {/* Dream quality (only when hadDreams=true) */}
          {hadDreams === true && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/50 w-28 shrink-0">Dream quality</span>
              {(['good', 'neutral', 'bad', 'nightmare'] as DreamQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setDreamQuality(q)}
                  className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${
                    dreamQuality === q
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs text-white/50">How are you feeling? (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any aches, thoughts, or context for today…"
              className="w-full resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || fetchingBriefing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-sm text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
            >
              {(isPending || fetchingBriefing) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitted && !fetchingBriefing ? 'Update Check-In' : 'Submit Check-In'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Briefing card ─────────────────────────────────────────────────── */}
      {fetchingBriefing && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
          <p className="text-sm text-white/40">Analysing your morning…</p>
        </div>
      )}

      {briefing && !fetchingBriefing && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/10 bg-amber-500/5">
            <span className={`text-base ${readinessColor}`}>
              {briefing.includes('🟢') ? '🟢' : briefing.includes('🔴') ? '🔴' : '🟡'}
            </span>
            <span className="text-sm font-semibold text-white">Morning Briefing</span>
          </div>
          <div className="px-5 py-4 space-y-1">{renderMarkdown(briefing)}</div>
        </div>
      )}
    </div>
  )
}
