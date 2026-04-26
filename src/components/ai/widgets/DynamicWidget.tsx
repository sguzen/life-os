'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts'
import { Pin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export interface DynamicWidgetProps {
  config: {
    chartType: 'line' | 'bar'
    metricKeys: string[]
  }
  /** Recharts-ready array: each object has a 'date' key + one key per metricKey */
  data: Record<string, unknown>[]
  explanation: string
}

const LINE_COLORS = ['#818cf8', '#34d399', '#38bdf8', '#fb923c', '#f472b6']

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(0,0,0,0.85)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.8)',
  },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

const axisProps = {
  tick: { fontSize: 9, fill: 'rgba(255,255,255,0.3)' },
  axisLine: false as const,
  tickLine: false as const,
}

export function DynamicWidget({ config, data, explanation }: DynamicWidgetProps) {
  const { chartType, metricKeys } = config
  const [pinState, setPinState] = useState<'idle' | 'pinning' | 'pinned' | 'error'>('idle')

  const handlePin = async () => {
    setPinState('pinning')
    try {
      const res = await fetch('/api/dashboard/pin-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_config: {
            chart_type: chartType,
            metric_keys: metricKeys,
            title: metricKeys.join(' · '),
          },
        }),
      })
      setPinState(res.ok ? 'pinned' : 'error')
    } catch {
      setPinState('error')
    }
  }

  return (
    <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 overflow-hidden w-full">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-indigo-500/20 bg-indigo-500/10">
        <span className="text-xs font-semibold text-indigo-300 capitalize truncate">
          {chartType} — {metricKeys.join(' · ')}
        </span>

        {pinState === 'pinned' ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 shrink-0">
            <CheckCircle className="h-3 w-3" />
            Pinned
          </span>
        ) : pinState === 'error' ? (
          <span className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        ) : (
          <button
            onClick={handlePin}
            disabled={pinState === 'pinning'}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-40 shrink-0"
          >
            {pinState === 'pinning' ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Pin className="h-2.5 w-2.5" />
            )}
            📌 Pin
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pt-4 pb-2">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-xs text-white/30">
            No data available for the selected period
          </div>
        ) : chartType === 'line' ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} width={28} />
              <Tooltip {...tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', paddingTop: '8px' }}
              />
              {metricKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} barCategoryGap="25%">
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} width={28} />
              <Tooltip {...tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', paddingTop: '8px' }}
              />
              {metricKeys.map((key, i) => (
                <Bar key={key} dataKey={key} radius={[3, 3, 0, 0]}>
                  {data.map((_, j) => (
                    <Cell
                      key={j}
                      fill={LINE_COLORS[i % LINE_COLORS.length]}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Explanation */}
      {explanation && (
        <p className="px-4 pb-3 text-[11px] text-white/40 leading-relaxed border-t border-white/5 pt-2.5 mt-1">
          {explanation}
        </p>
      )}
    </div>
  )
}
