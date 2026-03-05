"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { importTrades, type TradeImportInput } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type {
  Instrument,
  TradeDirection,
  TradingSession,
  Trade,
  PropAccount,
  Strategy,
} from "@/lib/types";

// ── CSV row shape (Position_History.csv) ───────────────────────────────────

interface CsvRow {
  "Position ID": string;
  Timestamp: string;
  "Trade Date": string;
  "Net Pos": string;
  "Net Price": string;
  Bought: string;
  "Avg. Buy": string;
  Sold: string;
  "Avg. Sell": string;
  Account: string;
  Contract: string;
  Product: string;
  "Product Description": string;
  _priceFormat: string;
  _priceFormatType: string;
  _tickSize: string;
  "Pair ID": string;
  "Buy Fill ID": string;
  "Sell Fill ID": string;
  "Paired Qty": string;
  "Buy Price": string;
  "Sell Price": string;
  "P/L": string;
  Currency: string;
  "Bought Timestamp": string;
  "Sold Timestamp": string;
  [key: string]: string;
}

// ── Product → Instrument mapping ───────────────────────────────────────────

const PRODUCT_TO_INSTRUMENT: Record<string, Instrument> = {
  MNQ: "NQ",
  NQ: "NQ",
  MES: "ES",
  ES: "ES",
  MGC: "Gold",
  GC: "Gold",
  MCL: "CL",
  CL: "CL",
  M6E: "6E",
  "6E": "6E",
};

// ── Default commission rates (round-turn per contract) ─────────────────────

export const DEFAULT_COMMISSIONS: Record<string, number> = {
  MNQ: 0.75,
  NQ: 2.8,
  MES: 0.75,
  ES: 2.8,
  MGC: 1.05,
  GC: 3.25,
  MCL: 1.05,
  CL: 3.05,
  M6E: 0.52,
  "6E": 0,
};

const COMMISSION_PRODUCTS = [
  "MNQ", "NQ",
  "MES", "ES",
  "MGC", "GC",
  "MCL", "CL",
  "M6E", "6E",
];

// ── Time helpers ───────────────────────────────────────────────────────────

const CYPRUS_TZ = "Asia/Nicosia"; // Tradovate exports in Cyprus local time

/**
 * Parse a Tradovate "M/D/YYYY H:MM:SS" timestamp (Cyprus local time / EET = UTC+2)
 * and return the true UTC Date.
 *
 * Strategy: treat the raw string as UTC first, ask Intl what Cyprus local time
 * that UTC moment represents, compute the offset, then subtract it so we get
 * the real UTC for the given Cyprus local wall-clock time.
 */
function parseCyprusTimestamp(raw: string): Date {
  const t = raw?.trim();
  if (!t) return new Date(NaN);
  const spaceIdx = t.indexOf(" ");
  if (spaceIdx === -1) return new Date(NaN);
  const datePart = t.slice(0, spaceIdx);
  const timePart = t.slice(spaceIdx + 1);
  const parts = datePart.split("/");
  if (parts.length !== 3) return new Date(NaN);
  const [m, d, y] = parts;
  const asUtc = new Date(
    `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${timePart}Z`
  );
  if (isNaN(asUtc.getTime())) return new Date(NaN);
  // What Cyprus clock shows for this UTC moment
  const cyprusStr = asUtc.toLocaleString("sv-SE", { timeZone: CYPRUS_TZ });
  const cyprusMs = new Date(cyprusStr.replace(" ", "T") + "Z").getTime();
  const offsetMs = cyprusMs - asUtc.getTime(); // how many ms Cyprus is ahead of UTC
  return new Date(asUtc.getTime() - offsetMs);  // true UTC
}

/**
 * Detect trading session from the entry UTC time.
 * Uses Cyprus local hour directly (EET = UTC+2 for March 2026).
 *
 * Boundaries in Cyprus local time:
 *   09:00–15:00 → London
 *   15:00–19:00 → New York AM
 *   19:00–00:00 → New York PM
 *   00:00–09:00 → Overnight / Asia
 */
function detectSession(utcDate: Date): TradingSession {
  const h = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CYPRUS_TZ,
      hour: "numeric",
      hour12: false,
    }).format(utcDate),
    10
  );
  if (h >= 9 && h < 15) return "london";
  if (h >= 15 && h < 19) return "new_york_am";
  if (h >= 19) return "new_york_pm";
  return "overnight";
}

// ── Parse Position_History.csv rows → preview trades ──────────────────────

interface PreviewTrade {
  pair_id: string;
  position_id: string;
  product: string;
  instrument: Instrument;
  direction: TradeDirection;
  entry_price: number;
  exit_price: number;
  size: number;
  gross_pnl: number;
  commission: number;
  net_pnl: number;
  entry_time: string; // UTC ISO
  exit_time: string;  // UTC ISO
  session: TradingSession;
}

