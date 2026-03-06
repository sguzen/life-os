// Checkpoint 1: Pre-Session Gate

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { GateForm } from '@/components/trading/accountability/GateForm'
import type { TradingChallenge, AccountabilitySession_DB } from '@/lib/types/accountability'

export const metadata: Metadata = {
  title: 'Pre-Session Gate | Accountability',
}

export const dynamic = 'force-dynamic'

export default async function GatePage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: challenge }, { data: session }] = await Promise.all([
    supabase.from('trading_challenges').select('*').eq('is_active', true).maybeSingle(),
    supabase.from('accountability_sessions').select('*').eq('session_date', today).maybeSingle(),
  ])

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/trading/accountability"
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Hub
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/60">1. Pre-Session Gate</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-white">Pre-Session Gate</h1>
        <p className="text-sm text-white/40 mt-1">
          Are you ready to trade today? This check is non-negotiable.
        </p>
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
        <GateForm
          date={today}
          challenge={(challenge as TradingChallenge) ?? null}
          existingSession={(session as AccountabilitySession_DB) ?? null}
        />
      </div>
    </div>
  )
}
