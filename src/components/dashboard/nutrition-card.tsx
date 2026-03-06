// Nutrition dashboard widget — daily overview

import Link from 'next/link'
import { Salad, Droplets, Pill, Wine, AlertTriangle } from 'lucide-react'
import type { NutritionLog } from '@/lib/types/nutrition'
import type { SupplementLog } from '@/lib/types/nutrition'

interface NutritionCardProps {
  log: NutritionLog | null
  supplementLog: SupplementLog | null
}

const SUPPLEMENT_FIELDS: Array<keyof SupplementLog> = [
  'no3_taken',
  'zentius_taken',
  'zinc_taken',
  'folic_acid_taken',
  'mg_bisglycinate_taken',
  'mg_melatonin_taken',
  'se_ace_zinc_taken',
  'iron_taken',
]

export function NutritionCard({ log, supplementLog }: NutritionCardProps) {
  const score = log?.adherence_score ?? null
  const waterMl = log?.water_ml ?? 0
  const alcohol = log?.alcohol_consumed ?? false
  const breadSugar = log?.had_bread_sugar ?? false
  const violations = [
    log?.had_fried_food,
    log?.had_processed_snacks,
    log?.had_juice_soda,
    log?.had_bread_sugar,
  ].filter(Boolean).length

  const supplementCount = supplementLog
    ? SUPPLEMENT_FIELDS.filter((f) => supplementLog[f] === true).length
    : 0

  const scoreColor =
    score === null
      ? 'text-white/30'
      : score >= 80
      ? 'text-emerald-400'
      : score >= 60
      ? 'text-yellow-400'
      : score >= 40
      ? 'text-orange-400'
      : 'text-red-400'

  const scoreBg =
    score === null
      ? ''
      : score >= 80
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : score >= 60
      ? 'bg-yellow-500/10 border-yellow-500/20'
      : score >= 40
      ? 'bg-orange-500/10 border-orange-500/20'
      : 'bg-red-500/10 border-red-500/20'

  return (
    <Link href="/nutrition" className="block">
      <div className={`rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow h-full ${score !== null ? scoreBg : 'border'}`}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Nutrition
          </p>
          {score !== null ? (
            <span className={`text-lg font-bold ${scoreColor}`}>{score}%</span>
          ) : (
            <span className="text-sm text-muted-foreground">Not logged</span>
          )}
        </div>

        {log ? (
          <div className="space-y-2.5">
            {/* Water */}
            <div className="flex items-center gap-2">
              <Droplets className={`h-3.5 w-3.5 shrink-0 ${waterMl >= 2000 ? 'text-blue-400' : 'text-muted-foreground'}`} />
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${waterMl >= 2000 ? 'bg-blue-400' : 'bg-blue-500/40'}`}
                  style={{ width: `${Math.min(100, (waterMl / 2000) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {(waterMl / 1000).toFixed(1)}L
              </span>
            </div>

            {/* Supplements */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Pill className="h-3.5 w-3.5 shrink-0" />
              <span>
                Supplements: {supplementCount}/{SUPPLEMENT_FIELDS.length}
              </span>
              {supplementCount === SUPPLEMENT_FIELDS.length && (
                <span className="text-emerald-400">✓</span>
              )}
            </div>

            {/* Violations */}
            {violations > 0 && (
              <div className="flex items-center gap-2 text-xs text-orange-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {violations} violation{violations > 1 ? 's' : ''} flagged
                  {breadSugar && ' (bread/sugar)'}
                </span>
              </div>
            )}

            {/* Alcohol */}
            {alcohol && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <Wine className="h-3.5 w-3.5 shrink-0" />
                <span>Alcohol — trading gate blocked tomorrow</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Salad className="h-4 w-4 shrink-0" />
            <span>Tap to log today&apos;s meals</span>
          </div>
        )}
      </div>
    </Link>
  )
}