function parsePositionHistory(
  rows: CsvRow[],
  commissionRates: Record<string, number>
): PreviewTrade[] {
  const trades: PreviewTrade[] = [];

  for (const row of rows) {
    const boughtRaw = row["Bought Timestamp"]?.trim();
    const soldRaw   = row["Sold Timestamp"]?.trim();
    if (!boughtRaw || !soldRaw) continue;

    const boughtTime = parseCyprusTimestamp(boughtRaw);
    const soldTime   = parseCyprusTimestamp(soldRaw);
    if (isNaN(boughtTime.getTime()) || isNaN(soldTime.getTime())) continue;

    // Direction: earlier timestamp = entry
    const isLong = boughtTime < soldTime;
    const direction: TradeDirection = isLong ? "long" : "short";

    const buyPrice  = parseFloat(row["Buy Price"]);
    const sellPrice = parseFloat(row["Sell Price"]);
    if (isNaN(buyPrice) || isNaN(sellPrice)) continue;

    // LONG:  entry = Buy Price,  exit = Sell Price
    // SHORT: entry = Sell Price, exit = Buy Price
    const entryPrice = isLong ? buyPrice  : sellPrice;
    const exitPrice  = isLong ? sellPrice : buyPrice;
    const entryTime  = isLong ? boughtTime : soldTime;
    const exitTime   = isLong ? soldTime   : boughtTime;

    const grossPnl = parseFloat(row["P/L"]);
    if (isNaN(grossPnl)) continue;

    const pairedQty = parseInt(row["Paired Qty"], 10);
    if (isNaN(pairedQty) || pairedQty <= 0) continue;

    const product    = row["Product"]?.trim().toUpperCase();
    const instrument = product ? PRODUCT_TO_INSTRUMENT[product] : undefined;
    if (!instrument) continue;

    const rate       = commissionRates[product] ?? 0;
    const commission = Math.round(pairedQty * rate * 100) / 100;
    const netPnl     = Math.round((grossPnl - commission) * 100) / 100;

    trades.push({
      pair_id:     row["Pair ID"]?.trim()     ?? "",
      position_id: row["Position ID"]?.trim() ?? "",
      product,
      instrument,
      direction,
      entry_price: entryPrice,
      exit_price:  exitPrice,
      size:        pairedQty,
      gross_pnl:   Math.round(grossPnl * 100) / 100,
      commission,
      net_pnl:     netPnl,
      entry_time:  entryTime.toISOString(),
      exit_time:   exitTime.toISOString(),
      session:     detectSession(entryTime),
    });
  }

  trades.sort((a, b) => a.entry_time.localeCompare(b.entry_time));
  return trades;
}

