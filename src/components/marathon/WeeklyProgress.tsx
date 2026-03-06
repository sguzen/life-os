'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { TrainingWeek } from '@/lib/marathon/plan'
import type { TrainingWeekRow } from '@/lib/supabase/marathon'

interface WeeklyProgressProps {
  planWeeks: TrainingWeek[]
  dbWeeks: TrainingWeekRow[]
}

export function WeeklyProgress({ planWeeks, dbWeeks }: WeeklyProgressProps) {
  const data = planWeeks.map((w) => {
    const db = dbWeeks.find((d) => d.week_number === w.weekNumber)
    return {
      week: `W${w.weekNumber}`,
      planned: w.plannedKm,
      actual: db?.actual_km ?? 0,
      type: w.weekType,
    }
  })

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">Weekly Volume</h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <XAxis
            dataKey="week"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(value: number, name: string) => [`${value}km`, name === 'planned' ? 'Planned' : 'Actual']}
          />
          <Bar dataKey="planned" fill="rgba(255,255,255,0.08)" radius={[3, 3, 0, 0]} name="planned" />
          <Bar dataKey="actual" radius={[3, 3, 0, 0]} name="actual">
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.actual === 0 ? 'rgba(255,255,255,0.08)' :
                  entry.actual >= entry.planned ? '#22c55e' : '#f97316'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-xs text-white/40">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-white/15 inline-block" />Planned</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-orange-500 inline-block" />Actual</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block" />Complete</span>
      </div>
    </div>
  )
}
