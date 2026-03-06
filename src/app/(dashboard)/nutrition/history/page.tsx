// Nutrition history — calendar heatmap + weekly summary

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getServerNutritionHistory } from '@/lib/supabase/nutrition'
import { NutritionHistory } from '@/components/nutrition/NutritionHistory'

export const metadata: Metadata = {
  title: 'Nutrition History | Life OS',
}

export const dynamic = 'force-dynamic'

export default async function NutritionHistoryPage() {
  const supabase = createClient()
  const history = await getServerNutritionHistory(supabase, 90)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Today
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-white">Nutrition History</h1>
        <p className="text-sm text-white/40 mt-0.5">Last 90 days of adherence</p>
      </div>

      <NutritionHistory history={history} />
    </div>
  )
}