function toImportInput(
  t: PreviewTrade,
  overrides: { prop_account_id: string | null; strategy_id: string | null }
): TradeImportInput {
  const outcome =
    t.net_pnl > 0 ? "win" : t.net_pnl < 0 ? "loss" : "break_even";
  return {
    instrument:       t.instrument,
    direction:        t.direction,
    entry_price:      t.entry_price,
    exit_price:       t.exit_price,
    contracts:        t.size,
    entry_time:       t.entry_time,
    exit_time:        t.exit_time,
    gross_pnl:        t.gross_pnl,
    fees:             t.commission,
    outcome,
    session:          t.session,
    position_id:      t.position_id || null,
    pair_id:          t.pair_id     || null,
    prop_account_id:  overrides.prop_account_id,
    strategy_id:      overrides.strategy_id,
    setup_tags:       null,
    confluence_notes: null,
    entry_notes:      null,
    exit_notes:       null,
    lessons:          null,
    screenshots:      null,
    pre_emotion:      null,
    post_emotion:     null,
    followed_rules:   null,
    is_reviewed:      false,
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
  propAccounts: PropAccount[];
  strategies:   Strategy[];
  onImported:   (newTrades: Trade[]) => void;
  onClose:      () => void;
}

type Step = "idle" | "preview" | "importing" | "done";

export function TradovateImport({
  propAccounts,
  strategies,
  onImported,
  onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step,        setStep]       = useState<Step>("idle");
  const [preview,     setPreview]    = useState<PreviewTrade[]>([]);
  const [parseError,  setParseError] = useState<string | null>(null);
  const [result,      setResult]     = useState<{ imported: number; skipped: number } | null>(null);

  // Commission rates — user can override in the upload screen
  const [commissions, setCommissions] = useState<Record<string, number>>(
    () => ({ ...DEFAULT_COMMISSIONS })
  );

  const [selectedAccountId,  setSelectedAccountId]  = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState("");

  function handleCommissionChange(product: string, raw: string) {
    const val = parseFloat(raw);
    setCommissions((prev) => ({ ...prev, [product]: isNaN(val) ? 0 : val }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          const trades = parsePositionHistory(results.data, commissions);
          if (trades.length === 0) {
            setParseError(
              "No paired trades found. Make sure this is a Position_History.csv " +
              "file exported from Tradovate with 'Bought Timestamp' and 'Sold Timestamp' columns."
            );
            return;
          }
          setPreview(trades);
          setStep("preview");
        } catch (err) {
          setParseError(
            err instanceof Error ? err.message : "Failed to parse CSV"
          );
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
      const overrides = {
        prop_account_id: selectedAccountId  || null,
        strategy_id:     selectedStrategyId || null,
      };
      const res = await importTrades(
        preview.map((t) => toImportInput(t, overrides))
      );
      setResult(res);
      setStep("done");
      onImported([]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? "Import failed";
      setParseError(msg);
      setStep("preview");
    }
  }

  // Preview summary
  const totalGross      = preview.reduce((s, t) => s + t.gross_pnl,  0);
  const totalCommission = preview.reduce((s, t) => s + t.commission, 0);
  const totalNet        = preview.reduce((s, t) => s + t.net_pnl,    0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto p-4">
      <div className="relative w-full max-w-5xl rounded-xl border bg-card shadow-xl my-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Import Tradovate CSV</h2>
            <p className="text-sm text-muted-foreground">
              Upload a <span className="font-mono text-xs">Position_History.csv</span> file exported from Tradovate
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

          {/* ── Step 1: Upload + commission rates ── */}
          {step === "idle" && (
            <div className="space-y-6">
              {/* Drop zone */}
              <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/25 py-10">
                <div className="rounded-full bg-muted p-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">
                    Choose your <span className="font-mono text-sm">Position_History.csv</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Each row is a pre-matched fill pair — no FIFO reconstruction needed.
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

              {/* Commission rate table */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Commission rates (round-turn per contract)
                </p>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Product
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Rate ($)
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Product
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Rate ($)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: Math.ceil(COMMISSION_PRODUCTS.length / 2) }, (_, i) => {
                        const left  = COMMISSION_PRODUCTS[i * 2];
                        const right = COMMISSION_PRODUCTS[i * 2 + 1];
                        return (
                          <tr key={left} className="border-b last:border-0">
                            <td className="px-4 py-2 font-mono text-xs font-medium">{left}</td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={commissions[left] ?? 0}
                                onChange={(e) => handleCommissionChange(left, e.target.value)}
                                className="w-20 rounded border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                              />
                            </td>
                            {right ? (
                              <>
                                <td className="px-4 py-2 font-mono text-xs font-medium">{right}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={commissions[right] ?? 0}
                                    onChange={(e) => handleCommissionChange(right, e.target.value)}
                                    className="w-20 rounded border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                                  />
                                </td>
                              </>
                            ) : (
                              <><td /><td /></>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found{" "}
                <span className="font-medium text-foreground">{preview.length}</span>{" "}
                paired trade{preview.length !== 1 ? "s" : ""}. Review below, then
                confirm to save.
              </p>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {[
                        "Date",
                        "Instrument",
                        "Direction",
                        "Entry",
                        "Exit",
                        "Qty",
                        "Gross P/L",
                        "Commission",
                        "Net P/L",
                        "Session",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((t, i) => (
                      <tr
                        key={t.pair_id || i}
                        className={cn(
                          "border-b last:border-0",
                          t.net_pnl > 0
                            ? "bg-emerald-500/5"
                            : t.net_pnl < 0
                            ? "bg-red-500/5"
                            : i % 2 === 0
                            ? "bg-background"
                            : "bg-muted/20"
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
                        <td className="px-3 py-2 tabular-nums">
                          {t.entry_price.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {t.exit_price.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{t.size}</td>
                        <td
                          className={cn(
                            "px-3 py-2 tabular-nums",
                            t.gross_pnl >= 0 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {formatMoney(t.gross_pnl)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {formatMoney(t.commission)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 font-medium tabular-nums",
                            t.net_pnl >= 0 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {formatMoney(t.net_pnl)}
                        </td>
                        <td className="px-3 py-2 text-xs capitalize text-muted-foreground whitespace-nowrap">
                          {t.session.replace(/_/g, " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary footer */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Rows:{" "}
                  <span className="font-medium text-foreground">{preview.length}</span>
                </span>
                <span className="text-muted-foreground">
                  Gross P/L:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      totalGross >= 0 ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {formatMoney(totalGross)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Commission:{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(totalCommission)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Net P/L:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      totalNet >= 0 ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {formatMoney(totalNet)}
                  </span>
                </span>
              </div>

              {/* Optional account / strategy assignment */}
              {(propAccounts.length > 0 || strategies.length > 0) && (
                <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Assign to (optional)
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {propAccounts.length > 0 && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground whitespace-nowrap">
                          Account
                        </label>
                        <select
                          value={selectedAccountId}
                          onChange={(e) => setSelectedAccountId(e.target.value)}
                          className="rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">None</option>
                          {propAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.firm} · {a.account_label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {strategies.length > 0 && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground whitespace-nowrap">
                          Strategy
                        </label>
                        <select
                          value={selectedStrategyId}
                          onChange={(e) => setSelectedStrategyId(e.target.value)}
                          className="rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">None</option>
                          {strategies.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Importing spinner ── */}
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
                  {result.skipped > 0 &&
                    `, ${result.skipped} skipped (duplicates)`}
                  .
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
                Import {preview.length} trade{preview.length !== 1 ? "s" : ""}
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
