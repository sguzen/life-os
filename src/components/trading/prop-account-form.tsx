"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import {
  propAccountSchema,
  type PropAccountFormValues,
  PROP_FIRMS,
  PROP_FIRM_LABELS,
} from "@/lib/validations/trading";
import { createPropAccount, updatePropAccount } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type { PropAccount } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (account: PropAccount) => void;
  initial?: PropAccount;
}

type FormErrors = Partial<Record<keyof PropAccountFormValues, string>>;

function emptyForm(): PropAccountFormValues {
  return {
    firm: "FundedNext",
    account_label: "",
    account_size: 0,
    balance: null,
    daily_loss_limit: null,
    max_drawdown: null,
    profit_target: null,
    is_active: true,
    is_funded: false,
    notes: null,
  };
}

function fromAccount(a: PropAccount): PropAccountFormValues {
  return {
    firm: a.firm,
    account_label: a.account_label,
    account_size: a.account_size,
    balance: a.balance,
    daily_loss_limit: a.daily_loss_limit,
    max_drawdown: a.max_drawdown,
    profit_target: a.profit_target,
    is_active: a.is_active,
    is_funded: a.is_funded,
    notes: a.notes,
  };
}

export function PropAccountForm({ open, onClose, onSaved, initial }: Props) {
  const [form, setForm] = useState<PropAccountFormValues>(
    initial ? fromAccount(initial) : emptyForm()
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleOpen(val: boolean) {
    if (val) {
      setForm(initial ? fromAccount(initial) : emptyForm());
      setErrors({});
      setServerError(null);
    }
    if (!val) onClose();
  }

  function numOrNull(val: string): number | null {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const result = propAccountSchema.safeParse(form);
    if (!result.success) {
      const fe: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PropAccountFormValues;
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
        balance: d.balance ?? null,
        daily_loss_limit: d.daily_loss_limit ?? null,
        max_drawdown: d.max_drawdown ?? null,
        profit_target: d.profit_target ?? null,
        notes: d.notes ?? null,
      }
      const saved = initial
        ? await updatePropAccount(initial.id, payload)
        : await createPropAccount(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (err?: string) =>
    cn(
      "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
      err && "border-destructive"
    );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              {initial ? "Edit Account" : "Add Prop Account"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Firm */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Prop Firm</label>
              <select
                value={form.firm}
                onChange={(e) => setForm({ ...form, firm: e.target.value as PropAccountFormValues["firm"] })}
                className={inputCls(errors.firm)}
              >
                {PROP_FIRMS.map((f) => (
                  <option key={f} value={f}>{PROP_FIRM_LABELS[f]}</option>
                ))}
              </select>
              {errors.firm && <p className="text-xs text-destructive">{errors.firm}</p>}
            </div>

            {/* Label */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Account Label</label>
              <input
                type="text"
                value={form.account_label}
                onChange={(e) => setForm({ ...form, account_label: e.target.value })}
                placeholder="e.g. 100K Evaluation #1"
                className={inputCls(errors.account_label)}
              />
              {errors.account_label && (
                <p className="text-xs text-destructive">{errors.account_label}</p>
              )}
            </div>

            {/* Size + Balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Account Size ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.account_size || ""}
                  onChange={(e) => setForm({ ...form, account_size: parseFloat(e.target.value) || 0 })}
                  placeholder="100000"
                  className={inputCls(errors.account_size)}
                />
                {errors.account_size && (
                  <p className="text-xs text-destructive">{errors.account_size}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Current Balance ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.balance ?? ""}
                  onChange={(e) => setForm({ ...form, balance: numOrNull(e.target.value) })}
                  placeholder="Optional"
                  className={inputCls()}
                />
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Daily Loss Limit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.daily_loss_limit ?? ""}
                  onChange={(e) => setForm({ ...form, daily_loss_limit: numOrNull(e.target.value) })}
                  placeholder="Optional"
                  className={inputCls()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Max Drawdown ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.max_drawdown ?? ""}
                  onChange={(e) => setForm({ ...form, max_drawdown: numOrNull(e.target.value) })}
                  placeholder="Optional"
                  className={inputCls()}
                />
              </div>
            </div>

            {/* Profit Target */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Profit Target ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.profit_target ?? ""}
                onChange={(e) => setForm({ ...form, profit_target: numOrNull(e.target.value) })}
                placeholder="Optional"
                className={inputCls()}
              />
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.is_funded}
                  onChange={(e) => setForm({ ...form, is_funded: e.target.checked })}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Funded Account
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Active
              </label>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Notes <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                rows={3}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

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
