"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { importTrades, type TradeImportInput } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type { Instrument, TradeDirection, TradingSession, Trade } from "@/lib/types";

// ── CSV row shape ──────────────────────────────────────────────────────────

interface CsvRow {
  orderId: string;
  "B/S": string;
  Contract: string;
  Product: string;
  avgPrice: string;
  filledQty: string;
  "Fill Time": string;
  Status: string;
  Text: string;
  Type: string;
  [key: string]: string;
}

// ── Instrument & point-value config ───────────────────────────────────────

// Map product symbol → app Instrument label
const PRODUCT_TO_INSTRUMENT: Record<string, Instrument> = {
  MNQ: "NQ",
  NQ:  "NQ",
  MES: "ES",
  ES:  "ES",
  MGC: "Gold",
  GC:  "Gold",
  MCL: "CL",
  CL:  "CL",
  M6E: "6E",
  "6E": "6E",
};

// Point value in $ per 1-point move per contract
// MGC: tick=0.1, tick value=$1 → $10/full point
// M6E: tick=0.0001, tick value=$6.25 → use tick-based calc below
const POINT_VALUE: Record<string, number> = {
  MNQ: 2,
  NQ:  20,
  MES: 5,
  ES:  50,
  MGC: 10,
  GC:  100,
  MCL: 10,
  CL:  1000,
};

// Tick-based overrides: {tickSize, tickValue}
const TICK_BASED: Record<string, { tickSize: number; tickValue: number }> = {
  M6E: { tickSize: 0.0001, tickValue: 6.25 },
  "6E": { tickSize: 0.0001, tickValue: 12.50 },
};

function calcPnl(product: string, priceDiff: number, qty: number): number {
  const p = product.toUpperCase();
  const tick = TICK_BASED[p];
  if (tick) return (priceDiff / tick.tickSize) * tick.tickValue * qty;
  return priceDiff * (POINT_VALUE[p] ?? 1) * qty;
}

function mapInstrument(product: string): Instrument {
  const inst = PRODUCT_TO_INSTRUMENT[product.toUpperCase()];
  if (!inst) throw new Error(`Unknown product: "${product}"`);
  return inst;
}

// ── Time helpers ───────────────────────────────────────────────────────────

// Parse Tradovate Fill Time "M/D/YYYY H:MM:SS" → Date (treated as local/EST)
function parseFillTime(raw: string): Date {
  const t = raw.trim();
  const [datePart, timePart] = t.split(" ");
  const [m, d, y] = datePart.split("/");
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${timePart}`);
}

function fillTimeToISO(raw: string): string {
  const t = raw.trim();
  const [datePart, timePart] = t.split(" ");
  const [m, d, y] = datePart.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${timePart}`;
}

function detectSession(hour: number): TradingSession {
  if (hour >= 2  && hour < 8)  return "london";
  if (hour >= 8  && hour < 12) return "new_york_am";
  if (hour >= 12 && hour < 17) return "new_york_pm";
  return "overnight";
}

// Strip expiry code: MNQH6 → MNQ, MESH25 → MES
function stripExpiry(contract: string): string {
  return contract.trim().replace(/[A-Z]\d{1,2}$/, "");
}

// ── FIFO position tracker ──────────────────────────────────────────────────

interface PositionEntry {
  sign: 1 | -1;   // +1 long, -1 short
  qty: number;
  price: number;
  fillTime: Date;
  fillTimeRaw: string;
}

interface CompletedLeg {
  product: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  entryTime: Date;
  entryTimeRaw: string;
  exitTime: Date;
  exitTimeRaw: string;
}

/**
 * Core FIFO algorithm.
 * Processes rows sorted by Fill Time ascending.
 * Each time an opposing fill closes (part of) an open position,
 * one CompletedLeg is emitted.
 */
