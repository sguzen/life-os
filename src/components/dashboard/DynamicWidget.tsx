'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'

export interface WidgetConfig {
  chart_type: 'line' | 'bar' | 'scatter'
  metric_keys: string[]
  /** Optional human-readable title shown above the chart */
  title?: string
}

interface DynamicWidgetProps {
  widget_config: WidgetConfig
  /** Array of data objects. Keys must overlap with widget_config.metric_keys. */
  data: Record<string, unknown>[]
}

const LINE_COLORS = ['#818cf8', '#34d399', '#38bdf8', '#fb923c', '#f472b6']

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(0,0,0,0.85)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.8)',
  },
  cursor: { fill: 'rgba(255,255,255,0.04)', stroke: 'rgba(255,255,255,0.1)' },
}

const axisProps = {
  tick: { fontSize: 9, fill: 'rgba(255,255,255,0.3)' },
  axisLine: false as const,
  tickLine: false as const,
}

function TrendLineChart({ data, keys }: { data: Record<string, unknown>[]; keys: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
        <XAxis dataKey="date" {...axisProps} />
        <YAxis {...axisProps} width={28} />
        <Tooltip {...tooltipStyle} />
        {keys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function TrendBarChart({ data, keys }: { data: Record<string, unknown>[]; keys: string[] }) {
  const primaryKey = keys[0]
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" {...axisProps} />
        <YAxis {...axisProps} width={28} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={primaryKey} radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={LINE_COLORS[i % LINE_COLORS.length]} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function TrendScatterChart({ data, keys }: { data: Record<string, unknown>[]; keys: string[] }) {
  const [xKey, yKey] = [keys[0], keys[1] ?? keys[0]]
  // Reshape for Recharts Scatter: needs {x, y} shaped data
  const shaped = data.map((row) => ({ x: row[xKey], y: row[yKey] }))
  return (
    <ResponsiveContainer width="100%" height={140}>
      <ScatterChart>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name={xKey} {...axisProps} />
        <YAxis type="number" dataKey="y" name={yKey} {...axisProps} width={28} />
        <Tooltip {...tooltipStyle} />
        <Scatter data={shaped} fill={LINE_COLORS[0]} fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export function DynamicWidget({ widget_config, data }: DynamicWidgetProps) {
  const { chart_type, metric_keys, title } = widget_config
  const label = title ?? metric_keys.join(' · ')

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 overflow-hidden w-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-500/20">
        <span className="text-xs font-semibold text-indigo-300 capitalize">
          {chart_type} — {label}
        </span>
      </div>
      <div className="px-2 pt-3 pb-2">
        {chart_type === 'line' && <TrendLineChart data={data} keys={metric_keys} />}
        {chart_type === 'bar'  && <TrendBarChart  data={data} keys={metric_keys} />}
        {chart_type === 'scatter' && <TrendScatterChart data={data} keys={metric_keys} />}
      </div>
    </div>
  )
}
