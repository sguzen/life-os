'use client'

// P4-05: Resting HR chart with spike highlighting and rolling average overlay

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { computeRollingAvg, RESTING_HR_BASELINE_LOW, RESTING_HR_BASELINE_HIGH, SPIKE_THRESHOLD_BPM } from '@/lib/running/hr-spike'
import type { RestingHrLog } from '@/lib/types/running'

interface RestingHrChartProps {
  logs: RestingHrLog[]
}

interface TooltipPayload {
  value: number
  name: string
  color: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const spike = payload.find((p) => p.name === 'HR')
  const avg = payload.find((p) => p.name === '7-day avg')
  return (
    <div className="rounded-lg bg-gray-900 border border-white/10 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-white mb-1">{label}</p>
      {spike && <p className="text-white/70">Resting HR: <span className="font-semibold text-white">{spike.value} bpm</span></p>}
      {avg && <p className="text-white/70">7-day avg: <span className="font-semibold" style={{ color: avg.color }}>{avg.value} bpm</span></p>}
    </div>
  )
}

export function RestingHrChart({ logs }: RestingHrChartProps) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-white/30">
        No resting HR data yet
      </div>
    )
  }

  const annotated = computeRollingAvg(logs)
  const spikes = annotated.filter((l) => l.is_spike)

  const data = annotated.map((l) => ({
    date: new Date(l.logged_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    hr: l.resting_hr,
    avg: l.rolling_avg,
    is_spike: l.is_spike,
  }))

  return (
    <div className="space-y-3">
      {spikes.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>{spikes.length} spike{spikes.length > 1 ? 's' : ''}</strong> detected —
            resting HR ≥{SPIKE_THRESHOLD_BPM} bpm above 7-day avg. Consider extra recovery.
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            unit=" bpm"
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

          {/* Baseline range shading via reference lines */}
          <ReferenceLine y={RESTING_HR_BASELINE_LOW} stroke="rgba(99,102,241,0.3)" strokeDasharray="2 4" />
          <ReferenceLine
            y={RESTING_HR_BASELINE_HIGH}
            stroke="rgba(99,102,241,0.3)"
            strokeDasharray="2 4"
            label={{ value: 'Baseline', position: 'insideTopRight', fill: 'rgba(99,102,241,0.5)', fontSize: 9 }}
          />

          {/* HR bars — red if spike, else indigo */}
          <Bar dataKey="hr" name="HR" maxBarSize={20} radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.is_spike ? '#f87171' : '#818cf8'} />
            ))}
          </Bar>

          {/* Rolling average line */}
          <Line
            type="monotone"
            dataKey="avg"
            name="7-day avg"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 text-[10px] text-white/30">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-indigo-400" /> Normal HR</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-400" /> Spike</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-amber-400" style={{ borderTop: '1px dashed #f59e0b' }} /> 7-day avg</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-indigo-400/30" style={{ borderTop: '1px dashed rgba(99,102,241,0.4)' }} /> Baseline {RESTING_HR_BASELINE_LOW}–{RESTING_HR_BASELINE_HIGH}</span>
      </div>
    </div>
  )
}