function runFifo(rows: CsvRow[]): CompletedLeg[] {
  // 1. Filter: Filled rows with a non-empty avgPrice
  type FillRow = {
    product: string;
    sign: 1 | -1;
    qty: number;
    price: number;
    fillTime: Date;
    fillTimeRaw: string;
  };

  const fills: FillRow[] = [];
  for (const row of rows) {
    const status = row.Status?.trim();
    if (status !== "Filled") continue;

    const avgPrice = parseFloat(row.avgPrice);
    if (!row.avgPrice?.trim() || isNaN(avgPrice) || avgPrice <= 0) continue;

    const qty = parseFloat(row.filledQty);
    if (isNaN(qty) || qty <= 0) continue;

    // Accept Buy/Sell or B/S (Tradovate uses full words)
    const bs = row["B/S"]?.trim().toLowerCase();
    const sign: 1 | -1 = bs.startsWith("s") ? -1 : 1;

    // Use Product column, but fall back to stripped Contract
    const rawProduct = row.Product?.trim() || stripExpiry(row.Contract?.trim() ?? "");
    if (!rawProduct) continue;

    fills.push({
      product: rawProduct,
      sign,
      qty,
      price: avgPrice,
      fillTime: parseFillTime(row["Fill Time"]),
      fillTimeRaw: row["Fill Time"],
    });
  }

  // 2. Sort by fill time ascending
  fills.sort((a, b) => a.fillTime.getTime() - b.fillTime.getTime());

  // 3. FIFO position queue per product
  const positions: Record<string, PositionEntry[]> = {};
  const completed: CompletedLeg[] = [];

  for (const fill of fills) {
    const { product, sign, price, fillTime, fillTimeRaw } = fill;
    let remaining = fill.qty;

    if (!positions[product]) positions[product] = [];
    const queue = positions[product];

    // Try to close existing opposite-side positions from the front (FIFO)
    while (remaining > 0 && queue.length > 0) {
      const top = queue[0];
      if (top.sign === sign) break; // same direction → stop, will add to queue

      const closeQty = Math.min(remaining, top.qty);
      top.qty -= closeQty;
      remaining -= closeQty;

      const direction: TradeDirection = top.sign === 1 ? "long" : "short";
      const priceDiff =
        direction === "long" ? price - top.price : top.price - price;

      completed.push({
        product,
        direction,
        entryPrice: top.price,
        exitPrice: price,
        qty: closeQty,
        entryTime: top.fillTime,
        entryTimeRaw: top.fillTimeRaw,
        exitTime: fillTime,
        exitTimeRaw: fillTimeRaw,
      });

      if (top.qty < 0.0001) queue.shift(); // fully consumed
    }

    // Any remaining quantity opens / adds to a position
    if (remaining > 0.0001) {
      const last = queue[queue.length - 1];
      if (last && last.sign === sign) {
        // Merge into last entry via weighted average
        const merged =
          (last.price * last.qty + price * remaining) / (last.qty + remaining);
        last.price = merged;
        last.qty += remaining;
      } else {
        queue.push({ sign, qty: remaining, price, fillTime, fillTimeRaw });
      }
    }
  }

  return completed;
}

// ── Convert legs → PreviewTrade ───────────────────────────────────────────

interface PreviewTrade {
  instrument: Instrument;
  direction: TradeDirection;
  entry_price: number;
  exit_price: number;
  contracts: number;
  entry_time: string;
  exit_time: string;
  gross_pnl: number;
  session: TradingSession;
}

function legsToPreview(legs: CompletedLeg[]): PreviewTrade[] {
  const trades: PreviewTrade[] = [];
  for (const leg of legs) {
    let instrument: Instrument;
    try {
      instrument = mapInstrument(leg.product);
    } catch {
      continue; // skip unknown products
    }

    const pnl =
      Math.round(calcPnl(leg.product, leg.exitPrice - leg.entryPrice, leg.qty) *
        (leg.direction === "long" ? 1 : -1) * 100) / 100;

    trades.push({
      instrument,
      direction: leg.direction,
      entry_price: Math.round(leg.entryPrice * 100000) / 100000,
      exit_price:  Math.round(leg.exitPrice  * 100000) / 100000,
      contracts:   leg.qty,
      entry_time:  fillTimeToISO(leg.entryTimeRaw),
      exit_time:   fillTimeToISO(leg.exitTimeRaw),
      gross_pnl:   pnl,
      session:     detectSession(leg.entryTime.getHours()),
    });
  }
  trades.sort((a, b) => a.entry_time.localeCompare(b.entry_time));
  return trades;
}

function toImportInput(t: PreviewTrade): TradeImportInput {
  const outcome =
    t.gross_pnl > 0 ? "win" : t.gross_pnl < 0 ? "loss" : "break_even";
  return {
    instrument: t.instrument,
    direction: t.direction,
    entry_price: t.entry_price,
    exit_price: t.exit_price,
    contracts: t.contracts,
    entry_time: t.entry_time,
    exit_time: t.exit_time,
    gross_pnl: t.gross_pnl,
    fees: 0,
    outcome,
    session: t.session,
    prop_account_id: null,
    strategy_id: null,
    setup_tags: null,
    confluence_notes: null,
    entry_notes: null,
    exit_notes: null,
    lessons: null,
    screenshots: null,
    pre_emotion: null,
    post_emotion: null,
    followed_rules: null,
    is_reviewed: false,
  };
}

