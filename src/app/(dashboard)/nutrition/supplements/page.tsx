// Supplement tracker page

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Pill } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getServerSupplementLog } from '@/lib/supabase/nutrition'
import { SupplementChecklist } from '@/components/nutrition/SupplementChecklist'

export const metadata: Metadata = {
  title: 'Supplements | Nutrition | Life OS',
}

export const dynamic = 'force-dynamic'

export default async function SupplementsPage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  // Get today's supplement log
  const supplementLog = await getServerSupplementLog(supabase, today)

  // Check blood donation recovery flag
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 14)
  const { data: recoveryData } = await supabase
    .from('running_activities')
    .select('id')
    .eq('blood_donation_recovery', true)
    .gte('started_at', cutoff.toISOString())
    .limit(1)
    .maybeSingle()

  const isBloodDonationRecovery = !!recoveryData

  // Weekly counts
  const dow = new Date().getDay()
  const monday = new Date()
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1))
  const mondayStr = monday.toISOString().slice(0, 10)

  const [d3Result, b12Result] = await Promise.allSettled([
    supabase
      .from('supplement_logs')
      .select('vitamin_d3_taken')
      .gte('log_date', mondayStr)
      .lte('log_date', today),
    supabase
      .from('supplement_logs')
      .select('b12_taken')
      .gte('log_date', mondayStr)
      .lte('log_date', today),
  ])

  const vitaminD3WeekCount =
    d3Result.status === 'fulfilled'
      ? (d3Result.value.data ?? []).filter((r) => r.vitamin_d3_taken).length
      : 0

  const b12WeekCount =
    b12Result.status === 'fulfilled'
      ? (b12Result.value.data ?? []).filter((r) => r.b12_taken).length
      : 0

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="max-w-2xl space-y-6">
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
        <div className="flex items-center gap-2 mb-1">
          <Pill className="h-5 w-5 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">Supplements</h1>
        </div>
        <p className="text-sm text-white/40">{dateLabel}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <SupplementChecklist
          date={today}
          initialLog={supplementLog}
          isBloodDonationRecovery={isBloodDonationRecovery}
          vitaminD3WeekCount={vitaminD3WeekCount}
          b12WeekCount={b12WeekCount}
        />
      </div>

      {/* Info block */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Prescribing notes</p>
        <ul className="space-y-1 text-xs text-white/30">
          <li>• NO 3: 3-month course, dissolve in mouth in 5-5-5 pattern</li>
          <li>• Vitamin D3 50000 IU: 1x/week with food — test at week 13</li>
          <li>• B12 5000mcg: 2x/week — switch to NOW 1000mcg sublingual after</li>
          <li>• Zentius Flash: switch to NO 2 when finished</li>
          <li>• Folic Acid: 1/day for 1 month, then 3x/week</li>
          <li>• Se ACE Zinc: 4-month course</li>
          <li>• Iron: every other day normally; DAILY during blood donation recovery (2 weeks)</li>
          <li>• Mg Diasporal + Melatonin: every night</li>
        </ul>
      </div>
    </div>
  )
}
