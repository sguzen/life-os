'use client'

import {
  Dumbbell,
  Salad,
  Briefcase,
  Puzzle,
  Sunrise,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'

export interface MetricsDashboardProps {
  category: string
  summaryText: string
  dataPoints: Array<{ label: string; value: string | number }>
}

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  training: { icon: Dumbbell,  color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  nutrition: { icon: Salad,    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  work:      { icon: Briefcase, color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20' },
  hobby:     { icon: Puzzle,   color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  morning:   { icon: Sunrise,  color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
}

const DEFAULT_META = { icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' }

const BAR_COLORS = ['#818cf8', '#34d399', '#38bdf8', '#fb923c', '#f472b6']

// Determine if a numeric value looks like it improved (positive), declined (negative),
// or is neutral (non-numeric / exactly 0).
function trendIcon(value: string | number) {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(n) || n === 0) return <Minus className="h-3 w-3 text-white/30" />
  if (n > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />
  return <TrendingDown className="h-3 w-3 text-red-400" />
}

// Only include data points that have a numeric value for the chart
function numericPoints(dataPoints: MetricsDashboardProps['dataPoints']) {
  return dataPoints
    .map((d) => ({ ...d, num: typeof d.value === 'number' ? d.value : parseFloat(String(d.value)) }))
    .filter((d) => !isNaN(d.num))
}

export function MetricsDashboard({ category, summaryText, dataPoints }: MetricsDashboardProps) {
  const meta = CATEGORY_META[category.toLowerCase()] ?? DEFAULT_META
  const Icon = meta.icon
  const chartData = numericPoints(dataPoints)
  const showChart = chartData.length >= 2

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden w-full`}>
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${meta.border}`}>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.bg} border ${meta.border}`}>
          <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
        </div>
        <div>
          <p className={`text-xs font-semibold capitalize ${meta.color}`}>{category} Dashboard</p>
          <p className="text-[10px] text-white/35 leading-tight mt-0.5 line-clamp-2">{summaryText}</p>
        </div>
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/5">
        {dataPoints.map((dp, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-black/20">
            <span className="text-xs text-white/50 truncate pr-2">{dp.label}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm font-semibold text-white tabular-nums">{dp.value}</span>
              {trendIcon(dp.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart — only if 2+ numeric points */}
      {showChart && (
        <div className="px-3 pt-3 pb-2">
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.8)',
                }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="num" radius={[3, 3, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
