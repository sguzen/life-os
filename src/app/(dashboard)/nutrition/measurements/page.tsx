// Body composition history + measurements entry

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getServerBodyMeasurements } from '@/lib/supabase/nutrition'
import { BodyCompositionChart } from '@/components/nutrition/BodyCompositionChart'
import { MeasurementForm } from '@/components/nutrition/MeasurementForm'

export const metadata: Metadata = {
  title: 'Body Measurements | Nutrition | Life OS',
}

export const dynamic = 'force-dynamic'

export default async function MeasurementsPage() {
  const supabase = createClient()
  const measurements = await getServerBodyMeasurements(supabase)

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
        <h1 className="text-xl font-bold text-white">Body Composition</h1>
        <p className="text-sm text-white/40 mt-0.5">
          Track weight, body fat, and measurements towards Belgrade Marathon target
        </p>
      </div>

      {/* Progress chart */}
      <BodyCompositionChart measurements={measurements} />

      {/* Log new measurement */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-4">Log Measurement</h2>
        <MeasurementForm />
      </div>

      {/* History table */}
      {measurements.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <h2 className="text-sm font-semibold text-white/70">Measurement History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left px-4 py-2 text-white/35 font-medium">Date</th>
                  <th className="text-right px-3 py-2 text-white/35 font-medium">Weight</th>
                  <th className="text-right px-3 py-2 text-white/35 font-medium">BF%</th>
                  <th className="text-right px-3 py-2 text-white/35 font-medium">Fat kg</th>
                  <th className="text-right px-3 py-2 text-white/35 font-medium">Muscle kg</th>
                  <th className="text-right px-4 py-2 text-white/35 font-medium">Waist</th>
                </tr>
              </thead>
              <tbody>
                {[...measurements].reverse().map((m) => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-2 text-white/60">
                      {new Date(m.measured_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2 text-right text-white/75">{m.weight_kg ?? '—'}kg</td>
                    <td className="px-3 py-2 text-right text-violet-300">{m.body_fat_pct ?? '—'}%</td>
                    <td className="px-3 py-2 text-right text-white/50">{m.fat_mass_kg ?? '—'}kg</td>
                    <td className={`px-3 py-2 text-right ${
                      m.muscle_mass_kg && m.muscle_mass_kg < 48.0
                        ? 'text-red-400 font-semibold'
                        : 'text-white/50'
                    }`}>
                      {m.muscle_mass_kg ?? '—'}kg
                    </td>
                    <td className="px-4 py-2 text-right text-white/40">
                      {m.waist_mid_cm ?? '—'}cm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
