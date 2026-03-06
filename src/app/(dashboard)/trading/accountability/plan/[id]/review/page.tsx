// Checkpoint 3: Trade Review

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TradeReviewForm } from '@/components/trading/accountability/TradeReviewForm'
import type { TradePlan, TradeReview } from '@/lib/types/accountability'

export const metadata: Metadata = {
  title: 'Trade Review | Accountability',
}

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export default async function ReviewPage({ params }: Props) {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  // Load the plan
  const { data: plan, error } = await supabase
    .from('trade_plans')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !plan) {
    notFound()
  }

  // Check if review already exists
  const { data: existingReview } = await supabase
    .from('trade_reviews')
    .select('*')
    .eq('plan_id', plan.id)
    .maybeSingle()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/trading/accountability" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Hub
        </Link>
        <span className="text-white/20">/</span>
        <Link href="/trading/accountability/plan" className="text-sm text-white/40 hover:text-white/60 transition-colors">
          Trade Plan
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/60">3. Review</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-white">Trade Review</h1>
        <p className="text-sm text-white/40 mt-1">
          Post-trade analysis. What happened vs what you planned.
        </p>
      </div>

      {existingReview ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">Review already submitted</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Outcome', value: (existingReview as TradeReview).outcome },
                { label: 'P&L', value: (existingReview as TradeReview).actual_pnl != null ? `$${(existingReview as TradeReview).actual_pnl}` : 'N/A' },
                { label: 'Followed plan', value: (existingReview as TradeReview).followed_plan ? 'Yes' : 'No' },
                { label: 'Execution quality', value: `${(existingReview as TradeReview).execution_quality}/10` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-white/30">{label}</p>
                  <p className="text-sm font-medium text-white/70 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {(existingReview as TradeReview).review_ai_response && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-xs text-white/30 mb-2">AI feedback</p>
                <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                  {(existingReview as TradeReview).review_ai_response}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Link href="/trading/accountability/plan" className="text-sm text-white/40 hover:text-white/60 transition-colors px-4 py-2">
              Add another plan
            </Link>
            <Link
              href="/trading/accountability/debrief"
              className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              EOD Debrief →
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <TradeReviewForm
            plan={plan as TradePlan}
            sessionId={plan.session_id}
            date={today}
          />
        </div>
      )}
    </div>
  )
}
