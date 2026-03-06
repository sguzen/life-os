"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Instrument, TradingSession, PropAccount, Strategy, Trade } from "@/lib/types";

// ── CSV row shapes ───────────────────────────────────────────────────────────

interface CashRow {
  Account: string;
  "Transaction ID": string;
  Timestamp: string;
  Date: string;
  Delta: string;
  Amount: string;
  "Cash Change Type": string;
  Currency: string;
  Contract: string;
  [key: string]: string;
}

interface OrderRow {
  orderId: string;
  Account: string;
  "Order ID": string;
  "B/S": string;
  Contract: string;
  Product: string;
  avgPrice: string;
  filledQty: string;
  "Fill Time": string;
  Status: string;
  "Filled Qty": string;
  "Avg Fill Price": string;
  [key: string]: string;
}

// ── Product → Instrument mapping ─────────────────────────────────────────────

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

// Ordered longest-first so "MNQ" matches before "NQ"
const PRODUCT_PREFIXES = ["MNQ", "MES", "MGC", "MCL", "M6E", "NQ", "ES", "GC", "CL", "6E"];

function contractToInstrument(contract: string): Instrument | null {
  for (const prefix of PRODUCT_PREFIXES) {
    if (contract.startsWith(prefix)) return PRODUCT_TO_INSTRUMENT[prefix] ?? null;
  }
  return null;
}

// ── Time helpers ─────────────────────────────────────────────────────────────

const CYPRUS_TZ = "Asia/Nicosia";

/**
 * Parse a Tradovate "MM/DD/YYYY HH:MM:SS" timestamp (Cyprus EET local) → UTC ISO string.
 * Reuses the same approach as the existing tradovate-import.tsx.
 */
function parseCyprusTimestamp(raw: string): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const spaceIdx = t.indexOf(" ");
  if (spaceIdx === -1) return null;
  const [m, d, y] = t.slice(0, spaceIdx).split("/");
  const timePart = t.slice(spaceIdx + 1);
  if (!m || !d || !y || !timePart) return null;
  const asUtc = new Date(
    `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${timePart}Z`
  );
  if (isNaN(asUtc.getTime())) return null;
  const cyprusStr = asUtc.toLocaleString("sv-SE", { timeZone: CYPRUS_TZ });
  const cyprusMs  = new Date(cyprusStr.replace(" ", "T") + "Z").getTime();
  const offsetMs  = cyprusMs - asUtc.getTime();
  return new Date(asUtc.getTime() - offsetMs).toISOString();
}

/**
 * Parse Tradovate timestamp as a comparable UTC ms value (for ±2s window).
 * Treats the string as Cyprus local (UTC+2 for EET) then converts.
 */
function parseTimestampMs(raw: string): number | null {
  const iso = parseCyprusTimestamp(raw);
  return iso ? new Date(iso).getTime() : null;
}

/** Format a UTC ms value back to Tradovate timestamp format "MM/DD/YYYY HH:MM:SS"
 * — but we stay in the Cyprus timezone so comparisons against the map key work. */
function msToTradovateKey(ms: number): string {
  const d = new Date(ms);
  // Convert back to Cyprus local string
  const local = d.toLocaleString("sv-SE", { timeZone: CYPRUS_TZ });
  // local = "YYYY-MM-DD HH:MM:SS"
  const [datePart, timePart] = local.split(" ");
  const [y, mo, da] = datePart.split("-");
  return `${mo}/${da}/${y} ${timePart}`;
}

/**
 * Detect session from the Tradovate timestamp string.
 * The hour is taken directly from the raw string (already Cyprus local).
 */
function detectSession(raw: string): TradingSession {
  const timePart = raw.trim().split(" ")[1] ?? "00:00:00";
  const h = parseInt(timePart.split(":")[0], 10);
  if (h >= 9  && h < 15) return "london";
  if (h >= 15 && h < 19) return "new_york_am";
  if (h >= 19)           return "new_york_pm";
  return "overnight";
}

// ── Preview trade shape ───────────────────────────────────────────────────────

export interface DualPreviewTrade {
  // Display
  date:         string;         // "2026-03-02"
  raw_timestamp: string;        // original "MM/DD/YYYY HH:MM:SS"
  contract:     string;         // "MGCJ6"
  instrument:   Instrument;
  direction:    "long" | "short";
  qty:          number;
  entry_price:  number | null;
  exit_price:   number | null;
  gross_pnl:    number;
  exchange_fee: number;
  clearing_fee: number;
  nfa_fee:      number;
  commission:   number;
  total_fees:   number;
  net_pnl:      number;
  session:      TradingSession;
  // Storage
  exit_time_iso:  string;       // UTC ISO of Cash History Timestamp
  entry_time_iso: string;       // UTC ISO of entry order Fill Time (or exit if missing)
}

