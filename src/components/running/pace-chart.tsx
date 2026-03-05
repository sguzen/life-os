'use client'

// P4-04: Actual vs prescribed pace bar chart per lap

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { formatPace } from '@/lib/running/format'
import type { RunningLap } from '@/lib/types/running'

interface PaceChartProps {
  laps: RunningLap[]
  prescribedPaceSecPerKm?: number | null
}

interface TooltipPayload {
  value: number
  name: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-gray-900 border border-white/10 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-white mb-1">Lap {label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-white/70">
          {p.name}: <span className="text-white font-mono">{formatPace(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export function PaceChart({ laps, prescribedPaceSecPerKm }: PaceChartProps) {
  if (laps.length === 0) return null

  const data = laps.map((lap) => ({
    lap: lap.lap_number,
    actual: lap.avg_pace_sec_per_km ?? 0,
  }))

  // Y-axis: invert so faster pace (lower sec/km) appears higher
  const paces = data.map((d) => d.actual).filter(Boolean)
  const minPace = Math.min(...paces) - 30
  const maxPace = Math.max(...paces) + 30

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="lap"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
        />
        <YAxis
          domain={[minPace, maxPace]}
          reversed   // faster = higher bar
          tickFormatter={(v) => formatPace(v)}
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={58}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {prescribedPaceSecPerKm && (
          <ReferenceLine
            y={prescribedPaceSecPerKm}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: `Target ${formatPace(prescribedPaceSecPerKm)}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
          />
        )}
        <Bar dataKey="actual" name="Actual pace" radius={[3, 3, 0, 0]} maxBarSize={32}>
          {data.map((d) => {
            const isSlower = prescribedPaceSecPerKm != null && d.actual > prescribedPaceSecPerKm + 10
            const isFaster = prescribedPaceSecPerKm != null && d.actual < prescribedPaceSecPerKm - 10
            const color = !prescribedPaceSecPerKm ? '#6366f1' : isSlower ? '#f87171' : isFaster ? '#60a5fa' : '#4ade80'
            return <Cell key={d.lap} fill={color} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
