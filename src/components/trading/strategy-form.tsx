"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import {
  strategySchema,
  type StrategyFormValues,
  INSTRUMENTS,
  INSTRUMENT_LABELS,
} from "@/lib/validations/trading";
import { createStrategy, updateStrategy } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type { Strategy } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (strategy: Strategy) => void;
  initial?: Strategy;
}

type FormErrors = Partial<Record<keyof StrategyFormValues, string>>;

function emptyForm(): StrategyFormValues {
  return {
    name: "",
    description: null,
    rules: null,
    instruments: [],
    timeframes: [],
    tags: [],
    is_active: true,
  };
}

function fromStrategy(s: Strategy): StrategyFormValues {
  return {
    name: s.name,
    description: s.description,
    rules: s.rules,
    instruments: s.instruments ?? [],
    timeframes: s.timeframes ?? [],
    tags: s.tags ?? [],
    is_active: s.is_active,
  };
}

const TIMEFRAME_OPTIONS = ["1m", "2m", "3m", "5m", "10m", "15m", "30m", "1h", "4h", "1D"];

export function StrategyForm({ open, onClose, onSaved, initial }: Props) {
  const [form, setForm] = useState<StrategyFormValues>(
    initial ? fromStrategy(initial) : emptyForm()
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  function handleOpen(val: boolean) {
    if (val) {
      setForm(initial ? fromStrategy(initial) : emptyForm());
      setErrors({});
      setServerError(null);
      setTagInput("");
    }
    if (!val) onClose();
  }

  function toggleInstrument(inst: string) {
    const cur = form.instruments ?? [];
    setForm({
      ...form,
      instruments: cur.includes(inst as StrategyFormValues["instruments"] extends (infer T)[] | null | undefined ? T : never)
        ? cur.filter((i) => i !== inst)
        : [...cur, inst as typeof cur[number]],
    });
  }

  function toggleTimeframe(tf: string) {
    const cur = form.timeframes ?? [];
    setForm({
      ...form,
      timeframes: cur.includes(tf) ? cur.filter((t) => t !== tf) : [...cur, tf],
    });
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag && !(form.tags ?? []).includes(tag)) {
        setForm({ ...form, tags: [...(form.tags ?? []), tag] });
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setForm({ ...form, tags: (form.tags ?? []).filter((t) => t !== tag) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const result = strategySchema.safeParse(form);
    if (!result.success) {
      const fe: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof StrategyFormValues;
        fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }

    setSaving(true);
    try {
      const d = result.data
      const payload = {
        ...d,
        description: d.description ?? null,
        rules: d.rules ?? null,
        instruments: d.instruments ?? null,
        timeframes: d.timeframes ?? null,
        tags: d.tags ?? null,
      }
      const saved = initial
        ? await updateStrategy(initial.id, payload)
        : await createStrategy(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save strategy");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (err?: string) =>
    cn(
      "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
      err && "border-destructive"
    );

  const instruments = form.instruments ?? [];
  const timeframes = form.timeframes ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              {initial ? "Edit Strategy" : "New Strategy"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Strategy Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. ICT Breaker Block"
                className={inputCls(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Description <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                rows={2}
                placeholder="Brief overview of the strategy…"
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Rules / Playbook */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Rules / Playbook <span className="text-xs text-muted-foreground">(optional, markdown)</span>
              </label>
              <textarea
                value={form.rules ?? ""}
                onChange={(e) => setForm({ ...form, rules: e.target.value || null })}
                rows={5}
                placeholder="1. Wait for market structure shift&#10;2. Identify order block&#10;3. Enter on retest…"
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Instruments */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Instruments</label>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTS.map((inst) => (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => toggleInstrument(inst)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      instruments.includes(inst as typeof instruments[number])
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {INSTRUMENT_LABELS[inst]}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Timeframes</label>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAME_OPTIONS.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => toggleTimeframe(tf)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      timeframes.includes(tf)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Tags <span className="text-xs text-muted-foreground">(press Enter or comma to add)</span>
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                placeholder="e.g. ICT, SMC, momentum…"
                className={inputCls()}
              />
              {(form.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(form.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Active */}
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Active
            </label>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <div className="flex justify-end gap-2 pt-2">
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
                {saving ? "Saving…" : initial ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
