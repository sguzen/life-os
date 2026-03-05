"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { computeTradeStats, buildDailyPnl } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type { Trade } from "@/lib/types";

interface Props {
  trades: Trade[];
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatMoney(p.value)}
        </p>
      ))}
    </div>
  );
}

export function TradingAnalytics({ trades }: Props) {
  const stats = useMemo(() => computeTradeStats(trades), [trades]);
  const dailyPnl = useMemo(() => buildDailyPnl(trades), [trades]);

  // Per-instrument stats
  const byInstrument = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; pnl: number; count: number }>();
    for (const t of trades) {
      if (t.outcome === "open") continue;
      const cur = map.get(t.instrument) ?? { wins: 0, losses: 0, pnl: 0, count: 0 };
      map.set(t.instrument, {
        wins: cur.wins + (t.outcome === "win" ? 1 : 0),
        losses: cur.losses + (t.outcome === "loss" ? 1 : 0),
        pnl: cur.pnl + (t.net_pnl ?? 0),
        count: cur.count + 1,
      });
    }
    return Array.from(map.entries()).map(([inst, d]) => ({
      instrument: inst,
      ...d,
      winRate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
    }));
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <p className="text-sm">No trades yet — analytics will appear here once you log trades.</p>
      </div>
    );
  }

  const pnlColor = stats.totalNetPnl >= 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Net P&L"
          value={formatMoney(stats.totalNetPnl)}
          sub={`Gross: ${formatMoney(stats.totalGrossPnl)}`}
          color={pnlColor}
        />
        <MetricCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.wins}W / ${stats.losses}L / ${stats.breakEvens}BE`}
          color={stats.winRate >= 50 ? "text-emerald-600" : "text-red-600"}
        />
        <MetricCard
          label="Profit Factor"
          value={isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"}
          sub="Gross wins ÷ gross losses"
          color={stats.profitFactor >= 1 ? "text-emerald-600" : "text-red-600"}
        />
        <MetricCard
          label="Avg Win"
          value={formatMoney(stats.avgWin)}
          color="text-emerald-600"
        />
        <MetricCard
          label="Avg Loss"
          value={formatMoney(stats.avgLoss)}
          color="text-red-600"
        />
        <MetricCard
          label="Total Trades"
          value={String(stats.totalTrades)}
          sub={`Fees: ${formatMoney(stats.totalFees)}`}
        />
      </div>

      {/* Equity curve */}
      {dailyPnl.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyPnl} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={stats.totalNetPnl >= 0 ? "#10b981" : "#ef4444"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={stats.totalNetPnl >= 0 ? "#10b981" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatMoney(v)}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="cumulative_pnl"
                name="Cumulative P&L"
                stroke={stats.totalNetPnl >= 0 ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fill="url(#pnlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily P&L bar chart */}
      {dailyPnl.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Daily P&L</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyPnl} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatMoney(v)}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="net_pnl" name="Daily P&L" radius={[3, 3, 0, 0]}>
                {dailyPnl.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.net_pnl >= 0 ? "#10b981" : "#ef4444"}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-instrument breakdown */}
      {byInstrument.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">By Instrument</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium text-muted-foreground">Instrument</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Trades</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Win Rate</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Net P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byInstrument
                  .sort((a, b) => b.pnl - a.pnl)
                  .map((row) => (
                    <tr key={row.instrument}>
                      <td className="py-2 font-medium">{row.instrument}</td>
                      <td className="py-2 text-right text-muted-foreground">{row.count}</td>
                      <td className="py-2 text-right">
                        <span className={row.winRate >= 50 ? "text-emerald-600" : "text-red-600"}>
                          {row.winRate}%
                        </span>
                      </td>
                      <td className={cn(
                        "py-2 text-right font-medium tabular-nums",
                        row.pnl >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {formatMoney(row.pnl)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Best / Worst trades */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2 text-emerald-600">Best Trade</h3>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">
            {formatMoney(stats.largestWin)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2 text-red-600">Worst Trade</h3>
          <p className="text-2xl font-bold tabular-nums text-red-600">
            {formatMoney(stats.largestLoss)}
          </p>
        </div>
      </div>
    </div>
  );
}
