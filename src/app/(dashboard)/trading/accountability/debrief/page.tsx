// Checkpoint 4: EOD Debrief

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DebriefForm } from '@/components/trading/accountability/DebriefForm'
import type { TradePlan, TradeReview } from '@/lib/types/accountability'

export const metadata: Metadata = {
  title: 'EOD Debrief | Accountability',
}

export const dynamic = 'force-dynamic'

export default async function DebriefPage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: challenge }, { data: session }] = await Promise.all([
    supabase.from('trading_challenges').select('*').eq('is_active', true).maybeSingle(),
    supabase.from('accountability_sessions').select('*').eq('session_date', today).maybeSingle(),
  ])

  if (!session) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Link href="/trading/accountability" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors">
            <ChevronLeft className="h-4 w-4" />
            Hub
          </Link>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center space-y-3">
          <p className="text-sm text-white/40">No session started today.</p>
          <Link href="/trading/accountability/gate" className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-2.5 text-sm font-semibold transition-colors mt-2">
            Start with Gate Check →
          </Link>
        </div>
      </div>
    )
  }

  // Load plans + reviews
  const { data: plans } = await supabase
    .from('trade_plans')
    .select('*, trade_reviews(*)')
    .eq('session_id', session.id)
    .order('plan_number')

  const plansWithReviews = (plans ?? []).map((p: TradePlan & { trade_reviews?: TradeReview[] }) => ({
    ...p,
    review: p.trade_reviews?.[0] ?? null,
  }))

  const sessionWithPlans = {
    ...session,
    challenge: challenge ?? null,
    plans: plansWithReviews,
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/trading/accountability" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Hub
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/60">4. EOD Debrief</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-white">End-of-Day Debrief</h1>
        <p className="text-sm text-white/40 mt-1">
          Close out the session. Review, grade, and set tomorrow's focus.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <DebriefForm date={today} session={sessionWithPlans} />
      </div>
    </div>
  )
}
