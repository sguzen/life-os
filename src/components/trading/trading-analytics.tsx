"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Trade } from "@/lib/types";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type TimeFilter = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

interface ExtendedStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEvens: number;
  daysTraded: number;
  winRate: number; // 0-100
  totalNetPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  expectancy: number;
  avgRR: number;
  payoffRatio: number;
  sqn: number;
  bestDay: number;
  worstDay: number;
  maxConsecLosses: number;
  tradeStreak: number; // positive = winning, negative = losing
  dayStreak: number;   // positive = green days, negative = red days
  maxWinStreak: number;
  maxLossStreak: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number; // stored as positive dollar amount
  recoveryFactor: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stats computation
// ──────────────────────────────────────────────────────────────────────────────

function computeExtendedStats(trades: Trade[]): ExtendedStats {
  const closed = trades.filter((t) => t.outcome !== "open");
  const wins = closed.filter((t) => t.outcome === "win");
  const losses = closed.filter((t) => t.outcome === "loss");
  const breakEvens = closed.filter((t) => t.outcome === "break_even");

  const totalNetPnl = closed.reduce((s, t) => s + (t.net_pnl ?? 0), 0);

  const winPnls = wins.map((t) => t.net_pnl ?? 0);
  const lossPnls = losses.map((t) => t.net_pnl ?? 0);

  const avgWin = wins.length ? winPnls.reduce((s, v) => s + v, 0) / wins.length : 0;
  const avgLoss = losses.length ? lossPnls.reduce((s, v) => s + v, 0) / losses.length : 0;

  const grossWins = wins.reduce((s, t) => s + (t.gross_pnl ?? 0), 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + (t.gross_pnl ?? 0), 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

  const winRate = closed.length > 0 ? wins.length / closed.length : 0;
  const lossRate = 1 - winRate;

  // Expectancy = (WR × AvgWin) + (LR × AvgLoss), AvgLoss is negative
  const expectancy = winRate * avgWin + lossRate * avgLoss;

  // Payoff / Avg R:R
  const payoffRatio = avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0;
  const avgRR = payoffRatio;

  // SQN = (Expectancy / StdDev) × √N
  const allPnls = closed.map((t) => t.net_pnl ?? 0);
  const mean = allPnls.length ? allPnls.reduce((s, v) => s + v, 0) / allPnls.length : 0;
  const variance = allPnls.length
    ? allPnls.reduce((s, v) => s + (v - mean) ** 2, 0) / allPnls.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sqn = stdDev > 0 ? (expectancy / stdDev) * Math.sqrt(closed.length) : 0;

  // Days traded
  const tradeDates = new Set(closed.map((t) => (t.exit_time ?? t.entry_time).slice(0, 10)));
  const daysTraded = tradeDates.size;

  // Daily P&L aggregation
  const dailyMap = new Map<string, number>();
  for (const t of closed) {
    const date = (t.exit_time ?? t.entry_time).slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + (t.net_pnl ?? 0));
  }
  const dailyValues = Array.from(dailyMap.values());

  const bestDay = dailyValues.length ? Math.max(...dailyValues) : 0;
  const worstDay = dailyValues.length ? Math.min(...dailyValues) : 0;

  // Sort trades by exit time for streak calculations
  const sorted = [...closed].sort((a, b) =>
    (a.exit_time ?? a.entry_time).localeCompare(b.exit_time ?? b.entry_time)
  );

  let maxWinStreak = 0, curWin = 0;
  let maxLossStreak = 0, curLoss = 0;
  let maxConsecLosses = 0;

  for (const t of sorted) {
    if (t.outcome === "win") {
      curWin++;
      maxWinStreak = Math.max(maxWinStreak, curWin);
      curLoss = 0;
    } else if (t.outcome === "loss") {
      curLoss++;
      maxLossStreak = Math.max(maxLossStreak, curLoss);
      maxConsecLosses = Math.max(maxConsecLosses, curLoss);
      curWin = 0;
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }

  // Current trade streak (scan backwards)
  let tradeStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const outcome = sorted[i].outcome;
    if (tradeStreak === 0) {
      if (outcome === "win") tradeStreak = 1;
      else if (outcome === "loss") tradeStreak = -1;
    } else if (tradeStreak > 0 && outcome === "win") {
      tradeStreak++;
    } else if (tradeStreak < 0 && outcome === "loss") {
      tradeStreak--;
    } else {
      break;
    }
  }

  // Current day streak (scan backwards)
  const sortedDays = Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  let dayStreak = 0;
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    const pnl = sortedDays[i][1];
    if (dayStreak === 0) {
      if (pnl > 0) dayStreak = 1;
      else if (pnl < 0) dayStreak = -1;
    } else if (dayStreak > 0 && pnl > 0) {
      dayStreak++;
    } else if (dayStreak < 0 && pnl < 0) {
      dayStreak--;
    } else {
      break;
    }
  }

  // Sharpe ratio (annualised, based on daily P&L distribution)
  const dailyMean = dailyValues.length
    ? dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length
    : 0;
  const dailyVar = dailyValues.length
    ? dailyValues.reduce((s, v) => s + (v - dailyMean) ** 2, 0) / dailyValues.length
    : 0;
  const dailyStd = Math.sqrt(dailyVar);
  const sharpeRatio = dailyStd > 0 ? (dailyMean / dailyStd) * Math.sqrt(252) : 0;

  // Sortino ratio (only downside deviation)
  const downsidePnls = dailyValues.filter((v) => v < 0);
  const downVar = downsidePnls.length
    ? downsidePnls.reduce((s, v) => s + v ** 2, 0) / downsidePnls.length
    : 0;
  const downStd = Math.sqrt(downVar);
  const sortinoRatio = downStd > 0 ? (dailyMean / downStd) * Math.sqrt(252) : 0;

  // Max drawdown (peak-to-trough on cumulative equity)
  let peak = 0;
  let maxDrawdown = 0;
  let running = 0;
  for (const [, pnl] of sortedDays) {
    running += pnl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const recoveryFactor = maxDrawdown > 0 ? totalNetPnl / maxDrawdown : 0;

  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakEvens: breakEvens.length,
    daysTraded,
    winRate: winRate * 100,
    totalNetPnl,
    avgWin,
    avgLoss,
    profitFactor,
    largestWin: wins.length ? Math.max(...winPnls) : 0,
    largestLoss: losses.length ? Math.min(...lossPnls) : 0,
    expectancy,
    avgRR,
    payoffRatio,
    sqn,
    bestDay,
    worstDay,
    maxConsecLosses,
    tradeStreak,
    dayStreak,
    maxWinStreak,
    maxLossStreak,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    recoveryFactor,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function getFilterCutoff(filter: TimeFilter): string | null {
  if (filter === "ALL") return null;
  const d = new Date();
  if (filter === "1W") d.setDate(d.getDate() - 7);
  else if (filter === "1M") d.setMonth(d.getMonth() - 1);
  else if (filter === "3M") d.setMonth(d.getMonth() - 3);
  else if (filter === "6M") d.setMonth(d.getMonth() - 6);
  else if (filter === "1Y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function fmt$(n: number): string {
  const abs = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  return n < 0 ? `-${abs}` : abs;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function HeroMetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-[#0d0d0d] rounded-lg border border-white/[0.07] p-3 space-y-0.5">
      <p className="text-white/40 text-[11px] uppercase tracking-wider">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums leading-tight", color ?? "text-white")}>
        {value}
      </p>
    </div>
  );
}

function StatsRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-white/50 text-xs">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", color ?? "text-white/80")}>
        {value}
      </span>
    </div>
  );
}

function StreakCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const color =
    value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-white/30";
  const sub =
    value > 0 ? "winning" : value < 0 ? "losing" : "neutral";
  const display =
    value === 0
      ? "—"
      : value > 0
      ? `+${value}`
      : `${value}`;

  return (
    <div className="bg-[#111] rounded-lg border border-white/[0.07] p-3 space-y-0.5">
      <p className="text-white/40 text-[11px] uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", color)}>{display}</p>
      <p className="text-white/20 text-[11px]">{sub}</p>
    </div>
  );
}

function BottomMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-[#111] rounded-lg border border-white/[0.07] p-3 space-y-0.5">
      <p className="text-white/40 text-[11px] uppercase tracking-wider">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", color ?? "text-white/80")}>{value}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

const TIME_FILTERS: TimeFilter[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];

interface Props {
  trades: Trade[];
}

export function TradingAnalytics({ trades }: Props) {
  const [filter, setFilter] = useState<TimeFilter>("ALL");
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filteredTrades = useMemo(() => {
    if (showCustom) {
      return trades.filter((t) => {
        const d = (t.exit_time ?? t.entry_time).slice(0, 10);
        if (customFrom && d < customFrom) return false;
        if (customTo && d > customTo) return false;
        return true;
      });
    }
    const cutoff = getFilterCutoff(filter);
    if (!cutoff) return trades;
    return trades.filter((t) => (t.exit_time ?? t.entry_time).slice(0, 10) >= cutoff);
  }, [trades, filter, showCustom, customFrom, customTo]);

  const s = useMemo(() => computeExtendedStats(filteredTrades), [filteredTrades]);

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-[#0a0a0a] p-8 text-center">
        <p className="text-sm text-white/40">
          No trades yet — analytics will appear once you log trades.
        </p>
      </div>
    );
  }

  const pnlColor = s.totalNetPnl >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="rounded-xl bg-[#0a0a0a] border border-white/10 p-4 space-y-3 font-mono">
      {/* ── HEADER ROW ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white font-semibold tabular-nums">{s.totalTrades}</span>
          <span className="text-white/40">trades</span>
          <span className="text-white/20">·</span>
          <span className="text-white font-semibold tabular-nums">{s.daysTraded}</span>
          <span className="text-white/40">days</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {TIME_FILTERS.map((tf) => (
            <button
              key={tf}
              onClick={() => { setFilter(tf); setShowCustom(false); }}
              className={cn(
                "px-2 py-0.5 text-xs rounded font-medium transition-colors border",
                !showCustom && filter === tf
                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                  : "text-white/40 border-transparent hover:text-white/70 hover:border-white/10"
              )}
            >
              {tf}
            </button>
          ))}
          <button
            onClick={() => setShowCustom((v) => !v)}
            className={cn(
              "px-2 py-0.5 text-xs rounded font-medium transition-colors border",
              showCustom
                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                : "text-white/40 border-transparent hover:text-white/70 hover:border-white/10"
            )}
          >
            CUSTOM
          </button>
        </div>
      </div>

      {/* Custom date inputs */}
      {showCustom && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-white/40">From</span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-[#111] border border-white/10 rounded px-2 py-1 text-white/70 text-xs"
          />
          <span className="text-white/40">To</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="bg-[#111] border border-white/10 rounded px-2 py-1 text-white/70 text-xs"
          />
        </div>
      )}

      {/* ── HERO SECTION ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Left: P&L hero block */}
        <div className="flex-1 bg-[#111] rounded-lg border border-white/[0.07] p-4 flex flex-col justify-between gap-3">
          <div>
            <p className="text-white/40 text-[11px] uppercase tracking-wider mb-1">Net P&L</p>
            <p className={cn("text-5xl font-extrabold tabular-nums leading-none", pnlColor)}>
              {fmt$(s.totalNetPnl)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-white/40">{s.totalTrades} trades</span>
            <span className="text-white/20">·</span>
            <span className="text-white/40">{s.daysTraded} days</span>
            <span className="text-white/20">·</span>
            <span className="text-emerald-400 font-semibold">{s.wins}W</span>
            <span className="text-red-400 font-semibold">{s.losses}L</span>
            {s.breakEvens > 0 && (
              <span className="text-white/30 font-semibold">{s.breakEvens}BE</span>
            )}
          </div>
        </div>

        {/* Right: 4 hero metrics */}
        <div className="grid grid-cols-2 gap-2 sm:w-60">
          <HeroMetricCard
            label="Win Rate"
            value={`${s.winRate.toFixed(1)}%`}
            color={s.winRate >= 50 ? "text-emerald-400" : "text-red-400"}
          />
          <HeroMetricCard
            label="Profit Factor"
            value={isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞"}
            color={s.profitFactor >= 1 ? "text-emerald-400" : "text-red-400"}
          />
          <HeroMetricCard
            label="Expectancy"
            value={fmt$(s.expectancy)}
            color={s.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <HeroMetricCard
            label="Avg R:R"
            value={s.avgRR.toFixed(2)}
            color="text-cyan-400"
          />
        </div>
      </div>

      {/* ── STATS GRID 2-col ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Left */}
        <div className="bg-[#111] rounded-lg border border-white/[0.07] divide-y divide-white/[0.06]">
          <StatsRow label="Avg Win" value={fmt$(s.avgWin)} color="text-emerald-400" />
          <StatsRow label="Avg Loss" value={fmt$(s.avgLoss)} color="text-red-400" />
          <StatsRow
            label="Payoff Ratio"
            value={s.payoffRatio.toFixed(2)}
            color={s.payoffRatio >= 1 ? "text-emerald-400" : "text-white/60"}
          />
          <StatsRow
            label="SQN"
            value={s.sqn.toFixed(2)}
            color={
              s.sqn >= 1.6
                ? "text-emerald-400"
                : s.sqn >= 0
                ? "text-cyan-400"
                : "text-red-400"
            }
          />
        </div>
        {/* Right */}
        <div className="bg-[#111] rounded-lg border border-white/[0.07] divide-y divide-white/[0.06]">
          <StatsRow label="Best Day" value={fmt$(s.bestDay)} color="text-emerald-400" />
          <StatsRow label="Worst Day" value={fmt$(s.worstDay)} color="text-red-400" />
          <StatsRow label="Days Traded" value={String(s.daysTraded)} color="text-cyan-400" />
          <StatsRow
            label="Max Consec. Losses"
            value={String(s.maxConsecLosses)}
            color="text-red-400"
          />
        </div>
      </div>

      {/* ── STREAK CARDS 4-col ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StreakCard label="Trade Streak" value={s.tradeStreak} />
        <StreakCard label="Day Streak" value={s.dayStreak} />
        <div className="bg-[#111] rounded-lg border border-white/[0.07] p-3 space-y-0.5">
          <p className="text-white/40 text-[11px] uppercase tracking-wider">Max Win Streak</p>
          <p className="text-emerald-400 text-2xl font-bold tabular-nums">{s.maxWinStreak}</p>
          <p className="text-white/20 text-[11px]">trades</p>
        </div>
        <div className="bg-[#111] rounded-lg border border-white/[0.07] p-3 space-y-0.5">
          <p className="text-white/40 text-[11px] uppercase tracking-wider">Max Loss Streak</p>
          <p className="text-red-400 text-2xl font-bold tabular-nums">{s.maxLossStreak}</p>
          <p className="text-white/20 text-[11px]">trades</p>
        </div>
      </div>

      {/* ── BOTTOM ROW ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <BottomMetric
          label="Sharpe Ratio"
          value={s.sharpeRatio.toFixed(2)}
          color={
            s.sharpeRatio >= 1
              ? "text-emerald-400"
              : s.sharpeRatio >= 0
              ? "text-cyan-400"
              : "text-red-400"
          }
        />
        <BottomMetric
          label="Sortino"
          value={s.sortinoRatio.toFixed(2)}
          color={
            s.sortinoRatio >= 1
              ? "text-emerald-400"
              : s.sortinoRatio >= 0
              ? "text-cyan-400"
              : "text-red-400"
          }
        />
        <BottomMetric
          label="Max Drawdown"
          value={s.maxDrawdown > 0 ? `-${fmt$(s.maxDrawdown)}` : "$0"}
          color="text-red-400"
        />
        <BottomMetric
          label="Recovery Factor"
          value={s.recoveryFactor.toFixed(2)}
          color={s.recoveryFactor >= 1 ? "text-emerald-400" : "text-white/60"}
        />
      </div>
    </div>
  );
}
