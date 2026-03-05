"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect, useRef, useCallback } from "react";
import { X, Upload, Loader2, ImageIcon, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  tradeSchema,
  type TradeFormValues,
  INSTRUMENTS,
  TRADE_DIRECTIONS,
  TRADE_OUTCOMES,
  TRADING_SESSIONS,
  INSTRUMENT_LABELS,
  SESSION_LABELS,
} from "@/lib/validations/trading";
import { createTrade, updateTrade } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type { Trade, PropAccount, Strategy } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (trade: Trade) => void;
  initial?: Trade;
  propAccounts: PropAccount[];
  strategies: Strategy[];
}

type FormErrors = Partial<Record<keyof TradeFormValues | string, string>>;

const SETUP_TAG_SUGGESTIONS = [
  "OB", "FVG", "BOS", "CHOCH", "MSS", "PDH", "PDL", "EQH", "EQL",
  "Breaker", "Mitigation", "Liquidity", "Imbalance", "SNR", "VWAP",
];

// --- AI extraction types ---
type AiField<T> = { value: T | null; confidence: number };

interface AiExtractionResult {
  instrument: AiField<TradeFormValues["instrument"]>;
  direction: AiField<TradeFormValues["direction"]>;
  entry_price: AiField<number>;
  exit_price: AiField<number>;
  session: AiField<TradeFormValues["session"]>;
}

// Map of field key → confidence score for AI-filled fields
type AiConfidenceMap = Partial<Record<string, number>>;

// --- Helpers ---
function toLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToISO(val: string): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}

