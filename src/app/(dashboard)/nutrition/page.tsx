// Nutrition Hub — Today's meal checklist (meals from DB)

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getServerNutritionLog,
  getServerSupplementLog,
} from '@/lib/supabase/nutrition'
import { getServerMealsForDayType, seedMealsServer } from '@/lib/supabase/meals'
import { DailyMealChecklist } from '@/components/nutrition/DailyMealChecklist'
import { Activity, BarChart2, Pill, CalendarDays } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Nutrition | Life OS',
}

export const dynamic = 'force-dynamic'

export default async function NutritionPage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  // Determine day type
  const dayOfWeek = new Date().getDay()
  const isRunDay = dayOfWeek >= 1 && dayOfWeek <= 5
  const dayType: 'training' | 'rest' = isRunDay ? 'training' : 'rest'

  // Seed meals on first visit (idempotent)
  await seedMealsServer()

  const [nutritionLog, supplementLog, meals] = await Promise.all([
    getServerNutritionLog(supabase, today),
    getServerSupplementLog(supabase, today),
    getServerMealsForDayType(supabase, dayType),
  ])

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Supplement compliance
  const supplementFields = [
    'no3_taken',
    'zentius_taken',
    'zinc_taken',
    'folic_acid_taken',
    'mg_bisglycinate_taken',
    'mg_melatonin_taken',
    'se_ace_zinc_taken',
    'iron_taken',
  ] as const

  const supplementCount = supplementLog
    ? supplementFields.filter((f) => supplementLog[f] === true).length
    : 0

  return (
    <div className="max-w-2xl space-y-6">
      {/* Sub-nav */}
      <nav className="flex gap-2 flex-wrap">
        {[
          { href: '/nutrition', label: 'Today', icon: Activity, active: true },
          { href: '/nutrition/supplements', label: 'Supplements', icon: Pill },
          { href: '/nutrition/measurements', label: 'Measurements', icon: BarChart2 },
          { href: '/nutrition/history', label: 'History', icon: CalendarDays },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border transition-colors ${
              active
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-white/3 border-white/8 text-white/50 hover:text-white/70 hover:border-white/15'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Supplement quick-status */}
      {supplementCount < 8 && (
        <Link
          href="/nutrition/supplements"
          className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 hover:bg-yellow-500/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-yellow-400" />
            <span className="text-sm text-yellow-300">
              Supplements: {supplementCount}/8 daily taken
            </span>
          </div>
          <span className="text-xs text-yellow-400/60">Log →</span>
        </Link>
      )}

      {/* Main checklist */}
      <DailyMealChecklist
        date={today}
        dateLabel={dateLabel}
        initialLog={nutritionLog}
        isRunDay={isRunDay}
        meals={meals}
      />
    </div>
  )
}