// ── Matching algorithm ────────────────────────────────────────────────────────

function parseDualCsv(cashRows: CashRow[], orderRows: OrderRow[]): DualPreviewTrade[] {
  // STEP 1 — Trade Paired entries (with original index for backward fee scan)
  const tradePaired = cashRows
    .map((row, i) => ({ i, row }))
    .filter(({ row }) => row["Cash Change Type"]?.trim() === "Trade Paired");

  // STEP 2 — Build order lookup: key = "MM/DD/YYYY HH:MM:SS|Contract"
  const FEE_TYPES = new Set(["Exchange Fee", "Clearing Fee", "Nfa Fee", "Commission"]);
  const orderMap = new Map<string, OrderRow[]>();
  for (const o of orderRows) {
    if (o.Status?.trim() !== "Filled") continue;
    const ft = o["Fill Time"]?.trim();
    if (!ft) continue;
    const key = `${ft}|${o.Contract?.trim()}`;
    const list = orderMap.get(key) ?? [];
    list.push(o);
    orderMap.set(key, list);
  }

  const trades: DualPreviewTrade[] = [];

  // STEP 3 — Match each Trade Paired row
  for (const { i, row: cr } of tradePaired) {
    const ts       = cr.Timestamp?.trim();
    const contract = cr.Contract?.trim();
    if (!ts || !contract) continue;

    const grossPnl = parseFloat((cr.Delta ?? "").replace(/,/g, ""));
    if (isNaN(grossPnl)) continue;

    // 3a — Find exit orders: exact match then ±2 s
    let exitOrders: OrderRow[] = orderMap.get(`${ts}|${contract}`) ?? [];
    if (!exitOrders.length) {
      const exitMs = parseTimestampMs(ts);
      if (exitMs !== null) {
        for (const deltaSec of [1, -1, 2, -2]) {
          const candidate = msToTradovateKey(exitMs + deltaSec * 1000);
          const found = orderMap.get(`${candidate}|${contract}`);
          if (found?.length) {
            exitOrders = found;
            break;
          }
        }
      }
    }
    if (!exitOrders.length) continue; // cannot determine direction / price

    // 3b — Collect fees scanning BACKWARDS from index i
    const fees = {
      "Exchange Fee": 0,
      "Clearing Fee": 0,
      "Nfa Fee":      0,
      "Commission":   0,
    };
    for (let j = i - 1; j >= 0; j--) {
      const prev     = cashRows[j];
      const prevType = prev["Cash Change Type"]?.trim() ?? "";
      if (prevType === "Trade Paired") break;
      if (FEE_TYPES.has(prevType) && prev.Contract?.trim() === contract) {
        fees[prevType as keyof typeof fees] += parseFloat(
          (prev.Delta ?? "").replace(/,/g, "")
        );
      }
    }

    // 3c — Direction and exit price
    const exitBs    = exitOrders[0]["B/S"]?.trim();           // "Buy" | "Sell"
    const exitPrice = parseFloat(exitOrders[0]["Avg Fill Price"]);
    const exitQty   = exitOrders.reduce(
      (s, o) => s + parseFloat(o["Filled Qty"] || o["filledQty"] || "0"),
      0
    );
    const direction: "long" | "short" = exitBs === "Buy" ? "short" : "long";

    // 3d — Entry price from most-recent opposite-side filled order before exit
    const exitMs = parseTimestampMs(ts);
    let entryPrice: number | null = null;
    let entryFillTime: string | null = null;

    if (exitMs !== null) {
      const oppBs = exitBs === "Buy" ? "Sell" : "Buy";
      let bestMs  = -Infinity;
      for (const o of orderRows) {
        if (o.Contract?.trim() !== contract)           continue;
        if (o["B/S"]?.trim() !== oppBs)               continue;
        if (o.Status?.trim() !== "Filled")             continue;
        const ft = o["Fill Time"]?.trim();
        if (!ft)                                       continue;
        const oMs = parseTimestampMs(ft);
        if (oMs === null || oMs >= exitMs)             continue;
        if (oMs > bestMs) {
          bestMs        = oMs;
          entryPrice    = parseFloat(o["Avg Fill Price"]);
          entryFillTime = ft;
        }
      }
    }

    // 3e — Session (uses raw local hour)
    const session = detectSession(ts);

    // Compute totals
    const totalFees =
      fees["Exchange Fee"] +
      fees["Clearing Fee"] +
      fees["Nfa Fee"] +
      fees["Commission"];
    const netPnl = Math.round((grossPnl + totalFees) * 100) / 100;

    // ISO timestamps for storage
    const exitTimeIso  = parseCyprusTimestamp(ts);
    const entryTimeIso = entryFillTime
      ? parseCyprusTimestamp(entryFillTime)
      : exitTimeIso;
    if (!exitTimeIso || !entryTimeIso) continue;

    // Date string from raw timestamp ("MM/DD/YYYY …" → "YYYY-MM-DD")
    const [mo, da, yr] = ts.split(" ")[0].split("/");
    const date = `${yr}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;

    const instrument = contractToInstrument(contract);
    if (!instrument) continue;

    trades.push({
      date,
      raw_timestamp: ts,
      contract,
      instrument,
      direction,
      qty:           exitQty || 1,
      entry_price:   isNaN(entryPrice!) ? null : entryPrice,
      exit_price:    isNaN(exitPrice)   ? null : exitPrice,
      gross_pnl:     Math.round(grossPnl * 100) / 100,
      exchange_fee:  Math.round(fees["Exchange Fee"] * 10000) / 10000,
      clearing_fee:  Math.round(fees["Clearing Fee"] * 10000) / 10000,
      nfa_fee:       Math.round(fees["Nfa Fee"]      * 10000) / 10000,
      commission:    Math.round(fees["Commission"]   * 10000) / 10000,
      total_fees:    Math.round(totalFees * 10000) / 10000,
      net_pnl:       netPnl,
      session,
      exit_time_iso:  exitTimeIso,
      entry_time_iso: entryTimeIso,
    });
  }

  return trades;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ── Reconciliation by date ────────────────────────────────────────────────────

function groupByDate(trades: DualPreviewTrade[]) {
  const map = new Map<string, DualPreviewTrade[]>();
  for (const t of trades) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

// ── Dropzone sub-component ────────────────────────────────────────────────────

function FileDropzone({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => ref.current?.click()}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors",
        file
          ? "border-emerald-500/60 bg-emerald-500/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"
      )}
    >
      {file ? (
        <>
          <div className="rounded-full bg-emerald-500/15 p-3">
            <FileText className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-emerald-600">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(file.size / 1024).toFixed(1)} KB — click to replace
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-full bg-muted p-3">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Drag & drop or click to browse
            </p>
          </div>
        </>
      )}
      <input
        ref={ref}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  propAccounts: PropAccount[];
  strategies:   Strategy[];
  onImported:   (newTrades: Trade[]) => void;
  onClose:      () => void;
}

type Step = "idle" | "parsing" | "preview" | "importing" | "done";

export function TradovateDualImport({
  propAccounts,
  strategies,
  onImported,
  onClose,
}: Props) {
  const [step,       setStep]      = useState<Step>("idle");
  const [cashFile,   setCashFile]  = useState<File | null>(null);
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [preview,    setPreview]   = useState<DualPreviewTrade[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dupCount,   setDupCount]  = useState<number | null>(null);
  const [result,     setResult]    = useState<{ imported: number; skipped: number } | null>(null);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const [selectedAccountId,  setSelectedAccountId]  = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState("");

  // ── Parse both files ──────────────────────────────────────────────────────

  function handleParse() {
    if (!cashFile || !ordersFile) return;
    setParseError(null);
    setStep("parsing");

    let cashRows: CashRow[]   | null = null;
    let orderRows: OrderRow[] | null = null;

    function tryMatch() {
      if (!cashRows || !orderRows) return;
      try {
        const trades = parseDualCsv(cashRows, orderRows);
        if (trades.length === 0) {
          setParseError(
            "No trades matched. Make sure Cash_History.csv has 'Trade Paired' rows " +
            "and Orders.csv has 'Filled' orders for the same date range."
          );
          setStep("idle");
          return;
        }
        setPreview(trades);
        // Check for duplicates asynchronously
        checkDuplicates(trades).then((n) => setDupCount(n));
        setStep("preview");
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Failed to parse CSV files");
        setStep("idle");
      }
    }

    Papa.parse<CashRow>(cashFile, {
      header: true,
      skipEmptyLines: true,
      complete(r) {
        cashRows = r.data;
        tryMatch();
      },
      error(err) {
        setParseError(`Cash History: ${err.message}`);
        setStep("idle");
      },
    });

    Papa.parse<OrderRow>(ordersFile, {
      header: true,
      skipEmptyLines: true,
      complete(r) {
        orderRows = r.data;
        tryMatch();
      },
      error(err) {
        setParseError(`Orders: ${err.message}`);
        setStep("idle");
      },
    });
  }

  // ── Check duplicates against Supabase ────────────────────────────────────

  async function checkDuplicates(trades: DualPreviewTrade[]): Promise<number> {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("trades")
        .select("exit_time, contract, gross_pnl")
        .not("contract", "is", null);

      if (!data) return 0;
      const keys = new Set(data.map((t) => `${t.exit_time}|${t.contract}|${t.gross_pnl}`));
      return trades.filter((t) => keys.has(`${t.exit_time_iso}|${t.contract}|${t.gross_pnl}`)).length;
    } catch {
      return 0;
    }
  }

  // ── Confirm import ────────────────────────────────────────────────────────

  async function handleConfirm() {
    setStep("importing");
    try {
      const body = preview.map((t) => ({
        date:            t.date,
        timestamp:       t.exit_time_iso,
        entry_time:      t.entry_time_iso,
        instrument:      t.instrument,
        contract:        t.contract,
        direction:       t.direction,
        qty:             t.qty,
        entry_price:     t.entry_price,
        exit_price:      t.exit_price,
        gross_pnl:       t.gross_pnl,
        exchange_fee:    t.exchange_fee,
        clearing_fee:    t.clearing_fee,
        nfa_fee:         t.nfa_fee,
        commission:      t.commission,
        total_fees:      t.total_fees,
        net_pnl:         t.net_pnl,
        session:         t.session,
        prop_account_id: selectedAccountId  || null,
        strategy_id:     selectedStrategyId || null,
      }));

      const res = await fetch("/api/trading/import-tradovate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Import failed");
      }

      const data = await res.json();
      setResult({ imported: data.imported, skipped: data.skipped });
      setStep("done");
      onImported([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  }

  // ── Derived summary values ────────────────────────────────────────────────

  const totalGross = preview.reduce((s, t) => s + t.gross_pnl,   0);
  const totalFees  = preview.reduce((s, t) => s + t.total_fees,  0);
  const totalNet   = preview.reduce((s, t) => s + t.net_pnl,     0);
  const byDate     = groupByDate(preview);

  function toggleDate(date: string) {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto p-4">
      <div className="relative w-full max-w-5xl rounded-xl border bg-card shadow-xl my-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Import Tradovate — Cash History + Orders</h2>
            <p className="text-sm text-muted-foreground">
              Upload{" "}
              <span className="font-mono text-xs">Cash_History.csv</span>
              {" "}and{" "}
              <span className="font-mono text-xs">Orders.csv</span>
              {" "}exported from Tradovate for the same date range.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {parseError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* ── Step: idle ── */}
          {(step === "idle" || step === "parsing") && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FileDropzone
                  label="Cash_History.csv"
                  file={cashFile}
                  onFile={setCashFile}
                />
                <FileDropzone
                  label="Orders.csv"
                  file={ordersFile}
                  onFile={setOrdersFile}
                />
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Cash_History.csv</span> — provides verified P&amp;L
                  and fee breakdown per trade (source of truth).
                </p>
                <p>
                  <span className="font-medium">Orders.csv</span> — provides fill prices, direction,
                  and entry timestamps.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleParse}
                  disabled={!cashFile || !ordersFile || step === "parsing"}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {step === "parsing" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {step === "parsing" ? "Parsing…" : "Parse & Preview"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: preview ── */}
          {step === "preview" && (
            <div className="space-y-4">

              {/* Reconciliation banner */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Trades",      value: preview.length.toString(),   color: "" },
                  { label: "Gross P&L",   value: fmt$(totalGross),            color: totalGross >= 0 ? "text-emerald-600" : "text-red-600" },
                  { label: "Total Fees",  value: fmt$(totalFees),             color: "text-muted-foreground" },
                  { label: "Net P&L",     value: fmt$(totalNet),              color: totalNet   >= 0 ? "text-emerald-600" : "text-red-600" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-lg border bg-muted/30 px-4 py-3 text-center"
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={cn("text-lg font-semibold tabular-nums mt-0.5", color)}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Duplicate warning */}
              {dupCount !== null && dupCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium">{dupCount}</span> trade{dupCount !== 1 ? "s" : ""} already exist
                    in the database and will be skipped.
                  </span>
                </div>
              )}

              {/* Date-grouped collapsible sections */}
              <div className="rounded-lg border overflow-hidden divide-y">
                {byDate.map(([date, dayTrades]) => {
                  const dayGross = dayTrades.reduce((s, t) => s + t.gross_pnl,  0);
                  const dayFees  = dayTrades.reduce((s, t) => s + t.total_fees, 0);
                  const dayNet   = dayTrades.reduce((s, t) => s + t.net_pnl,    0);
                  const collapsed = collapsedDates.has(date);

                  return (
                    <div key={date}>
                      {/* Date header */}
                      <button
                        onClick={() => toggleDate(date)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {collapsed
                            ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown  className="h-4 w-4 text-muted-foreground" />
                          }
                          <span className="font-medium">{date}</span>
                          <span className="text-xs text-muted-foreground">
                            {dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-5 text-xs tabular-nums">
                          <span className="text-muted-foreground">
                            Gross: <span className={cn("font-medium", dayGross >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt$(dayGross)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Fees: <span className="font-medium">{fmt$(dayFees)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Net: <span className={cn("font-semibold", dayNet >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt$(dayNet)}</span>
                          </span>
                        </div>
                      </button>

                      {/* Trades table for this date */}
                      {!collapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/20">
                                {["Time", "Instrument", "Dir", "Qty", "Entry", "Exit",
                                  "Gross P/L", "Fees", "Net P/L", "Session"].map((h) => (
                                  <th
                                    key={h}
                                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {dayTrades.map((t, idx) => (
                                <tr
                                  key={`${t.exit_time_iso}-${idx}`}
                                  className={cn(
                                    "border-t last:border-0",
                                    t.net_pnl > 0
                                      ? "bg-emerald-500/5"
                                      : t.net_pnl < 0
                                      ? "bg-red-500/5"
                                      : idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                                  )}
                                >
                                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                    {fmtTime(t.exit_time_iso)}
                                  </td>
                                  <td className="px-3 py-2 font-medium">{t.instrument}</td>
                                  <td className="px-3 py-2">
                                    <span className={cn(
                                      "rounded-full px-2 py-0.5 text-xs font-medium",
                                      t.direction === "long"
                                        ? "bg-emerald-500/15 text-emerald-600"
                                        : "bg-red-500/15 text-red-600"
                                    )}>
                                      {t.direction === "long" ? "L" : "S"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 tabular-nums">{t.qty}</td>
                                  <td className="px-3 py-2 tabular-nums text-xs">
                                    {t.entry_price != null
                                      ? t.entry_price.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 tabular-nums text-xs">
                                    {t.exit_price != null
                                      ? t.exit_price.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                      : "—"}
                                  </td>
                                  <td className={cn(
                                    "px-3 py-2 tabular-nums text-xs",
                                    t.gross_pnl >= 0 ? "text-emerald-600" : "text-red-600"
                                  )}>
                                    {fmt$(t.gross_pnl)}
                                  </td>
                                  <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                                    {fmt$(t.total_fees)}
                                  </td>
                                  <td className={cn(
                                    "px-3 py-2 tabular-nums text-xs font-medium",
                                    t.net_pnl >= 0 ? "text-emerald-600" : "text-red-600"
                                  )}>
                                    {fmt$(t.net_pnl)}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap capitalize">
                                    {t.session.replace(/_/g, " ")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                        <label className="text-sm text-muted-foreground whitespace-nowrap">Account</label>
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
                        <label className="text-sm text-muted-foreground whitespace-nowrap">Strategy</label>
                        <select
                          value={selectedStrategyId}
                          onChange={(e) => setSelectedStrategyId(e.target.value)}
                          className="rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">None</option>
                          {strategies.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step: importing ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Saving trades…</p>
            </div>
          )}

          {/* ── Step: done ── */}
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
          {(step === "idle" || step === "parsing") && (
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
                onClick={() => { setStep("idle"); setPreview([]); setDupCount(null); }}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Import {preview.length} trade{preview.length !== 1 ? "s" : ""}
                {dupCount !== null && dupCount > 0 && ` (${dupCount} will be skipped)`}
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
