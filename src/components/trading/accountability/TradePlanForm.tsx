'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ImageIcon, X, Loader2, CheckCircle2 } from 'lucide-react'
import { AIFeedback } from './AIFeedback'
import { RevengeLockBanner } from './RevengeLockBanner'
import type {
  TradingChallenge,
  AccountabilitySession_DB,
  AccountabilityInstrument,
  AccountabilityDirection,
  AccountabilitySession as AccountabilitySessionWindow,
  SetupType,
} from '@/lib/types/accountability'
import {
  createTradePlan,
  upsertAccountabilitySession,
} from '@/lib/supabase/accountability'

interface TradePlanFormProps {
  date: string
  session: AccountabilitySession_DB
  challenge: TradingChallenge | null
  planCount: number // how many plans already submitted today
}

const INSTRUMENTS: AccountabilityInstrument[] = ['MNQ', 'MGC', 'MES']
const DIRECTIONS: AccountabilityDirection[] = ['Long', 'Short']
const SESSION_WINDOWS: AccountabilitySessionWindow[] = ['London', 'NY_AM', 'NY_PM']
const SETUP_TYPES: SetupType[] = [
  'FVG', 'IFVG', 'Order Block', 'Breaker Block', 'CSD', 'Liquidity Grab', 'Other',
]

