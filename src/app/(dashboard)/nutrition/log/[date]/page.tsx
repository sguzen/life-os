// Full day log view/edit for a specific date

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getServerNutritionLog } from '@/lib/supabase/nutrition'
import { DailyMealChecklist } from '@/components/nutrition/DailyMealChecklist'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { date: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return { title: `Nutrition Log ${params.date} | Life OS` }
}

export default async function NutritionLogPage({ params }: PageProps) {
  const { date } = params

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound()
  }

  const supabase = createClient()
  const nutritionLog = await getServerNutritionLog(supabase, date)

  const d = new Date(date + 'T12:00:00')
  const dateLabel = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const dayOfWeek = d.getDay()
  const isRunDay = dayOfWeek >= 1 && dayOfWeek <= 5

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/nutrition/history"
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          History
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/60">{date}</span>
      </div>

      <DailyMealChecklist
        date={date}
        dateLabel={dateLabel}
        initialLog={nutritionLog}
        isRunDay={isRunDay}
      />
    </div>
  )
}
