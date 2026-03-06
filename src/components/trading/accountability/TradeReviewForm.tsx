'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AIFeedback } from './AIFeedback'
import type {
  TradePlan,
  TradeOutcomeAcc,
} from '@/lib/types/accountability'
import {
  createTradeReview,
  updateTradePlan,
  updateSessionGuardrails,
} from '@/lib/supabase/accountability'

interface TradeReviewFormProps {
  plan: TradePlan
  sessionId: string
  date: string
}

const OUTCOMES: TradeOutcomeAcc[] = ['Win', 'Loss', 'Breakeven', 'Partial']

export function TradeReviewForm({ plan, sessionId, date }: TradeReviewFormProps) {
  const router = useRouter()

  const [outcome, setOutcome] = useState<TradeOutcomeAcc>('Win')
  const [actualEntry, setActualEntry] = useState('')
  const [actualExit, setActualExit] = useState('')
  const [actualPnl, setActualPnl] = useState('')
  const [executionQuality, setExecutionQuality] = useState(7)
  const [followedPlan, setFollowedPlan] = useState<boolean | null>(null)
  const [whatChanged, setWhatChanged] = useState('')
  const [externalInfluence, setExternalInfluence] = useState(false)
  const [externalDetails, setExternalDetails] = useState('')
  const [whatWentRight, setWhatWentRight] = useState('')
  const [whatWentWrong, setWhatWentWrong] = useState('')
  const [lesson, setLesson] = useState('')

  const [saving, setSaving] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = followedPlan !== null && (!followedPlan ? whatChanged.trim().length > 0 : true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    setError('')
    setAiResponse('')

    try {
      const reviewData = {
        plan_id: plan.id,
        session_id: sessionId,
        outcome,
        actual_entry: actualEntry ? parseFloat(actualEntry) : null,
        actual_exit: actualExit ? parseFloat(actualExit) : null,
        actual_pnl: actualPnl ? parseFloat(actualPnl) : null,
        execution_quality: executionQuality,
        followed_plan: followedPlan ?? true,
        external_influence: externalInfluence,
        external_influence_details: externalInfluence ? externalDetails : null,
        what_went_right: whatWentRight || null,
        what_went_wrong: (followedPlan === false ? whatChanged + '\n' : '') + (whatWentWrong || ''),
        lesson: lesson || null,
        review_ai_response: null,
      }

      await createTradeReview(reviewData)

      // Update session guardrails
      await updateSessionGuardrails(sessionId, outcome, externalInfluence)

      // Stream AI response
      setIsStreaming(true)
      const res = await fetch('/api/ai/accountability-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: {
            ...reviewData,
            external_influence_details: externalInfluence ? externalDetails : null,
          },
          planData: plan,
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

      setIsStreaming(false)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsStreaming(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Plan context */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-1">
        <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Reviewing Plan {plan.plan_number}</p>
        <div className="flex flex-wrap gap-3 mt-1">
          <span className="text-sm text-white/70">{plan.instrument}</span>
          <span className={`text-sm font-medium ${plan.direction === 'Long' ? 'text-emerald-400' : 'text-red-400'}`}>
            {plan.direction}
          </span>
          <span className="text-sm text-white/50">{plan.setup_type}</span>
          <span className="text-sm text-white/50">{plan.session_window.replace('_', ' ')}</span>
        </div>
        <p className="text-xs text-white/40 mt-1">Entry zone: {plan.pd_array}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Outcome */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Outcome</label>
          <div className="grid grid-cols-4 gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(o)}
                className={`rounded-lg py-2.5 text-sm font-semibold border transition-colors ${
                  outcome === o
                    ? o === 'Win'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : o === 'Loss'
                      ? 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Price / P&L */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Actual Entry', value: actualEntry, setter: setActualEntry },
            { label: 'Actual Exit', value: actualExit, setter: setActualExit },
            { label: 'P&L ($)', value: actualPnl, setter: setActualPnl },
          ].map(({ label, value, setter }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
              <input
                type="number"
                step="0.0001"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
              />
            </div>
          ))}
        </div>

        {/* Execution quality */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Execution Quality: {executionQuality}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={executionQuality}
            onChange={(e) => setExecutionQuality(Number(e.target.value))}
            className="w-full accent-indigo-400"
          />
          <div className="flex justify-between text-xs text-white/30">
            <span>Sloppy</span>
            <span>Textbook</span>
          </div>
        </div>

        {/* Followed plan */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Did you follow the plan? <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFollowedPlan(true)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors ${
                followedPlan === true
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setFollowedPlan(false)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors ${
                followedPlan === false
                  ? 'bg-red-500/20 border-red-500/50 text-red-400'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              No
            </button>
          </div>

          {followedPlan === false && (
            <div className="space-y-1.5">
              <label className="text-xs text-red-400/80">What changed from the plan?</label>
              <textarea
                value={whatChanged}
                onChange={(e) => setWhatChanged(e.target.value)}
                placeholder="Be specific — what did you do differently and why?"
                rows={2}
                className="w-full rounded-lg bg-white/5 border border-red-500/20 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-red-400/40 resize-none"
              />
            </div>
          )}
        </div>

        {/* External influence */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">External influence?</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setExternalInfluence(false)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
                !externalInfluence
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setExternalInfluence(true)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
                externalInfluence
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              Yes
            </button>
          </div>

          {externalInfluence && (
            <div className="space-y-1.5">
              <label className="text-xs text-amber-400/80">
                What happened? (Discord, Telegram, mentor call, Twitter, other?)
              </label>
              <textarea
                value={externalDetails}
                onChange={(e) => setExternalDetails(e.target.value)}
                placeholder="Describe the external input and how it affected your decision…"
                rows={2}
                className="w-full rounded-lg bg-white/5 border border-amber-500/20 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-amber-400/40 resize-none"
              />
              <p className="text-xs text-amber-400/60">
                This is logged permanently and tracked in your weekly patterns.
              </p>
            </div>
          )}
        </div>

        {/* Post-trade notes */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">What went right</label>
            <textarea
              value={whatWentRight}
              onChange={(e) => setWhatWentRight(e.target.value)}
              placeholder="What worked in your execution or decision-making?"
              rows={2}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">What went wrong</label>
            <textarea
              value={whatWentWrong}
              onChange={(e) => setWhatWentWrong(e.target.value)}
              placeholder="Be honest — what could you have done better?"
              rows={2}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">One lesson</label>
            <textarea
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              placeholder="The single most important takeaway from this trade…"
              rows={2}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
            />
          </div>
        </div>

        {!canSubmit && followedPlan === false && (
          <p className="text-xs text-amber-400">
            Describe what changed from the plan before submitting.
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || saving || isStreaming || saved}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed text-white border border-white/10 transition-colors flex items-center justify-center gap-2"
        >
          {(saving || isStreaming) && <Loader2 className="h-4 w-4 animate-spin" />}
          {saved ? 'Review Saved' : saving ? 'Saving…' : isStreaming ? 'Getting AI feedback…' : 'Submit Review'}
        </button>
      </form>

      {/* AI Response */}
      {(aiResponse || isStreaming) && (
        <AIFeedback
          response={aiResponse}
          isStreaming={isStreaming}
          accentClass="text-violet-400"
          accentBgClass="bg-violet-400/10"
          accentBorderClass="border-violet-400/20"
          title="Trade Review"
        />
      )}

      {saved && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => router.push('/trading/accountability/plan')}
            className="text-sm text-white/50 hover:text-white/70 transition-colors px-4 py-2"
          >
            Add another trade plan
          </button>
          <button
            onClick={() => router.push('/trading/accountability/debrief')}
            className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Go to EOD Debrief →
          </button>
        </div>
      )}
    </div>
  )
}
