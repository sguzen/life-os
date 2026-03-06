'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'
import type { BodyMeasurement } from '@/lib/types/nutrition'

// Starting point (from dietician assessment)
const STARTING_WEIGHT = 67.7
const STARTING_BF = 24.5
const TARGET_WEIGHT = 62.0
const TARGET_BF = 19.9
const STARTING_MUSCLE = 48.5
const ALERT_MUSCLE_THRESHOLD = 48.0

interface BodyCompositionChartProps {
  measurements: BodyMeasurement[]
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function BodyCompositionChart({ measurements }: BodyCompositionChartProps) {
  const latest = measurements[measurements.length - 1]
  const latestMuscleMass = latest?.muscle_mass_kg
  const muscleLow = latestMuscleMass !== null && latestMuscleMass !== undefined && latestMuscleMass < ALERT_MUSCLE_THRESHOLD

  // Build chart data — always include start point
  const chartData = [
    {
      date: 'Dec 11',
      weight: STARTING_WEIGHT,
      bf: STARTING_BF,
      label: 'Start',
    },
    ...measurements.map((m) => ({
      date: fmtDate(m.measured_at),
      weight: m.weight_kg,
      bf: m.body_fat_pct,
    })),
  ]

  // Progress summary
  const currentWeight = latest?.weight_kg ?? STARTING_WEIGHT
  const currentBf = latest?.body_fat_pct ?? STARTING_BF
  const weightToGo = currentWeight - TARGET_WEIGHT
  const bfToGo = currentBf - TARGET_BF
  const fatLost = STARTING_WEIGHT * (STARTING_BF / 100) - currentWeight * (currentBf / 100)

  // Estimate arrival (simple linear extrapolation from last 2 data points)
  let estArrival = ''
  if (measurements.length >= 2) {
    const a = measurements[measurements.length - 2]
    const b = measurements[measurements.length - 1]
    if (a.weight_kg && b.weight_kg && a.measured_at && b.measured_at) {
      const daysDiff =
        (new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()) / 86400000
      const ratePerDay = (a.weight_kg - b.weight_kg) / daysDiff
      if (ratePerDay > 0) {
        const daysToTarget = weightToGo / ratePerDay
        const arrival = new Date()
        arrival.setDate(arrival.getDate() + daysToTarget)
        estArrival = arrival.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Muscle mass alert */}
      {muscleLow && (
        <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-4 py-3 flex items-center gap-2">
          <span className="text-red-400 text-lg">⚠️</span>
          <p className="text-sm text-red-300 font-medium">
            Muscle mass {latestMuscleMass?.toFixed(1)}kg — below {ALERT_MUSCLE_THRESHOLD}kg threshold. Check nutrition and protein intake immediately.
          </p>
        </div>
      )}

      {/* Progress summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox
          label="Weight"
          value={`${currentWeight.toFixed(1)}kg`}
          sub={`${weightToGo > 0 ? weightToGo.toFixed(1) + 'kg to go' : 'Target reached!'}`}
          target={`→ ${TARGET_WEIGHT}kg`}
          color={weightToGo <= 1 ? 'text-emerald-400' : 'text-white/70'}
        />
        <StatBox
          label="Body fat"
          value={`${currentBf.toFixed(1)}%`}
          sub={`${bfToGo > 0 ? bfToGo.toFixed(1) + '% to go' : 'Target reached!'}`}
          target={`→ ${TARGET_BF}%`}
          color={bfToGo <= 1 ? 'text-emerald-400' : 'text-white/70'}
        />
        <StatBox
          label="Fat lost"
          value={`${fatLost > 0 ? fatLost.toFixed(1) + 'kg' : '0kg'}`}
          sub="of 3.2kg needed"
          color="text-blue-400"
        />
        <StatBox
          label="Est. target"
          value={estArrival || '—'}
          sub={measurements.length < 2 ? 'need 2+ measurements' : 'at current rate'}
          color="text-violet-400"
        />
      </div>

      {/* Chart */}
      {chartData.length >= 2 ? (
        <div className="rounded-xl border border-white/10 bg-white/3 p-4">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="weight"
                domain={[58, 70]}
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <YAxis
                yAxisId="bf"
                orientation="right"
                domain={[16, 27]}
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(10,10,10,0.9)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: 12,
                  color: '#fff',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}
              />

              {/* Target reference lines */}
              <ReferenceLine
                yAxisId="weight"
                y={TARGET_WEIGHT}
                stroke="#22c55e"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: '62kg target', position: 'insideTopRight', fill: '#22c55e', fontSize: 10 }}
              />
              <ReferenceLine
                yAxisId="bf"
                y={TARGET_BF}
                stroke="#6366f1"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />

              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="weight"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ fill: '#60a5fa', r: 4 }}
                name="Weight (kg)"
                connectNulls
              />
              <Line
                yAxisId="bf"
                type="monotone"
                dataKey="bf"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={{ fill: '#a78bfa', r: 4 }}
                name="Body fat (%)"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/3 p-8 text-center">
          <p className="text-sm text-white/30">
            Log measurements to see progress chart
          </p>
        </div>
      )}
    </div>
  )
}

function StatBox({
  label,
  value,
  sub,
  target,
  color,
}: {
  label: string
  value: string
  sub: string
  target?: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-white/35 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {target && <p className="text-xs text-white/25 mt-0.5">{target}</p>}
      <p className="text-xs text-white/30 mt-0.5">{sub}</p>
    </div>
  )
}
