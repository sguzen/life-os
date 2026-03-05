"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { importTrades, type TradeImportInput } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type { Instrument, TradeDirection, TradingSession, Trade } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

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

interface ParsedFill {
  orderId: string;
  side: "B" | "S";
  contract: string; // stripped root, e.g. MNQ
  product: string;  // raw product, e.g. MNQ
  avgPrice: number;
  filledQty: number;
  fillTime: Date;
  fillTimeRaw: string;
}

interface PreviewTrade {
  instrument: Instrument;
  direction: TradeDirection;
  entry_price: number;
  exit_price: number;
  contracts: number;
  entry_time: string; // ISO
  exit_time: string;  // ISO
  gross_pnl: number;
  session: TradingSession;
  product: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const POINT_VALUES: Record<string, number> = {
  NQ: 20,
  MNQ: 2,
  GC: 100,
  MGC: 10,
  CL: 1000,
  MCL: 100,
  "6E": 125000,
  M6E: 12500,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function stripExpiry(contract: string): string {
  // Remove trailing month-code + year digits: MNQH6 → MNQ, NQZ24 → NQ
  return contract.trim().replace(/[A-Z]\d{1,2}$/, "");
}

function mapInstrument(product: string): Instrument {
  const p = product.trim().toUpperCase();
  if (p === "NQ" || p === "MNQ") return "NQ";
  if (p === "GC" || p === "MGC") return "Gold";
  if (p === "CL" || p === "MCL") return "CL";
  if (p === "6E" || p === "M6E") return "6E";
  throw new Error(`Unknown product: ${product}`);
}

function getPointValue(product: string): number {
  return POINT_VALUES[product.trim().toUpperCase()] ?? 1;
}

function detectSession(hour: number): TradingSession {
  if (hour >= 2 && hour < 8) return "london";
  if (hour >= 8 && hour < 12) return "new_york_am";
  if (hour >= 12 && hour < 17) return "new_york_pm";
  return "overnight";
}

// Parse Tradovate Fill Time: "M/D/YYYY H:MM:SS" → Date
function parseFillTime(raw: string): Date {
  const trimmed = raw.trim();
  const [datePart, timePart] = trimmed.split(" ");
  const [m, d, y] = datePart.split("/");
  return new Date(
    `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${timePart}`
  );
}

function fillTimeToISO(raw: string): string {
  const trimmed = raw.trim();
  const [datePart, timePart] = trimmed.split(" ");
  const [m, d, y] = datePart.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${timePart}`;
}

// ── Core parsing logic ─────────────────────────────────────────────────────

function parseCsvToTrades(rows: CsvRow[]): PreviewTrade[] {
  // 1. Filter: keep Filled rows (Market, Limit, Stop); skip Cancelled/Working
  const fills: ParsedFill[] = [];
  for (const row of rows) {
    const status = row.Status?.trim();
    if (status !== "Filled") continue;

    const type = row.Type?.trim();
    if (type !== "Market" && type !== "Limit" && type !== "Stop") continue;

    const side = row["B/S"].trim() as "B" | "S";
    if (side !== "B" && side !== "S") continue;

    const product = row.Product.trim();
    const contract = stripExpiry(row.Contract.trim());
    const avgPrice = parseFloat(row.avgPrice);
    const filledQty = parseFloat(row.filledQty);
    if (isNaN(avgPrice) || isNaN(filledQty) || filledQty <= 0) continue;

    fills.push({
      orderId: row.orderId,
      side,
      contract,
      product,
      avgPrice,
      filledQty,
      fillTime: parseFillTime(row["Fill Time"]),
      fillTimeRaw: row["Fill Time"],
    });
  }

  // 2. Sort by fill time ascending
  fills.sort((a, b) => a.fillTime.getTime() - b.fillTime.getTime());

  // 3. Group by contract root and pair fills
  const byContract = new Map<string, ParsedFill[]>();
  for (const fill of fills) {
    if (!byContract.has(fill.contract)) byContract.set(fill.contract, []);
    byContract.get(fill.contract)!.push(fill);
  }

  const trades: PreviewTrade[] = [];

  for (const contractFills of Array.from(byContract.values())) {
    const unmatched: ParsedFill[] = [];

    for (const fill of contractFills) {
      // Find oldest unmatched fill with opposing direction and same qty
      const idx = unmatched.findIndex(
        (u) => u.side !== fill.side && u.filledQty === fill.filledQty
      );

      if (idx !== -1) {
        const match = unmatched.splice(idx, 1)[0];
        // Determine entry vs exit (chronological order already guaranteed)
        const entry = match;
        const exit = fill;

        const direction: TradeDirection = entry.side === "B" ? "long" : "short";
        const pointValue = getPointValue(entry.product);
        const priceDiff =
          direction === "long"
            ? exit.avgPrice - entry.avgPrice
            : entry.avgPrice - exit.avgPrice;
        const grossPnl =
          Math.round(priceDiff * entry.filledQty * pointValue * 100) / 100;

        const entryDate = entry.fillTime;
        const session = detectSession(entryDate.getHours());

        try {
          const instrument = mapInstrument(entry.product);
          trades.push({
            instrument,
            direction,
            entry_price: entry.avgPrice,
            exit_price: exit.avgPrice,
            contracts: entry.filledQty,
            entry_time: fillTimeToISO(entry.fillTimeRaw),
            exit_time: fillTimeToISO(exit.fillTimeRaw),
            gross_pnl: grossPnl,
            session,
            product: entry.product,
          });
        } catch {
          // Skip unknown instruments silently
        }
      } else {
        unmatched.push(fill);
      }
    }
  }

  // Sort result by entry time ascending
  trades.sort((a, b) => a.entry_time.localeCompare(b.entry_time));
  return trades;
}

function toImportInput(t: PreviewTrade): TradeImportInput {
  const outcome = t.gross_pnl > 0 ? "win" : t.gross_pnl < 0 ? "loss" : "break_even";
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
  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<PreviewTrade[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          const trades = parseCsvToTrades(results.data);
          if (trades.length === 0) {
            setParseError(
              "No completed trades found. Make sure the CSV contains Filled rows (Market, Limit, or Stop orders) with a recognisable Contract and Product."
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

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  async function handleConfirm() {
    setStep("importing");
    try {
      const inputs = preview.map(toImportInput);
      const res = await importTrades(inputs);
      setResult(res);
      setStep("done");
      // We can't easily return the new Trade objects without a re-fetch,
      // so we signal the parent to refresh with an empty array trigger
      onImported([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  }

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
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Error banner */}
          {parseError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {step === "idle" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-full bg-muted p-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">Choose a Tradovate order history CSV</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Only Filled + Market orders are processed. Paired fills become trades.
                </p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Browse CSV file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found <span className="font-medium text-foreground">{preview.length}</span> reconstructed{" "}
                trade{preview.length !== 1 ? "s" : ""}. Review below, then confirm to save.
              </p>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {["Date", "Instrument", "Dir", "Entry", "Exit", "Size", "P&L", "Session"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground"
                          >
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
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              t.direction === "long"
                                ? "bg-emerald-500/15 text-emerald-600"
                                : "bg-red-500/15 text-red-600"
                            )}
                          >
                            {t.direction === "long" ? "Long" : "Short"}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{t.entry_price.toLocaleString()}</td>
                        <td className="px-3 py-2 tabular-nums">{t.exit_price.toLocaleString()}</td>
                        <td className="px-3 py-2 tabular-nums">{t.contracts}</td>
                        <td
                          className={cn(
                            "px-3 py-2 font-medium tabular-nums",
                            t.gross_pnl >= 0 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {formatMoney(t.gross_pnl)}
                        </td>
                        <td className="px-3 py-2 text-xs capitalize text-muted-foreground">
                          {t.session.replace("_", " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary row */}
              <div className="flex items-center gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Total P&L:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      preview.reduce((s, t) => s + t.gross_pnl, 0) >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    )}
                  >
                    {formatMoney(preview.reduce((s, t) => s + t.gross_pnl, 0))}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Wins:{" "}
                  <span className="font-medium text-foreground">
                    {preview.filter((t) => t.gross_pnl > 0).length}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Losses:{" "}
                  <span className="font-medium text-foreground">
                    {preview.filter((t) => t.gross_pnl < 0).length}
                  </span>
                </span>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Saving trades…</p>
            </div>
          )}

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
            <button
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => {
                  setStep("idle");
                  setPreview([]);
                }}
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
