// Challenge Config — prop firm rules management

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ChallengeConfig } from '@/components/trading/accountability/ChallengeConfig'
import type { TradingChallenge } from '@/lib/types/accountability'

export const metadata: Metadata = {
  title: 'Challenge Config | Accountability',
}

export const dynamic = 'force-dynamic'

export default async function ChallengePage() {
  const supabase = createClient()

  const { data: challenges } = await supabase
    .from('trading_challenges')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/trading/accountability" className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Hub
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/60">Challenge Config</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-white">Prop Firm Challenges</h1>
        <p className="text-sm text-white/40 mt-1">
          Configure your active challenge. Rules are injected into every AI coaching session.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <ChallengeConfig initialChallenges={(challenges ?? []) as TradingChallenge[]} />
      </div>
    </div>
  )
}
