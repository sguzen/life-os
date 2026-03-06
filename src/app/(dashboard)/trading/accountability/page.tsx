// Accountability Daily Hub

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { DailyHub } from '@/components/trading/accountability/DailyHub'
import type { TradingChallenge } from '@/lib/types/accountability'
import type { TradePlan, TradeReview } from '@/lib/types/accountability'

export const metadata: Metadata = {
  title: 'Accountability | Trading',
  description: 'Daily trading accountability loop — 4 checkpoints, AI coaching, guardrails',
}

export const dynamic = 'force-dynamic'

export default async function AccountabilityPage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  // Load active challenge
  const { data: challenge } = await supabase
    .from('trading_challenges')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  // Load today's session
  const { data: session } = await supabase
    .from('accountability_sessions')
    .select('*')
    .eq('session_date', today)
    .maybeSingle()

  // Load plans + reviews if session exists
  let sessionWithPlans = null
  if (session) {
    const { data: plans } = await supabase
      .from('trade_plans')
      .select('*, trade_reviews(*)')
      .eq('session_id', session.id)
      .order('plan_number')

    const plansWithReviews = (plans ?? []).map((p: TradePlan & { trade_reviews?: TradeReview[] }) => ({
      ...p,
      review: p.trade_reviews?.[0] ?? null,
    }))

    sessionWithPlans = {
      ...session,
      challenge: challenge ?? null,
      plans: plansWithReviews,
    }
  }

  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Accountability</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Daily trading discipline loop — gate, plan, review, debrief.
          </p>
        </div>
      </div>

      <DailyHub
        date={today}
        session={sessionWithPlans}
        challenge={(challenge as TradingChallenge) ?? null}
        formattedDate={formattedDate}
      />
    </div>
  )
}
