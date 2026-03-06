'use client'

import Link from 'next/link'
import {
  ShieldCheck,
  ShieldX,
  FileText,
  BookOpen,
  BarChart3,
  Lock,
  AlertTriangle,
  ChevronRight,
  Circle,
  CheckCircle2,
  Settings,
} from 'lucide-react'
import type { SessionWithPlans, TradingChallenge } from '@/lib/types/accountability'

interface DailyHubProps {
  date: string
  session: SessionWithPlans | null
  challenge: TradingChallenge | null
  formattedDate: string
}

export function DailyHub({ date, session, challenge, formattedDate }: DailyHubProps) {
  // Determine checkpoint states
  const gateComplete = session?.gate_passed !== null && session?.sleep_hours !== null
  const gateBlocked = session?.gate_passed === false
  const gatePassed = session?.gate_passed === true

  const plansCount = session?.plans.length ?? 0
  const reviewsCount = session?.plans.filter((p) => p.review !== null).length ?? 0

  const debriefComplete = !!session?.eod_ai_response
  const debriefNotes = session?.eod_notes

  // Net P&L
  const netPnl = session?.net_pnl

  // Determine next action
  function getNextAction(): { label: string; href: string } | null {
    if (!gateComplete) return { label: 'Start pre-session check', href: '/trading/accountability/gate' }
    if (gateBlocked) return { label: 'Gate blocked — review why', href: '/trading/accountability/gate' }
    if (plansCount < 2) return { label: 'Plan your next trade', href: '/trading/accountability/plan' }
    if (reviewsCount < plansCount) {
      const unreviewed = session?.plans.find((p) => p.review === null)
      if (unreviewed) return { label: 'Review your trade', href: `/trading/accountability/plan/${unreviewed.id}/review` }
    }
    if (!debriefComplete) return { label: 'Complete EOD debrief', href: '/trading/accountability/debrief' }
    return null
  }

  const nextAction = getNextAction()

  const checkpoints = [
    {
      number: 1,
      title: 'Pre-Session Gate',
      href: '/trading/accountability/gate',
      complete: gateComplete,
      blocked: gateBlocked,
      detail: gateComplete
        ? gatePassed
          ? `Sleep ${session?.sleep_hours}h · Physical ${session?.physical_score}/10 · Emotional ${session?.emotional_score}/10`
          : 'BLOCKED — trading not permitted'
        : 'Not completed',
      accent: gatePassed ? 'emerald' : gateBlocked ? 'red' : 'white',
    },
    {
      number: 2,
      title: 'Trade Plans',
      href: '/trading/accountability/plan',
      complete: plansCount > 0,
      blocked: !gatePassed,
      detail: gateComplete && gatePassed
        ? plansCount === 0
          ? 'No plans submitted'
          : `${plansCount}/2 plans submitted`
        : gatePassed === false
        ? 'Gate not passed'
        : 'Complete gate first',
      accent: plansCount > 0 ? 'indigo' : 'white',
    },
    {
      number: 3,
      title: 'Trade Reviews',
      href: plansCount > 0 && session?.plans[0]
        ? `/trading/accountability/plan/${session.plans[0].id}/review`
        : '/trading/accountability',
      complete: reviewsCount > 0 && reviewsCount === plansCount && plansCount > 0,
      blocked: plansCount === 0,
      detail: plansCount === 0
        ? 'No plans to review'
        : `${reviewsCount}/${plansCount} reviewed`,
      accent: reviewsCount === plansCount && plansCount > 0 ? 'violet' : 'white',
    },
    {
      number: 4,
      title: 'EOD Debrief',
      href: '/trading/accountability/debrief',
      complete: debriefComplete,
      blocked: !gateComplete,
      detail: debriefComplete
        ? netPnl != null
          ? `P&L: ${netPnl >= 0 ? '+' : ''}$${netPnl}`
          : 'Completed'
        : 'Not completed',
      accent: debriefComplete ? 'emerald' : 'white',
    },
  ]

  const completedCount = checkpoints.filter((c) => c.complete).length

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">TODAY</h2>
              <span className="text-sm text-white/40">{formattedDate}</span>
              {challenge && (
                <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                  {challenge.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {netPnl != null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/40">Daily P&L:</span>
                  <span className={`text-sm font-semibold ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {netPnl >= 0 ? '+' : ''}${netPnl}
                  </span>
                </div>
              )}
              {challenge && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/40">Loss limit:</span>
                  <span className="text-sm text-white/60">${challenge.daily_loss_limit}</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-white">{completedCount}</span>
            <span className="text-sm text-white/30">/4</span>
            <p className="text-xs text-white/30 mt-0.5">checkpoints</p>
          </div>
        </div>
      </div>

      {/* Guardrails status */}
      {session && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 space-y-2">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Active guardrails</p>
          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-2">
              {gatePassed ? (
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : gateBlocked ? (
                <ShieldX className="h-4 w-4 text-red-400 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-white/20 shrink-0" />
              )}
              <span className="text-sm text-white/60">
                Gate:{' '}
                <span className={gatePassed ? 'text-emerald-400' : gateBlocked ? 'text-red-400' : 'text-white/30'}>
                  {gateComplete
                    ? gatePassed
                      ? `PASSED (sleep ${session.sleep_hours}h, physical ${session.physical_score}, emotional ${session.emotional_score}, no alcohol)`
                      : 'BLOCKED'
                    : 'Not completed'}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {session.revenge_lock_triggered ? (
                <Lock className="h-4 w-4 text-red-400 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-white/20 shrink-0" />
              )}
              <span className="text-sm text-white/60">
                Revenge lock:{' '}
                <span className={session.revenge_lock_triggered ? 'text-red-400 font-medium' : 'text-white/30'}>
                  {session.revenge_lock_triggered
                    ? 'ACTIVE'
                    : `OFF (${session.consecutive_losses} consecutive losses)`}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {session.external_influence_flagged ? (
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-white/20 shrink-0" />
              )}
              <span className="text-sm text-white/60">
                External influence:{' '}
                <span className={session.external_influence_flagged ? 'text-amber-400' : 'text-white/30'}>
                  {session.external_influence_flagged ? 'FLAGGED' : 'Not flagged'}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Checkpoint cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {checkpoints.map((cp) => {
          const isLocked = cp.blocked && !cp.complete
          return (
            <Link
              key={cp.number}
              href={isLocked ? '#' : cp.href}
              className={`group rounded-xl border p-4 space-y-3 transition-colors ${
                isLocked
                  ? 'border-white/5 bg-white/[0.02] cursor-not-allowed opacity-50'
                  : cp.complete
                  ? `border-${cp.accent}-500/30 bg-${cp.accent}-500/5 hover:bg-${cp.accent}-500/10`
                  : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'
              }`}
              onClick={(e) => isLocked && e.preventDefault()}
            >
              <div className="flex items-start justify-between">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  cp.complete
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isLocked
                    ? 'bg-white/5 text-white/20'
                    : 'bg-white/10 text-white/50'
                }`}>
                  {cp.complete ? '✓' : cp.number}
                </div>
                {!isLocked && (
                  <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />
                )}
                {isLocked && <Lock className="h-3.5 w-3.5 text-white/15" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${cp.complete ? 'text-white' : 'text-white/60'}`}>
                  {cp.title}
                </p>
                <p className="text-xs text-white/30 mt-1 leading-relaxed">{cp.detail}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Next action CTA */}
      {nextAction && (
        <Link
          href={nextAction.href}
          className="flex items-center justify-between w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/8 hover:border-white/25 px-5 py-4 transition-colors group"
        >
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider font-medium">Next step</p>
            <p className="text-sm font-semibold text-white mt-0.5">{nextAction.label}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60 transition-colors" />
        </Link>
      )}

      {/* All done state */}
      {completedCount === 4 && !nextAction && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-400">Session complete</p>
          <p className="text-xs text-white/30 mt-1">All 4 checkpoints done. Good work today.</p>
        </div>
      )}

      {/* No challenge warning */}
      {!challenge && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-300">No active challenge configured</p>
            <p className="text-xs text-white/30 mt-0.5">AI coaching uses generic context without challenge rules.</p>
          </div>
          <Link
            href="/trading/accountability/challenge"
            className="shrink-0 flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Configure
          </Link>
        </div>
      )}

      {/* Quick nav */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/trading/accountability/gate"
          className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Gate
        </Link>
        <Link
          href="/trading/accountability/plan"
          className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Trade Plan
        </Link>
        <Link
          href="/trading/accountability/debrief"
          className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Debrief
        </Link>
        <Link
          href="/trading/accountability/challenge"
          className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Challenges
        </Link>
      </div>
    </div>
  )
}
