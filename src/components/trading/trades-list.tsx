"use client";

import { useState, useMemo } from "react";
import { Plus, SlidersHorizontal, TrendingUp, TrendingDown } from "lucide-react";
import { TradeForm } from "./trade-form";
import { INSTRUMENTS } from "@/lib/validations/trading";
import { cn } from "@/lib/utils";
import type { Trade, PropAccount, Strategy, Instrument, TradeOutcome } from "@/lib/types";

interface Props {
  trades: Trade[];
  propAccounts: PropAccount[];
  strategies: Strategy[];
  onTradesChange: (trades: Trade[]) => void;
  onSelectTrade: (trade: Trade) => void;
}

interface Filters {
  instrument: Instrument | "";
  outcome: TradeOutcome | "";
  prop_account_id: string;
  strategy_id: string;
  from: string;
  to: string;
  search: string;
}

function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OutcomeChip({ outcome }: { outcome: Trade["outcome"] }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    win: { cls: "bg-emerald-500/15 text-emerald-600", label: "Win" },
    loss: { cls: "bg-red-500/15 text-red-600", label: "Loss" },
    break_even: { cls: "bg-amber-500/15 text-amber-600", label: "B/E" },
    open: { cls: "bg-blue-500/15 text-blue-600", label: "Open" },
  };
  const { cls, label } = cfg[outcome] ?? cfg.open;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cls)}>{label}</span>
  );
}

export function TradesList({ trades, propAccounts, strategies, onTradesChange, onSelectTrade }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    instrument: "",
    outcome: "",
    prop_account_id: "",
    strategy_id: "",
    from: "",
    to: "",
    search: "",
  });

  function handleSaved(saved: Trade) {
    if (trades.find((t) => t.id === saved.id)) {
      onTradesChange(trades.map((t) => (t.id === saved.id ? saved : t)));
    } else {
      onTradesChange([saved, ...trades]);
    }
  }

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (filters.instrument && t.instrument !== filters.instrument) return false;
      if (filters.outcome && t.outcome !== filters.outcome) return false;
      if (filters.prop_account_id && t.prop_account_id !== filters.prop_account_id) return false;
      if (filters.strategy_id && t.strategy_id !== filters.strategy_id) return false;
      if (filters.from && t.entry_time < filters.from) return false;
      if (filters.to && t.entry_time > filters.to + "T23:59:59") return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = [
          t.instrument,
          t.direction,
          ...(t.setup_tags ?? []),
          t.entry_notes ?? "",
          t.exit_notes ?? "",
          t.strategies?.name ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trades, filters]);

  const selectCls = "rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold">
          Trade Log
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {filtered.length} / {trades.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              showFilters ? "bg-accent" : "hover:bg-accent"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Trade
          </button>
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <select
              value={filters.instrument}
              onChange={(e) => setFilters({ ...filters, instrument: e.target.value as Instrument | "" })}
              className={selectCls}
            >
              <option value="">All Instruments</option>
              {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>

            <select
              value={filters.outcome}
              onChange={(e) => setFilters({ ...filters, outcome: e.target.value as TradeOutcome | "" })}
              className={selectCls}
            >
              <option value="">All Outcomes</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="break_even">Break Even</option>
              <option value="open">Open</option>
            </select>

            <select
              value={filters.prop_account_id}
              onChange={(e) => setFilters({ ...filters, prop_account_id: e.target.value })}
              className={selectCls}
            >
              <option value="">All Accounts</option>
              {propAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_label}</option>
              ))}
            </select>

            <select
              value={filters.strategy_id}
              onChange={(e) => setFilters({ ...filters, strategy_id: e.target.value })}
              className={selectCls}
            >
              <option value="">All Strategies</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className={selectCls}
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className={selectCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search notes, tags, strategies…"
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => setFilters({ instrument: "", outcome: "", prop_account_id: "", strategy_id: "", from: "", to: "", search: "" })}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table / list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <p className="text-sm">{trades.length === 0 ? "No trades logged yet." : "No trades match your filters."}</p>
          {trades.length === 0 && (
            <p className="text-xs mt-1">Click &ldquo;Log Trade&rdquo; to record your first trade.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date/Time</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Instrument</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Dir</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Entry</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Exit</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Net P&L</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Outcome</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Strategy</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((trade) => (
                  <tr
                    key={trade.id}
                    onClick={() => onSelectTrade(trade)}
                    className="hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(trade.entry_time)}
                    </td>
                    <td className="px-4 py-3 font-medium">{trade.instrument}</td>
                    <td className="px-4 py-3">
                      {trade.direction === "long" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{trade.entry_price}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {trade.exit_price ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{trade.contracts}</td>
                    <td className={cn(
                      "px-4 py-3 text-right font-medium tabular-nums",
                      (trade.net_pnl ?? 0) > 0 && "text-emerald-600",
                      (trade.net_pnl ?? 0) < 0 && "text-red-600"
                    )}>
                      {formatMoney(trade.net_pnl)}
                    </td>
                    <td className="px-4 py-3">
                      <OutcomeChip outcome={trade.outcome} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {trade.strategies?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[120px]">
                        {(trade.setup_tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded bg-accent px-1.5 py-0.5 text-xs">{tag}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y">
            {filtered.map((trade) => (
              <button
                key={trade.id}
                onClick={() => onSelectTrade(trade)}
                className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{trade.instrument}</span>
                      {trade.direction === "long" ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <OutcomeChip outcome={trade.outcome} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(trade.entry_time)}
                      {trade.strategies?.name && ` · ${trade.strategies.name}`}
                    </p>
                  </div>
                  <p className={cn(
                    "font-semibold tabular-nums shrink-0",
                    (trade.net_pnl ?? 0) > 0 && "text-emerald-600",
                    (trade.net_pnl ?? 0) < 0 && "text-red-600"
                  )}>
                    {formatMoney(trade.net_pnl)}
                  </p>
                </div>
                {(trade.setup_tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(trade.setup_tags ?? []).slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded bg-accent px-1.5 py-0.5 text-xs">{tag}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <TradeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        propAccounts={propAccounts}
        strategies={strategies}
      />
    </div>
  );
}
