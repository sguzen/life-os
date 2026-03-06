// Report a new adaptation trigger

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { TriggerReportForm } from '@/components/adapt/TriggerReportForm'

export const metadata: Metadata = {
  title: 'Report Issue — Adapt',
  description: 'Report illness, injury, fatigue, or poor sleep',
}

export default function ReportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/adapt"
          className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Adapt
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Report an issue</h1>
        <p className="text-sm text-white/40 mt-1">
          Tell me what's happening — I'll assess severity and propose adjustments.
        </p>
      </div>

      <TriggerReportForm />
    </div>
  )
}