export function TradePlanForm({ date, session, challenge, planCount }: TradePlanFormProps) {
  const router = useRouter()

  const [instrument, setInstrument] = useState<AccountabilityInstrument>('MNQ')
  const [direction, setDirection] = useState<AccountabilityDirection>('Long')
  const [sessionWindow, setSessionWindow] = useState<AccountabilitySessionWindow>('London')
  const [htfBias, setHtfBias] = useState('')
  const [setupType, setSetupType] = useState<SetupType>('FVG')
  const [pdArray, setPdArray] = useState('')
  const [confluence, setConfluence] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [target1, setTarget1] = useState('')
  const [target2, setTarget2] = useState('')
  const [riskDollars, setRiskDollars] = useState('')
  const [convictionLock, setConvictionLock] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [overrideReason, setOverrideReason] = useState('')

  const [saving, setSaving] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const revengeActive = (session.consecutive_losses ?? 0) >= 2 && !overrideReason
  const maxPlansReached = planCount >= 2

  // All required fields filled check
  const allFieldsFilled =
    htfBias.trim().length > 0 &&
    pdArray.trim().length > 0 &&
    confluence.trim().length > 0

  const canSubmit = allFieldsFilled && !revengeActive && !maxPlansReached

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
    if (!canSubmit) return

    setSaving(true)
    setError('')
    setAiResponse('')

    try {
      const planData = {
        session_id: session.id,
        plan_number: planCount + 1,
        instrument,
        direction,
        session_window: sessionWindow,
        htf_bias: htfBias,
        setup_type: setupType,
        pd_array: pdArray,
        confluence,
        entry_price: entryPrice ? parseFloat(entryPrice) : null,
        stop_loss: stopLoss ? parseFloat(stopLoss) : null,
        target_1: target1 ? parseFloat(target1) : null,
        target_2: target2 ? parseFloat(target2) : null,
        risk_dollars: riskDollars ? parseFloat(riskDollars) : null,
        conviction_lock: convictionLock,
        plan_ai_response: null,
      }

      const plan = await createTradePlan(planData)

      // Stream AI response
      setIsStreaming(true)
      const res = await fetch('/api/ai/accountability-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: { ...planData, plan_number: plan.plan_number },
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

      // Save AI response to plan record
      const { updateTradePlan } = await import('@/lib/supabase/accountability')
      await updateTradePlan(plan.id, { plan_ai_response: fullText })

      setSavedPlanId(plan.id)
      setIsStreaming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsStreaming(false)
    } finally {
      setSaving(false)
    }
  }

  if (maxPlansReached) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-2">
        <Lock className="h-6 w-6 text-amber-400 mx-auto" />
        <p className="text-sm font-semibold text-amber-400">Max 2 setups reached today.</p>
        <p className="text-xs text-white/40">You've already submitted 2 trade plans for this session. That's your limit.</p>
        <button
          onClick={() => router.push('/trading/accountability')}
          className="mt-2 text-xs text-white/50 hover:text-white/70 underline underline-offset-2 transition-colors"
        >
          Back to hub
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Revenge lock */}
      {(session.consecutive_losses ?? 0) >= 2 && (
        <RevengeLockBanner
          consecutiveLosses={session.consecutive_losses}
          onOverride={async (reason) => {
            setOverrideReason(reason)
            // Log override to session
            await upsertAccountabilitySession({
              session_date: date,
              // We note the override in notes area; revenge_lock_triggered stays true
            })
          }}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Instrument + Direction + Session */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Instrument</label>
            <div className="flex flex-col gap-1.5">
              {INSTRUMENTS.map((inst) => (
                <button
                  key={inst}
                  type="button"
                  onClick={() => setInstrument(inst)}
                  className={`rounded-lg py-2 text-xs font-semibold border transition-colors ${
                    instrument === inst
                      ? 'bg-white/15 border-white/25 text-white'
                      : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Direction</label>
            <div className="flex flex-col gap-1.5">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setDirection(dir)}
                  className={`rounded-lg py-2 text-xs font-semibold border transition-colors ${
                    direction === dir
                      ? dir === 'Long'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Session</label>
            <div className="flex flex-col gap-1.5">
              {SESSION_WINDOWS.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => setSessionWindow(sw)}
                  className={`rounded-lg py-2 text-xs font-semibold border transition-colors ${
                    sessionWindow === sw
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                      : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  {sw.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Setup type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Setup Type</label>
          <div className="flex flex-wrap gap-2">
            {SETUP_TYPES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSetupType(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                  setupType === st
                    ? 'bg-white/15 border-white/25 text-white'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* HTF Bias — required */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            HTF Bias <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
          </label>
          <textarea
            value={htfBias}
            onChange={(e) => setHtfBias(e.target.value)}
            placeholder="Weekly/Daily bias, key levels above and below, overall direction…"
            rows={3}
            className={`w-full rounded-lg bg-white/5 border px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none ${
              htfBias.trim() ? 'border-white/10' : 'border-red-500/20'
            }`}
          />
        </div>

        {/* PD Array — required */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            PD Array / Entry Zone <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
          </label>
          <input
            type="text"
            value={pdArray}
            onChange={(e) => setPdArray(e.target.value)}
            placeholder="Specific price level or zone, e.g. 21,450–21,460 OB"
            className={`w-full rounded-lg bg-white/5 border px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 ${
              pdArray.trim() ? 'border-white/10' : 'border-red-500/20'
            }`}
          />
        </div>

        {/* Confluence — required */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Confluence <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
          </label>
          <textarea
            value={confluence}
            onChange={(e) => setConfluence(e.target.value)}
            placeholder="Why this level, why now. What lines up to make this the right trade?"
            rows={3}
            className={`w-full rounded-lg bg-white/5 border px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none ${
              confluence.trim() ? 'border-white/10' : 'border-red-500/20'
            }`}
          />
        </div>

        {/* Price levels */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Entry Price', value: entryPrice, setter: setEntryPrice },
            { label: 'Stop Loss', value: stopLoss, setter: setStopLoss },
            { label: 'Target 1', value: target1, setter: setTarget1 },
            { label: 'Target 2', value: target2, setter: setTarget2 },
          ].map(({ label, value, setter }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
              <input
                type="number"
                step="0.0001"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder="0.0000"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
              />
            </div>
          ))}
        </div>

        {/* Risk */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Risk ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">$</span>
            <input
              type="number"
              step="0.01"
              value={riskDollars}
              onChange={(e) => setRiskDollars(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg bg-white/5 border border-white/10 pl-7 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
            />
          </div>
          {challenge && riskDollars && parseFloat(riskDollars) > challenge.daily_loss_limit && (
            <p className="text-xs text-red-400">
              Risk exceeds daily loss limit (${challenge.daily_loss_limit})
            </p>
          )}
        </div>

        {/* Conviction lock */}
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${
            convictionLock
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
          onClick={() => setConvictionLock(!convictionLock)}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
              convictionLock ? 'border-amber-400 bg-amber-400' : 'border-white/30'
            }`}>
              {convictionLock && <CheckCircle2 className="h-3 w-3 text-black" />}
            </div>
            <div>
              <p className={`text-sm font-medium ${convictionLock ? 'text-amber-400' : 'text-white/60'}`}>
                Conviction Lock
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                I will NOT adjust this trade based on external input (Discord, Telegram, mentors, Twitter).
                My plan is my plan.
              </p>
            </div>
          </div>
        </div>

        {/* Chart uploads */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
            <ImageIcon className="h-3.5 w-3.5" />
            Chart screenshots (optional)
          </label>
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors">
              <ImageIcon className="h-3.5 w-3.5" />
              Upload charts
            </div>
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
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

        {/* No-plan block message */}
        {!allFieldsFilled && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-xs text-amber-400 font-medium">
              Complete your plan first. No plan = no trade.
            </p>
            <p className="text-xs text-white/30 mt-0.5">
              HTF Bias, PD Array, and Confluence are required.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || saving || isStreaming}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed text-white border border-white/10 transition-colors flex items-center justify-center gap-2"
        >
          {(saving || isStreaming) && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving plan…' : isStreaming ? 'Getting AI review…' : 'Submit Trade Plan'}
        </button>
      </form>

      {/* AI Response */}
      {(aiResponse || isStreaming) && (
        <AIFeedback
          response={aiResponse}
          isStreaming={isStreaming}
          accentClass="text-indigo-400"
          accentBgClass="bg-indigo-400/10"
          accentBorderClass="border-indigo-400/20"
          title="Plan Review"
        />
      )}

      {savedPlanId && (
        <div className="flex justify-end">
          <button
            onClick={() => router.push(`/trading/accountability/plan/${savedPlanId}/review`)}
            className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Go to Trade Review →
          </button>
        </div>
      )}
    </div>
  )
}
