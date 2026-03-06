'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Dot,
} from 'recharts'
import { parsePaceToSeconds, formatPace } from '@/lib/marathon/plan'
import type { TrainingSessionRow } from '@/lib/supabase/marathon'

interface PaceDisciplineChartProps {
  sessions: TrainingSessionRow[]
}

export function PaceDisciplineChart({ sessions }: PaceDisciplineChartProps) {
  const data = sessions
    .filter((s) => s.actual_avg_pace && s.planned_pace_min)
    .map((s) => ({
      date: s.session_date.slice(5),  // MM-DD
      actual: parsePaceToSeconds(s.actual_avg_pace!),
      planned: parsePaceToSeconds(s.planned_pace_min!),
      plannedMax: s.planned_pace_max ? parsePaceToSeconds(s.planned_pace_max) : parsePaceToSeconds(s.planned_pace_min!),
      tooFast: s.went_too_fast,
      type: s.planned_type,
    }))
    .reverse()

  if (data.length === 0) {
    return <p className="text-xs text-white/30 py-4 text-center">No sessions with pace data yet.</p>
  }

  const formatTick = (val: number) => formatPace(val)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatTick}
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={42}
          reversed
        />
        <Tooltip
          contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
          labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}
          formatter={(value: number, name: string) => [formatPace(value), name === 'actual' ? 'Actual pace' : 'Planned pace']}
        />
        {/* Planned pace line */}
        <Line
          dataKey="planned"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
          strokeDasharray="4 4"
          dot={false}
          name="planned"
        />
        {/* Actual pace line with colored dots */}
        <Line
          dataKey="actual"
          stroke="#f97316"
          strokeWidth={2}
          dot={(props: { cx: number; cy: number; payload: { tooFast: boolean } }) => {
            const { cx, cy, payload } = props
            return (
              <Dot
                key={`dot-${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r={4}
                fill={payload.tooFast ? '#ef4444' : '#22c55e'}
                stroke="none"
              />
            )
          }}
          activeDot={{ r: 5, fill: '#f97316' }}
          name="actual"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
