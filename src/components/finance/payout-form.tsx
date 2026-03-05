"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  propPayoutSchema,
  PROP_FIRM_OPTIONS,
  type PropPayoutFormValues,
} from "@/lib/validations/finance";
import type { PropPayout } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PayoutFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payout?: PropPayout;
  onSubmit: (data: PropPayoutFormValues) => Promise<void>;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const defaultValues: PropPayoutFormValues = {
  firm_name: PROP_FIRM_OPTIONS[0],
  amount: 0,
  payout_date: todayStr(),
  notes: null,
};

function fromPayout(p: PropPayout): PropPayoutFormValues {
  return {
    firm_name: p.firm_name,
    amount: p.amount,
    payout_date: p.payout_date,
    notes: p.notes,
  };
}

export function PayoutForm({
  open,
  onOpenChange,
  payout,
  onSubmit,
}: PayoutFormProps) {
  const [form, setForm] = useState<PropPayoutFormValues>(
    payout ? fromPayout(payout) : defaultValues
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof PropPayoutFormValues, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(payout ? fromPayout(payout) : { ...defaultValues, payout_date: todayStr() });
      setErrors({});
    }
  }, [open, payout]);

  function handleOpenChange(val: boolean) {
    onOpenChange(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = propPayoutSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof PropPayoutFormValues;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              {payout ? "Edit payout" : "Log payout"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Firm */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="payout-firm">
                Prop firm
              </label>
              <select
                id="payout-firm"
                value={form.firm_name}
                onChange={(e) => setForm({ ...form, firm_name: e.target.value })}
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                  errors.firm_name && "border-destructive"
                )}
              >
                {PROP_FIRM_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              {errors.firm_name && (
                <p className="text-xs text-destructive">{errors.firm_name}</p>
              )}
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="payout-amount">
                  Amount ($)
                </label>
                <input
                  id="payout-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm({ ...form, amount: parseFloat(e.target.value) || 0 })
                  }
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.amount && "border-destructive"
                  )}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="payout-date">
                  Date
                </label>
                <input
                  id="payout-date"
                  type="date"
                  value={form.payout_date}
                  onChange={(e) =>
                    setForm({ ...form, payout_date: e.target.value })
                  }
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.payout_date && "border-destructive"
                  )}
                />
                {errors.payout_date && (
                  <p className="text-xs text-destructive">{errors.payout_date}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="payout-notes">
                Notes{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="payout-notes"
                value={form.notes ?? ""}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value || null })
                }
                rows={2}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

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
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting
                  ? "Saving…"
                  : payout
                  ? "Save changes"
                  : "Log payout"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
