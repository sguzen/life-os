// Adaptation history — timeline of all past events

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getAllAdaptationEvents, getAdjustmentsForEvent } from '@/lib/supabase/adapt'
import { AdaptationHistory } from '@/components/adapt/AdaptationHistory'
import type { AdaptationAdjustment } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Adaptation History',
}

export default async function HistoryPage() {
  const events = await getAllAdaptationEvents()

  // Fetch adjustments for each event in parallel
  const adjustmentsByEvent: Record<string, AdaptationAdjustment[]> = {}
  await Promise.all(
    events.map(async (e) => {
      adjustmentsByEvent[e.id] = await getAdjustmentsForEvent(e.id)
    })
  )

  return (
    <div className="space-y-6">
      <Link
        href="/adapt"
        className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Adapt
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Adaptation History</h1>
        <p className="text-sm text-white/40 mt-1">
          Past events, adjustments, and recovery timelines
        </p>
      </div>

      <AdaptationHistory events={events} adjustmentsByEvent={adjustmentsByEvent} />
    </div>
  )
}