function emptyForm(): TradeFormValues {
  return {
    instrument: "NQ",
    direction: "long",
    entry_price: 0,
    exit_price: null,
    contracts: 1,
    entry_time: new Date().toISOString(),
    exit_time: null,
    gross_pnl: null,
    fees: 0,
    outcome: "open",
    prop_account_id: null,
    strategy_id: null,
    session: null,
    setup_tags: [],
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

function fromTrade(t: Trade): TradeFormValues {
  return {
    instrument: t.instrument,
    direction: t.direction,
    entry_price: t.entry_price,
    exit_price: t.exit_price,
    contracts: t.contracts,
    entry_time: t.entry_time,
    exit_time: t.exit_time,
    gross_pnl: t.gross_pnl,
    fees: t.fees,
    outcome: t.outcome,
    prop_account_id: t.prop_account_id,
    strategy_id: t.strategy_id,
    session: t.session,
    setup_tags: t.setup_tags ?? [],
    confluence_notes: t.confluence_notes,
    entry_notes: t.entry_notes,
    exit_notes: t.exit_notes,
    lessons: t.lessons,
    screenshots: t.screenshots,
    pre_emotion: t.pre_emotion,
    post_emotion: t.post_emotion,
    followed_rules: t.followed_rules,
    is_reviewed: t.is_reviewed,
  };
}

// Confidence badge shown next to field labels for AI-extracted values
function ConfBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null;
  if (confidence >= 0.8) {
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        AI {Math.round(confidence * 100)}%
      </span>
    );
  }
  if (confidence >= 0.5) {
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <AlertTriangle className="h-2.5 w-2.5" />
        AI ~{Math.round(confidence * 100)}%
      </span>
    );
  }
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <AlertTriangle className="h-2.5 w-2.5" />
      AI ?{Math.round(confidence * 100)}%
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function TradeForm({ open, onClose, onSaved, initial, propAccounts, strategies }: Props) {
  const [form, setForm] = useState<TradeFormValues>(initial ? fromTrade(initial) : emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [activeTab, setActiveTab] = useState<"execution" | "context" | "review">("execution");

  // Screenshot / AI state
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiExtractionResult | null>(null);
  const [aiConfidence, setAiConfidence] = useState<AiConfidenceMap>({});
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? fromTrade(initial) : emptyForm());
      setErrors({});
      setServerError(null);
      setTagInput("");
      setActiveTab("execution");
      setScreenshotPreview(null);
      setAnalyzing(false);
      setAnalysisError(null);
      setAiResult(null);
      setAiConfidence({});
    }
  }, [open, initial]);

  function handleOpen(val: boolean) {
    if (!val) onClose();
  }

  // ── Screenshot handling ─────────────────────────────────────────────────
  const analyzeScreenshot = useCallback(async (file: File) => {
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setAnalyzing(true);
    setAnalysisError(null);
    setAiResult(null);
    setAiConfidence({});

    try {
      const fd = new FormData();
      fd.append("screenshot", file);
      const res = await fetch("/api/ai/screenshot-analysis", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Analysis failed");
      }
      const data: AiExtractionResult = await res.json();
      setAiResult(data);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) analyzeScreenshot(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) analyzeScreenshot(file);
  }

  function applyAiExtraction() {
    if (!aiResult) return;
    const updates: Partial<TradeFormValues> = {};
    const conf: AiConfidenceMap = {};

    if (aiResult.instrument.value !== null) {
      updates.instrument = aiResult.instrument.value;
      conf.instrument = aiResult.instrument.confidence;
    }
    if (aiResult.direction.value !== null) {
      updates.direction = aiResult.direction.value;
      conf.direction = aiResult.direction.confidence;
    }
    if (aiResult.entry_price.value !== null) {
      updates.entry_price = aiResult.entry_price.value;
      conf.entry_price = aiResult.entry_price.confidence;
    }
    if (aiResult.exit_price.value !== null) {
      updates.exit_price = aiResult.exit_price.value;
      conf.exit_price = aiResult.exit_price.confidence;
    }
    if (aiResult.session.value !== null) {
      updates.session = aiResult.session.value;
      conf.session = aiResult.session.confidence;
    }

    setForm((f) => ({ ...f, ...updates }));
    setAiConfidence(conf);
    setAiResult(null); // dismiss the result card once applied
    setActiveTab("execution");
  }

  function dismissAi() {
    setAiResult(null);
    setScreenshotPreview(null);
    setAnalysisError(null);
    setAiConfidence({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Form helpers ─────────────────────────────────────────────────────────
  function toggleSetupTag(tag: string) {
    const cur = form.setup_tags ?? [];
    setForm({
      ...form,
      setup_tags: cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    });
  }

  function addCustomTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim().toUpperCase();
      if (tag && !(form.setup_tags ?? []).includes(tag)) {
        setForm({ ...form, setup_tags: [...(form.setup_tags ?? []), tag] });
      }
      setTagInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const result = tradeSchema.safeParse(form);
    if (!result.success) {
      const fe: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        fe[key] = issue.message;
      }
      setErrors(fe);
      const executionFields = ["instrument", "direction", "entry_price", "exit_price", "contracts", "entry_time", "exit_time", "gross_pnl", "fees", "outcome"];
      const hasExecError = Object.keys(fe).some((k) => executionFields.includes(k));
      if (hasExecError) setActiveTab("execution");
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = Object.fromEntries(
        Object.entries(result.data).map(([k, v]) => [k, v === undefined ? null : v])
      );
      const saved = initial
        ? await updateTrade(initial.id, payload)
        : await createTrade(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save trade");
    } finally {
      setSaving(false);
    }
  }

  // Input class — adds a coloured ring when the field was AI-filled
  const inputCls = (field?: string, err?: string) =>
    cn(
      "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
      err && "border-destructive",
      field && aiConfidence[field] !== undefined && (
        aiConfidence[field]! >= 0.8
          ? "ring-1 ring-emerald-400"
          : aiConfidence[field]! >= 0.5
          ? "ring-1 ring-amber-400"
          : "ring-1 ring-red-400"
      )
    );

  const tabs = [
    { id: "execution" as const, label: "Execution" },
    { id: "context" as const, label: "Context" },
    { id: "review" as const, label: "Review" },
  ];

  // Summarise what Gemini found for the result card
  function aiSummaryItems() {
    if (!aiResult) return [];
    const items: Array<{ label: string; display: string; confidence: number }> = [];
    if (aiResult.instrument.value)
      items.push({ label: "Instrument", display: INSTRUMENT_LABELS[aiResult.instrument.value] ?? aiResult.instrument.value, confidence: aiResult.instrument.confidence });
    if (aiResult.direction.value)
      items.push({ label: "Direction", display: aiResult.direction.value === "long" ? "▲ Long" : "▼ Short", confidence: aiResult.direction.confidence });
    if (aiResult.entry_price.value !== null)
      items.push({ label: "Entry", display: aiResult.entry_price.value.toString(), confidence: aiResult.entry_price.confidence });
    if (aiResult.exit_price.value !== null)
      items.push({ label: "Exit", display: aiResult.exit_price.value.toString(), confidence: aiResult.exit_price.confidence });
    if (aiResult.session.value)
      items.push({ label: "Session", display: SESSION_LABELS[aiResult.session.value] ?? aiResult.session.value, confidence: aiResult.session.confidence });
    return items;
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card shadow-xl">

          {/* ── Dialog Header ── */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
            <Dialog.Title className="text-lg font-semibold">
              {initial ? "Edit Trade" : "Log New Trade"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* ── Screenshot AI Scanner ── */}
          <div className="px-6 py-3 border-b bg-muted/20">
            {/* Drop zone — shown when no screenshot yet */}
            {!screenshotPreview && !analyzing && (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors",
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Drop a chart screenshot</span>{" "}
                    or click to browse — Gemini Vision will auto-fill the form
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            )}

            {/* Analyzing spinner */}
            {analyzing && (
              <div className="flex items-center gap-3 py-2">
                {screenshotPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={screenshotPreview} alt="Chart preview" className="h-12 w-20 rounded object-cover border" />
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Analyzing chart with Gemini Vision…
                </div>
              </div>
            )}

            {/* Analysis error */}
            {analysisError && !analyzing && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
                <p className="text-sm text-destructive">{analysisError}</p>
                <button type="button" onClick={dismissAi} className="text-xs text-muted-foreground hover:text-foreground">
                  Dismiss
                </button>
              </div>
            )}

            {/* AI Extraction Result card */}
            {aiResult && !analyzing && (
              <div className="flex gap-3">
                {screenshotPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={screenshotPreview} alt="Chart preview" className="h-16 w-24 shrink-0 rounded object-cover border" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">Gemini Vision extracted</span>
                  </div>
                  {aiSummaryItems().length === 0 ? (
                    <p className="text-sm text-muted-foreground">No trade details could be extracted from this image.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {aiSummaryItems().map(({ label, display, confidence }) => (
                        <span key={label} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs">
                          <span className="text-muted-foreground">{label}:</span>
                          <span className="font-medium">{display}</span>
                          {confidence >= 0.8 ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          ) : confidence >= 0.5 ? (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                          <span className={cn(
                            "text-[10px]",
                            confidence >= 0.8 ? "text-emerald-600" : confidence >= 0.5 ? "text-amber-600" : "text-red-600"
                          )}>
                            {Math.round(confidence * 100)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {aiSummaryItems().length > 0 && (
                      <button
                        type="button"
                        onClick={applyAiExtraction}
                        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Apply to form
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={dismissAi}
                      className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                    >
                      Dismiss
                    </button>
                    {aiSummaryItems().some((i) => i.confidence < 0.8) && (
                      <span className="text-xs text-muted-foreground">
                        <AlertTriangle className="inline h-3 w-3 text-amber-500 mr-0.5" />
                        Review low-confidence fields before saving
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Screenshot preview (after applying, compact) */}
            {screenshotPreview && !aiResult && !analyzing && !analysisError && (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshotPreview} alt="Chart preview" className="h-10 w-16 rounded object-cover border" />
                <span className="text-xs text-muted-foreground flex-1">
                  {Object.keys(aiConfidence).length > 0
                    ? `AI pre-filled ${Object.keys(aiConfidence).length} field(s) — review highlighted fields below`
                    : "Screenshot attached"}
                </span>
                <button type="button" onClick={dismissAi} className="text-xs text-muted-foreground hover:text-foreground">
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-0 border-b px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-6 py-5 space-y-4">

              {/* ──────────── EXECUTION TAB ──────────── */}
              {activeTab === "execution" && (
                <>
                  {/* Instrument + Direction */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">
                        Instrument
                        <ConfBadge confidence={aiConfidence.instrument} />
                      </label>
                      <select
                        value={form.instrument}
                        onChange={(e) => {
                          setForm({ ...form, instrument: e.target.value as TradeFormValues["instrument"] });
                          setAiConfidence((c) => { const n = { ...c }; delete n.instrument; return n; });
                        }}
                        className={inputCls("instrument", errors.instrument)}
                      >
                        {INSTRUMENTS.map((i) => (
                          <option key={i} value={i}>{INSTRUMENT_LABELS[i]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">
                        Direction
                        <ConfBadge confidence={aiConfidence.direction} />
                      </label>
                      <div className={cn(
                        "flex rounded-md overflow-hidden border",
                        aiConfidence.direction !== undefined && (
                          aiConfidence.direction >= 0.8 ? "ring-1 ring-emerald-400" :
                          aiConfidence.direction >= 0.5 ? "ring-1 ring-amber-400" : "ring-1 ring-red-400"
                        )
                      )}>
                        {TRADE_DIRECTIONS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setForm({ ...form, direction: d });
                              setAiConfidence((c) => { const n = { ...c }; delete n.direction; return n; });
                            }}
                            className={cn(
                              "flex-1 py-2 text-sm font-medium transition-colors",
                              form.direction === d
                                ? d === "long"
                                  ? "bg-emerald-500 text-white"
                                  : "bg-red-500 text-white"
                                : "hover:bg-accent"
                            )}
                          >
                            {d === "long" ? "▲ Long" : "▼ Short"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Entry + Exit prices */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">
                        Entry Price
                        <ConfBadge confidence={aiConfidence.entry_price} />
                      </label>
                      <input
                        type="number"
                        step="0.00001"
                        value={form.entry_price || ""}
                        onChange={(e) => {
                          setForm({ ...form, entry_price: parseFloat(e.target.value) || 0 });
                          setAiConfidence((c) => { const n = { ...c }; delete n.entry_price; return n; });
                        }}
                        placeholder="0.00"
                        className={inputCls("entry_price", errors.entry_price)}
                      />
                      {errors.entry_price && <p className="text-xs text-destructive">{errors.entry_price}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">
                        Exit Price
                        <ConfBadge confidence={aiConfidence.exit_price} />
                      </label>
                      <input
                        type="number"
                        step="0.00001"
                        value={form.exit_price ?? ""}
                        onChange={(e) => {
                          setForm({ ...form, exit_price: e.target.value ? parseFloat(e.target.value) : null });
                          setAiConfidence((c) => { const n = { ...c }; delete n.exit_price; return n; });
                        }}
                        placeholder="Optional"
                        className={inputCls("exit_price", errors.exit_price)}
                      />
                    </div>
                  </div>

                  {/* Contracts + Fees */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Contracts</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={form.contracts || ""}
                        onChange={(e) => setForm({ ...form, contracts: parseFloat(e.target.value) || 1 })}
                        className={inputCls(undefined, errors.contracts)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Fees ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.fees || ""}
                        onChange={(e) => setForm({ ...form, fees: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className={inputCls()}
                      />
                    </div>
                  </div>

                  {/* Entry + Exit times */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Entry Time</label>
                      <input
                        type="datetime-local"
                        defaultValue={toLocalDateTimeInput(form.entry_time)}
                        onChange={(e) => setForm({ ...form, entry_time: localInputToISO(e.target.value) ?? new Date().toISOString() })}
                        className={inputCls(undefined, errors.entry_time)}
                      />
                      {errors.entry_time && <p className="text-xs text-destructive">{errors.entry_time}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Exit Time</label>
                      <input
                        type="datetime-local"
                        defaultValue={toLocalDateTimeInput(form.exit_time)}
                        onChange={(e) => setForm({ ...form, exit_time: localInputToISO(e.target.value) })}
                        className={inputCls()}
                      />
                    </div>
                  </div>

                  {/* Gross P&L */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Gross P&L ($) <span className="text-xs text-muted-foreground">(before fees)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.gross_pnl ?? ""}
                      onChange={(e) => setForm({ ...form, gross_pnl: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="e.g. 250.00 or -125.00"
                      className={inputCls()}
                    />
                    {form.gross_pnl != null && form.fees > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Net P&L: {(form.gross_pnl - form.fees).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Outcome */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Outcome</label>
                    <div className="flex gap-2">
                      {TRADE_OUTCOMES.map((o) => {
                        const colors: Record<string, string> = {
                          win: "bg-emerald-500 text-white",
                          loss: "bg-red-500 text-white",
                          break_even: "bg-amber-500 text-white",
                          open: "bg-blue-500 text-white",
                        };
                        const labels: Record<string, string> = {
                          win: "Win", loss: "Loss", break_even: "B/E", open: "Open",
                        };
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setForm({ ...form, outcome: o })}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-sm font-medium border transition-colors",
                              form.outcome === o ? colors[o] : "hover:bg-accent border-border"
                            )}
                          >
                            {labels[o]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Session + Prop Account */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">
                        Session
                        <ConfBadge confidence={aiConfidence.session} />
                      </label>
                      <select
                        value={form.session ?? ""}
                        onChange={(e) => {
                          setForm({ ...form, session: (e.target.value as TradeFormValues["session"]) || null });
                          setAiConfidence((c) => { const n = { ...c }; delete n.session; return n; });
                        }}
                        className={inputCls("session")}
                      >
                        <option value="">— None —</option>
                        {TRADING_SESSIONS.map((s) => (
                          <option key={s} value={s}>{SESSION_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Prop Account</label>
                      <select
                        value={form.prop_account_id ?? ""}
                        onChange={(e) => setForm({ ...form, prop_account_id: e.target.value || null })}
                        className={inputCls()}
                      >
                        <option value="">— None —</option>
                        {propAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.account_label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Strategy */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Strategy</label>
                    <select
                      value={form.strategy_id ?? ""}
                      onChange={(e) => setForm({ ...form, strategy_id: e.target.value || null })}
                      className={inputCls()}
                    >
                      <option value="">— None —</option>
                      {strategies.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* ──────────── CONTEXT TAB ──────────── */}
              {activeTab === "context" && (
                <>
                  {/* Setup Tags */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Setup Tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SETUP_TAG_SUGGESTIONS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleSetupTag(tag)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                            (form.setup_tags ?? []).includes(tag)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={addCustomTag}
                      placeholder="Custom tag (Enter to add)…"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    {(form.setup_tags ?? []).filter((t) => !SETUP_TAG_SUGGESTIONS.includes(t)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(form.setup_tags ?? [])
                          .filter((t) => !SETUP_TAG_SUGGESTIONS.includes(t))
                          .map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => toggleSetupTag(tag)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Confluence Notes */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Confluence Notes</label>
                    <textarea
                      value={form.confluence_notes ?? ""}
                      onChange={(e) => setForm({ ...form, confluence_notes: e.target.value || null })}
                      rows={3}
                      placeholder="What lined up for this trade? (HTF bias, key levels…)"
                      className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Entry Notes */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Entry Notes</label>
                    <textarea
                      value={form.entry_notes ?? ""}
                      onChange={(e) => setForm({ ...form, entry_notes: e.target.value || null })}
                      rows={3}
                      placeholder="Why did you enter here?"
                      className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Exit Notes */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Exit Notes</label>
                    <textarea
                      value={form.exit_notes ?? ""}
                      onChange={(e) => setForm({ ...form, exit_notes: e.target.value || null })}
                      rows={3}
                      placeholder="Why did you exit here? Target hit, SL hit, manual exit…"
                      className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Pre/Post Emotion */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Pre-Trade Emotion</label>
                      <input
                        type="text"
                        value={form.pre_emotion ?? ""}
                        onChange={(e) => setForm({ ...form, pre_emotion: e.target.value || null })}
                        placeholder="e.g. Confident, Anxious…"
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Post-Trade Emotion</label>
                      <input
                        type="text"
                        value={form.post_emotion ?? ""}
                        onChange={(e) => setForm({ ...form, post_emotion: e.target.value || null })}
                        placeholder="e.g. Calm, Frustrated…"
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ──────────── REVIEW TAB ──────────── */}
              {activeTab === "review" && (
                <>
                  {/* Lessons */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Lessons Learned</label>
                    <textarea
                      value={form.lessons ?? ""}
                      onChange={(e) => setForm({ ...form, lessons: e.target.value || null })}
                      rows={5}
                      placeholder="What did this trade teach you? What would you do differently?"
                      className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Followed Rules */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Did you follow your strategy rules?</label>
                    <div className="flex gap-2">
                      {[
                        { val: true, label: "✓ Yes" },
                        { val: false, label: "✗ No" },
                        { val: null, label: "— N/A" },
                      ].map(({ val, label }) => (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => setForm({ ...form, followed_rules: val })}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                            form.followed_rules === val
                              ? val === true
                                ? "bg-emerald-500 text-white border-emerald-500"
                                : val === false
                                ? "bg-red-500 text-white border-red-500"
                                : "bg-muted border-border"
                              : "hover:bg-accent border-border"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reviewed flag */}
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_reviewed}
                      onChange={(e) => setForm({ ...form, is_reviewed: e.target.checked })}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    Mark as reviewed
                  </label>
                </>
              )}

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between gap-2 border-t px-6 py-4">
              <div className="flex gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-colors",
                      activeTab === tab.id ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : initial ? "Update Trade" : "Log Trade"}
                </button>
              </div>
            </div>
          </form>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
