// Checkpoint 2: Trade Plan

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ShieldX } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TradePlanForm } from '@/components/trading/accountability/TradePlanForm'
import type { TradingChallenge, AccountabilitySession_DB } from '@/lib/types/accountability'

export const metadata: Metadata = {
  title: 'Trade Plan | Accountability',
}

export const dynamic = 'force-dynamic'

export default async function PlanPage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: challenge }, { data: session }] = await Promise.all([
    supabase.from('trading_challenges').select('*').eq('is_active', true).maybeSingle(),
    supabase.from('accountability_sessions').select('*').eq('session_date', today).maybeSingle(),
  ])

  // Gate not completed
  if (!session || session.gate_passed === null) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Link href="/trading/accountability" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors">
            <ChevronLeft className="h-4 w-4" />
            Hub
          </Link>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-amber-400">Complete the pre-session gate first</p>
          <p className="text-xs text-white/30">You need to pass the gate before you can submit a trade plan.</p>
          <Link
            href="/trading/accountability/gate"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-2.5 text-sm font-semibold transition-colors mt-2"
          >
            Go to Gate Check →
          </Link>
        </div>
      </div>
    )
  }

  // Gate failed
  if (session.gate_passed === false) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Link href="/trading/accountability" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors">
            <ChevronLeft className="h-4 w-4" />
            Hub
          </Link>
        </div>
        <div className="rounded-xl border border-red-500/40 bg-red-950/50 p-8 text-center space-y-3">
          <ShieldX className="h-8 w-8 text-red-400 mx-auto" />
          <p className="text-lg font-bold text-red-400">TRADING BLOCKED TODAY</p>
          <p className="text-sm text-red-300">You did not pass the pre-session gate. No trade plans today.</p>
          <Link
            href="/trading/accountability/gate"
            className="inline-flex items-center gap-2 text-xs text-red-400/70 hover:text-red-300 underline underline-offset-2 transition-colors"
          >
            Review gate check
          </Link>
        </div>
      </div>
    )
  }

  // Load existing plans count
  const { count: planCount } = await supabase
    .from('trade_plans')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session.id)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/trading/accountability" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Hub
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/60">2. Trade Plan</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-white">Trade Plan</h1>
        <p className="text-sm text-white/40 mt-1">
          Define your setup before entry. No plan = no trade.
        </p>
        <p className="text-xs text-white/30 mt-1">{planCount ?? 0}/2 plans used today</p>
      </div>

      {challenge && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-white/50">
            {(challenge as TradingChallenge).name} — daily limit ${(challenge as TradingChallenge).daily_loss_limit}
          </span>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <TradePlanForm
          date={today}
          session={session as AccountabilitySession_DB}
          challenge={(challenge as TradingChallenge) ?? null}
          planCount={planCount ?? 0}
        />
      </div>
    </div>
  )
}