// ── Formatters ─────────────────────────────────────────────────────────────

function formatMoney(n: number) {
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

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  onImported: (newTrades: Trade[]) => void;
  onClose: () => void;
}

type Step = "idle" | "preview" | "importing" | "done";

export function TradovateImport({ onImported, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep]         = useState<Step>("idle");
  const [preview, setPreview]   = useState<PreviewTrade[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult]     = useState<{ imported: number; skipped: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          const legs    = runFifo(results.data);
          const trades  = legsToPreview(legs);
          if (trades.length === 0) {
            setParseError(
              "No completed trades found. Ensure the CSV has Filled rows where " +
              "both an opening and a closing fill exist for the same product."
            );
            return;
          }
          setPreview(trades);
          setStep("preview");
        } catch (err) {
          setParseError(err instanceof Error ? err.message : "Failed to parse CSV");
        }
      },
      error(err) {
        setParseError(err.message);
      },
    });
    e.target.value = "";
  }

  async function handleConfirm() {
    setStep("importing");
    try {
      const res = await importTrades(preview.map(toImportInput));
      setResult(res);
      setStep("done");
      onImported([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  }

  const totalPnl   = preview.reduce((s, t) => s + t.gross_pnl, 0);
  const wins       = preview.filter((t) => t.gross_pnl > 0).length;
  const losses     = preview.filter((t) => t.gross_pnl < 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto p-4">
      <div className="relative w-full max-w-5xl rounded-xl border bg-card shadow-xl my-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Import Tradovate CSV</h2>
            <p className="text-sm text-muted-foreground">
              Upload an order history CSV exported from Tradovate
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {parseError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* ── Idle ── */}
          {step === "idle" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-full bg-muted p-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">Choose a Tradovate order history CSV</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  All Filled orders are processed. Scale-ins and partial exits are
                  handled via FIFO position tracking.
                </p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Browse CSV file
              </button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {/* ── Preview ── */}
          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found{" "}
                <span className="font-medium text-foreground">{preview.length}</span>{" "}
                completed trade{preview.length !== 1 ? "s" : ""}. Review below, then
                confirm to save.
              </p>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {["Date", "Instrument", "Dir", "Entry", "Exit", "Qty", "P&L", "Session"].map(
                        (h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((t, i) => (
                      <tr
                        key={i}
                        className={cn(
                          "border-b last:border-0",
                          i % 2 === 0 ? "bg-background" : "bg-muted/20"
                        )}
                      >
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(t.entry_time)}
                        </td>
                        <td className="px-3 py-2 font-medium">{t.instrument}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            t.direction === "long"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : "bg-red-500/15 text-red-600"
                          )}>
                            {t.direction === "long" ? "Long" : "Short"}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {t.entry_price.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {t.exit_price.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{t.contracts}</td>
                        <td className={cn(
                          "px-3 py-2 font-medium tabular-nums",
                          t.gross_pnl >= 0 ? "text-emerald-600" : "text-red-600"
                        )}>
                          {formatMoney(t.gross_pnl)}
                        </td>
                        <td className="px-3 py-2 text-xs capitalize text-muted-foreground whitespace-nowrap">
                          {t.session.replace(/_/g, " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Total P&L:{" "}
                  <span className={cn("font-semibold", totalPnl >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {formatMoney(totalPnl)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Wins: <span className="font-medium text-foreground">{wins}</span>
                </span>
                <span className="text-muted-foreground">
                  Losses: <span className="font-medium text-foreground">{losses}</span>
                </span>
              </div>
            </div>
          )}

          {/* ── Importing ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Saving trades…</p>
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && result && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-full bg-emerald-500/15 p-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold">Import complete</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.imported} trade{result.imported !== 1 ? "s" : ""} imported
                  {result.skipped > 0 && `, ${result.skipped} skipped (duplicates)`}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          {step === "idle" && (
            <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
              Cancel
            </button>
          )}
          {step === "preview" && (
            <>
              <button
                onClick={() => { setStep("idle"); setPreview([]); }}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Confirm import ({preview.length})
              </button>
            </>
          )}
          {step === "done" && (
            <button
              onClick={onClose}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
