'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ShieldX, Moon, Dumbbell, Brain, Wine, Loader2, ImageIcon, X } from 'lucide-react'
import { AIFeedback } from './AIFeedback'
import type { TradingChallenge, AccountabilitySession_DB } from '@/lib/types/accountability'
import { upsertAccountabilitySession } from '@/lib/supabase/accountability'

interface GateFormProps {
  date: string
  challenge: TradingChallenge | null
  existingSession: AccountabilitySession_DB | null
}

const GATE_THRESHOLDS = {
  minSleep: 6,
  minPhysical: 5,
  minEmotional: 5,
  alcoholBlock: true,
}

export function GateForm({ date, challenge, existingSession }: GateFormProps) {
  const router = useRouter()

  const [sleepHours, setSleepHours] = useState(existingSession?.sleep_hours?.toString() ?? '7')
  const [physicalScore, setPhysicalScore] = useState(existingSession?.physical_score ?? 7)
  const [emotionalScore, setEmotionalScore] = useState(existingSession?.emotional_score ?? 7)
  const [alcoholLastNight, setAlcoholLastNight] = useState(existingSession?.alcohol_last_night ?? false)
  const [feelingNotes, setFeelingNotes] = useState('')
  const [images, setImages] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [aiResponse, setAiResponse] = useState(existingSession?.gate_ai_response ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [saved, setSaved] = useState(!!existingSession?.gate_passed !== undefined && existingSession?.sleep_hours !== null)
  const [error, setError] = useState('')

  const sleepNum = parseFloat(sleepHours) || 0
  const gatePassed =
    sleepNum >= GATE_THRESHOLDS.minSleep &&
    physicalScore >= GATE_THRESHOLDS.minPhysical &&
    emotionalScore >= GATE_THRESHOLDS.minEmotional &&
    !(alcoholLastNight && GATE_THRESHOLDS.alcoholBlock)

  const failReasons: string[] = []
  if (alcoholLastNight) failReasons.push('Alcohol consumed last night — no trading today')
  if (sleepNum < GATE_THRESHOLDS.minSleep) failReasons.push(`Sleep: ${sleepNum}h (minimum ${GATE_THRESHOLDS.minSleep}h)`)
  if (physicalScore < GATE_THRESHOLDS.minPhysical) failReasons.push(`Physical: ${physicalScore}/10 (minimum ${GATE_THRESHOLDS.minPhysical})`)
  if (emotionalScore < GATE_THRESHOLDS.minEmotional) failReasons.push(`Emotional: ${emotionalScore}/10 (minimum ${GATE_THRESHOLDS.minEmotional})`)

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string)?.split(',')[1]
        if (base64) setImages((prev) => [...prev, base64])
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setAiResponse('')

    try {
      // Save to DB
      const session = await upsertAccountabilitySession({
        session_date: date,
        challenge_id: challenge?.id ?? null,
        sleep_hours: sleepNum,
        physical_score: physicalScore,
        emotional_score: emotionalScore,
        alcohol_last_night: alcoholLastNight,
        gate_passed: gatePassed,
      })

      // Stream AI response
      setIsStreaming(true)
      const res = await fetch('/api/ai/accountability-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: {
            sleep_hours: sleepNum,
            physical_score: physicalScore,
            emotional_score: emotionalScore,
            alcohol_last_night: alcoholLastNight,
            feeling_notes: feelingNotes,
            gate_passed: gatePassed,
          },
          challengeConfig: challenge,
          images,
        }),
      })

      if (!res.ok) throw new Error('AI request failed')
      if (!res.body) throw new Error('No stream body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setAiResponse(fullText)
      }

      // Save AI response to DB
      await upsertAccountabilitySession({
        session_date: date,
        gate_ai_response: fullText,
      })

      setSaved(true)
      setIsStreaming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsStreaming(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sleep */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Moon className="h-4 w-4 text-indigo-400" />
          Sleep last night (hours)
        </label>
        <input
          type="number"
          min="0"
          max="12"
          step="0.5"
          value={sleepHours}
          onChange={(e) => setSleepHours(e.target.value)}
          className={`w-32 rounded-lg bg-white/5 border px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25 ${
            sleepNum < GATE_THRESHOLDS.minSleep ? 'border-red-500/50' : 'border-white/10'
          }`}
        />
        {sleepNum < GATE_THRESHOLDS.minSleep && sleepNum > 0 && (
          <p className="text-xs text-red-400">Below minimum {GATE_THRESHOLDS.minSleep}h</p>
        )}
      </div>

      {/* Physical score */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Dumbbell className="h-4 w-4 text-orange-400" />
          Physical state: {physicalScore}/10
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={physicalScore}
          onChange={(e) => setPhysicalScore(Number(e.target.value))}
          className="w-full accent-orange-400"
        />
        <div className="flex justify-between text-xs text-white/30">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>

      {/* Emotional score */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Brain className="h-4 w-4 text-violet-400" />
          Emotional state: {emotionalScore}/10
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={emotionalScore}
          onChange={(e) => setEmotionalScore(Number(e.target.value))}
          className="w-full accent-violet-400"
        />
        <div className="flex justify-between text-xs text-white/30">
          <span>Volatile</span>
          <span>Calm & focused</span>
        </div>
        {emotionalScore < GATE_THRESHOLDS.minEmotional && (
          <p className="text-xs text-red-400">Observation only — no live trading below {GATE_THRESHOLDS.minEmotional}/10</p>
        )}
      </div>

      {/* Alcohol toggle */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Wine className="h-4 w-4 text-pink-400" />
          Alcohol last night?
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setAlcoholLastNight(false)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors ${
              !alcoholLastNight
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
            }`}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => setAlcoholLastNight(true)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors ${
              alcoholLastNight
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
            }`}
          >
            Yes
          </button>
        </div>
        {alcoholLastNight && (
          <p className="text-xs text-red-400 font-medium">
            Hard block — alcohol night before means no trading today. No exceptions.
          </p>
        )}
      </div>

      {/* Feeling notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80">
          How are you feeling? (optional)
        </label>
        <textarea
          value={feelingNotes}
          onChange={(e) => setFeelingNotes(e.target.value)}
          placeholder="Anything on your mind this morning…"
          rows={3}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
        />
      </div>

      {/* Chart uploads */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-white/80">
          <ImageIcon className="h-4 w-4 text-white/40" />
          Chart screenshots (optional)
        </label>
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors">
            <ImageIcon className="h-3.5 w-3.5" />
            Upload charts
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
        </label>
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((_, i) => (
              <div key={i} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/50">
                Chart {i + 1}
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3 hover:text-white/80" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gate status preview */}
      <div className={`rounded-xl border p-4 ${
        gatePassed
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-red-500/30 bg-red-500/10'
      }`}>
        <div className="flex items-center gap-3">
          {gatePassed ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : (
            <ShieldX className="h-5 w-5 text-red-400" />
          )}
          <div>
            <p className={`text-sm font-bold ${gatePassed ? 'text-emerald-400' : 'text-red-400'}`}>
              {gatePassed ? 'GATE: READY TO TRADE' : 'GATE: TRADING BLOCKED TODAY'}
            </p>
            {!gatePassed && failReasons.map((r, i) => (
              <p key={i} className="text-xs text-red-300 mt-0.5">— {r}</p>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving || isStreaming}
        className="w-full rounded-xl py-3 text-sm font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-white border border-white/10 transition-colors flex items-center justify-center gap-2"
      >
        {(saving || isStreaming) && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? 'Saving…' : isStreaming ? 'Getting AI coaching…' : saved ? 'Update Gate Check' : 'Submit Gate Check'}
      </button>

      {/* AI Response */}
      {(aiResponse || isStreaming) && (
        <AIFeedback
          response={aiResponse}
          isStreaming={isStreaming}
          accentClass={gatePassed ? 'text-emerald-400' : 'text-red-400'}
          accentBgClass={gatePassed ? 'bg-emerald-400/10' : 'bg-red-400/10'}
          accentBorderClass={gatePassed ? 'border-emerald-400/20' : 'border-red-400/20'}
          title={gatePassed ? 'Ready to Trade' : 'Trading Blocked'}
        />
      )}

      {/* Hard block — no path to trade plan if gate fails */}
      {saved && !gatePassed && (
        <div className="rounded-xl border border-red-500/50 bg-red-950/50 p-5 space-y-3">
          <p className="text-sm font-bold text-red-400">NO TRADING TODAY</p>
          <ul className="space-y-1">
            {failReasons.map((r, i) => (
              <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">✗</span>
                {r}
              </li>
            ))}
          </ul>
          <div className="border-t border-red-500/20 pt-3">
            <p className="text-xs text-red-400/70 font-medium">What to do instead:</p>
            <ul className="mt-1 space-y-0.5">
              <li className="text-xs text-white/50">• Review charts for study only</li>
              <li className="text-xs text-white/50">• Mark up tomorrow's levels</li>
              <li className="text-xs text-white/50">• No live trading. Simulator max if you must do something.</li>
            </ul>
          </div>
        </div>
      )}

      {saved && gatePassed && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.push('/trading/accountability/plan')}
            className="flex items-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Proceed to Trade Plan →
          </button>
        </div>
      )}
    </form>
  )
}
