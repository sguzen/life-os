'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AIFeedback } from './AIFeedback'
import type { SessionWithPlans, SessionGrade } from '@/lib/types/accountability'
import { upsertAccountabilitySession } from '@/lib/supabase/accountability'

interface DebriefFormProps {
  date: string
  session: SessionWithPlans
}

const GRADES: SessionGrade[] = ['A', 'B', 'C', 'D', 'F']

const GRADE_COLORS: Record<SessionGrade, string> = {
  A: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
  B: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  C: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  D: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  F: 'bg-red-500/20 border-red-500/40 text-red-400',
}

export function DebriefForm({ date, session }: DebriefFormProps) {
  const router = useRouter()

  const [netPnl, setNetPnl] = useState(session.net_pnl?.toString() ?? '')
  const [tradeManagement, setTradeManagement] = useState('')
  const [emotionalScore, setEmotionalScore] = useState(7)
  const [emotionalNotes, setEmotionalNotes] = useState('')
  const [bestDecision, setBestDecision] = useState('')
  const [worstDecision, setWorstDecision] = useState('')
  const [ruleViolations, setRuleViolations] = useState('')
  const [sessionGrade, setSessionGrade] = useState<SessionGrade>('B')
  const [tomorrowsFocus, setTomorrowsFocus] = useState('')

  const [saving, setSaving] = useState(false)
  const [aiResponse, setAiResponse] = useState(session.eod_ai_response ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [saved, setSaved] = useState(!!session.eod_ai_response)
  const [error, setError] = useState('')

  const canSubmit =
    netPnl.trim() !== '' &&
    bestDecision.trim() !== '' &&
    worstDecision.trim() !== '' &&
    tomorrowsFocus.trim() !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    setError('')
    setAiResponse('')

    const formData = {
      net_pnl: parseFloat(netPnl),
      trade_management_review: tradeManagement,
      emotional_state_score: emotionalScore,
      emotional_state_notes: emotionalNotes,
      best_decision: bestDecision,
      worst_decision: worstDecision,
      rule_violations: ruleViolations,
      session_grade: sessionGrade,
      tomorrows_focus: tomorrowsFocus,
    }

    try {
      // Save P&L + notes to session
      await upsertAccountabilitySession({
        session_date: date,
        net_pnl: formData.net_pnl,
        eod_notes: JSON.stringify({
          tradeManagement,
          emotionalScore,
          emotionalNotes,
          bestDecision,
          worstDecision,
          ruleViolations,
          sessionGrade,
          tomorrowsFocus,
        }),
      })

      // Stream AI response
      setIsStreaming(true)
      const res = await fetch('/api/ai/accountability-debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          sessionData: session,
          challengeConfig: session.challenge,
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

      // Save AI response
      await upsertAccountabilitySession({
        session_date: date,
        eod_ai_response: fullText,
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
    <div className="space-y-6">
      {/* Today's summary */}
      {session.plans.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Today's trades</p>
          {session.plans.map((p) => (
            <div key={p.id} className="flex items-center gap-3 text-sm">
              <span className="text-white/50">Plan {p.plan_number}:</span>
              <span className="text-white/70">{p.instrument} {p.direction}</span>
              {p.review ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  p.review.outcome === 'Win'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : p.review.outcome === 'Loss'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {p.review.outcome} {p.review.actual_pnl != null ? `$${p.review.actual_pnl}` : ''}
                </span>
              ) : (
                <span className="text-xs text-white/30">No review</span>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Net P&L */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Net P&L today <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">$</span>
            <input
              type="number"
              step="0.01"
              value={netPnl}
              onChange={(e) => setNetPnl(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg bg-white/5 border border-white/10 pl-7 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
            />
          </div>
          {session.challenge && netPnl && parseFloat(netPnl) < -session.challenge.daily_loss_limit && (
            <p className="text-xs text-red-400 font-medium">
              ⚠ Daily loss limit breached (${session.challenge.daily_loss_limit})
            </p>
          )}
        </div>

        {/* Trade management review */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Trade management review
          </label>
          <textarea
            value={tradeManagement}
            onChange={(e) => setTradeManagement(e.target.value)}
            placeholder="Did you follow your stops? Did you trail correctly? Where did you deviate?"
            rows={3}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
          />
        </div>

        {/* Emotional state during session */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Emotional state during session: {emotionalScore}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={emotionalScore}
            onChange={(e) => setEmotionalScore(Number(e.target.value))}
            className="w-full accent-violet-400"
          />
          <textarea
            value={emotionalNotes}
            onChange={(e) => setEmotionalNotes(e.target.value)}
            placeholder="How did emotions affect your trading today?"
            rows={2}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
          />
        </div>

        {/* Best / worst decision */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Best decision today <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
            </label>
            <textarea
              value={bestDecision}
              onChange={(e) => setBestDecision(e.target.value)}
              placeholder="The one thing you're proud of…"
              rows={3}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Worst decision today <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
            </label>
            <textarea
              value={worstDecision}
              onChange={(e) => setWorstDecision(e.target.value)}
              placeholder="The one thing you'd take back…"
              rows={3}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
            />
          </div>
        </div>

        {/* Rule violations */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Rule violations (leave blank if none)
          </label>
          <textarea
            value={ruleViolations}
            onChange={(e) => setRuleViolations(e.target.value)}
            placeholder="List any rules you broke today, however small…"
            rows={2}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
          />
        </div>

        {/* Session grade */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Overall session grade</label>
          <div className="flex gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSessionGrade(g)}
                className={`flex-1 rounded-xl py-3 text-lg font-bold border transition-colors ${
                  sessionGrade === g ? GRADE_COLORS[g] : 'bg-white/5 border-white/10 text-white/30 hover:border-white/20'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Tomorrow's focus */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Tomorrow's focus <span className="text-red-400 normal-case text-xs font-normal">(required)</span>
          </label>
          <input
            type="text"
            value={tomorrowsFocus}
            onChange={(e) => setTomorrowsFocus(e.target.value)}
            placeholder="One specific thing to focus on in tomorrow's session…"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
          />
        </div>

        {!canSubmit && (
          <p className="text-xs text-white/30">
            Fill in Net P&L, best/worst decisions, and tomorrow's focus to submit.
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || saving || isStreaming}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed text-white border border-white/10 transition-colors flex items-center justify-center gap-2"
        >
          {(saving || isStreaming) && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : isStreaming ? 'Getting debrief…' : saved ? 'Update Debrief' : 'Submit EOD Debrief'}
        </button>
      </form>

      {/* AI Response */}
      {(aiResponse || isStreaming) && (
        <AIFeedback
          response={aiResponse}
          isStreaming={isStreaming}
          accentClass="text-emerald-400"
          accentBgClass="bg-emerald-400/10"
          accentBorderClass="border-emerald-400/20"
          title="End-of-Day Debrief"
        />
      )}

      {saved && (
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/trading/accountability')}
            className="flex items-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Back to Hub →
          </button>
        </div>
      )}
    </div>
  )
}
