"use client";

import { useState } from "react";
import { X, Pencil, Trash2, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { TradeForm } from "./trade-form";
import { deleteTrade } from "@/lib/supabase/trading";
import { SESSION_LABELS, PROP_FIRM_LABELS } from "@/lib/validations/trading";
import { cn } from "@/lib/utils";
import type { Trade, PropAccount, Strategy } from "@/lib/types";

interface Props {
  trade: Trade | null;
  propAccounts: PropAccount[];
  strategies: Strategy[];
  onClose: () => void;
  onUpdated: (trade: Trade) => void;
  onDeleted: (id: string) => void;
}

function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className={cn("text-sm flex-1", className)}>{value}</span>
    </div>
  );
}

export function TradeDetail({ trade, propAccounts, strategies, onClose, onUpdated, onDeleted }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!trade) return null;

  async function handleDelete() {
    if (!confirm("Delete this trade? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteTrade(trade!.id);
      onDeleted(trade!.id);
    } finally {
      setDeleting(false);
    }
  }

  const outcomeColors: Record<string, string> = {
    win: "text-emerald-600",
    loss: "text-red-600",
    break_even: "text-amber-600",
    open: "text-blue-600",
  };

  const outcomeLabels: Record<string, string> = {
    win: "Win", loss: "Loss", break_even: "Break Even", open: "Open",
  };

  return (
    <>
      {/* Slide-in sheet */}
      <div className="fixed inset-0 z-40 flex justify-end">
        {/* Backdrop */}
        <button
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close"
        />
        {/* Panel */}
        <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-card shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b px-6 py-4 sticky top-0 bg-card z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-semibold">{trade.instrument}</span>
                {trade.direction === "long" ? (
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <span className={cn("text-sm font-medium", outcomeColors[trade.outcome])}>
                {outcomeLabels[trade.outcome]}
              </span>
              {trade.is_reviewed && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Reviewed" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditOpen(true)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                title="Edit trade"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                title="Delete trade"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* P&L highlight */}
            <div className={cn(
              "rounded-xl p-4 text-center",
              (trade.net_pnl ?? 0) > 0 ? "bg-emerald-500/10" :
              (trade.net_pnl ?? 0) < 0 ? "bg-red-500/10" : "bg-muted"
            )}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Net P&L</p>
              <p className={cn(
                "text-3xl font-bold tabular-nums",
                (trade.net_pnl ?? 0) > 0 ? "text-emerald-600" :
                (trade.net_pnl ?? 0) < 0 ? "text-red-600" : "text-foreground"
              )}>
                {formatMoney(trade.net_pnl)}
              </p>
              {trade.fees > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Gross: {formatMoney(trade.gross_pnl)} · Fees: {formatMoney(trade.fees)}
                </p>
              )}
            </div>

            {/* Execution details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Execution
              </h3>
              <div className="rounded-lg border bg-muted/20 px-4">
                <Row label="Entry Time" value={formatDateTime(trade.entry_time)} />
                <Row label="Exit Time" value={formatDateTime(trade.exit_time)} />
                <Row label="Entry Price" value={<span className="font-mono">{trade.entry_price}</span>} />
                <Row label="Exit Price" value={<span className="font-mono">{trade.exit_price ?? "—"}</span>} />
                <Row label="Contracts" value={trade.contracts} />
                {trade.session && (
                  <Row label="Session" value={SESSION_LABELS[trade.session] ?? trade.session} />
                )}
                {trade.prop_accounts && (
                  <Row
                    label="Account"
                    value={`${PROP_FIRM_LABELS[trade.prop_accounts.firm]} · ${trade.prop_accounts.account_label}`}
                  />
                )}
                {trade.strategies && (
                  <Row label="Strategy" value={trade.strategies.name} />
                )}
              </div>
            </div>

            {/* Setup Tags */}
            {(trade.setup_tags ?? []).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Setup Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(trade.setup_tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-accent px-3 py-0.5 text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes sections */}
            {[
              { label: "Confluence Notes", value: trade.confluence_notes },
              { label: "Entry Notes", value: trade.entry_notes },
              { label: "Exit Notes", value: trade.exit_notes },
            ].map(({ label, value }) =>
              value ? (
                <div key={label}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {label}
                  </h3>
                  <p className="text-sm leading-relaxed text-foreground/80 rounded-lg border bg-muted/20 px-4 py-3 whitespace-pre-wrap">
                    {value}
                  </p>
                </div>
              ) : null
            )}

            {/* Psychology */}
            {(trade.pre_emotion || trade.post_emotion) && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Psychology
                </h3>
                <div className="rounded-lg border bg-muted/20 px-4">
                  {trade.pre_emotion && <Row label="Pre-Trade" value={trade.pre_emotion} />}
                  {trade.post_emotion && <Row label="Post-Trade" value={trade.post_emotion} />}
                  {trade.followed_rules != null && (
                    <Row
                      label="Followed Rules"
                      value={
                        <span className={trade.followed_rules ? "text-emerald-600" : "text-red-600"}>
                          {trade.followed_rules ? "Yes" : "No"}
                        </span>
                      }
                    />
                  )}
                </div>
              </div>
            )}

            {/* Lessons */}
            {trade.lessons && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Lessons Learned
                </h3>
                <p className="text-sm leading-relaxed text-foreground/80 rounded-lg border bg-muted/20 px-4 py-3 whitespace-pre-wrap">
                  {trade.lessons}
                </p>
              </div>
            )}

            {/* Timestamps */}
            <p className="text-xs text-muted-foreground text-right">
              Logged {new Date(trade.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <TradeForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onUpdated}
        initial={trade}
        propAccounts={propAccounts}
        strategies={strategies}
      />
    </>
  );
}
