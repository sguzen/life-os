"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { debtSchema, type DebtFormValues } from "@/lib/validations/finance";
import type { Debt } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DebtFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt;
  onSubmit: (data: DebtFormValues) => Promise<void>;
}

const defaultValues: DebtFormValues = {
  name: "",
  total_amount: 0,
  current_balance: 0,
  interest_rate: 0,
  minimum_payment: 0,
  due_day: null,
  notes: null,
  is_paid_off: false,
};

function fromDebt(debt: Debt): DebtFormValues {
  return {
    name: debt.name,
    total_amount: debt.total_amount,
    current_balance: debt.current_balance,
    interest_rate: debt.interest_rate,
    minimum_payment: debt.minimum_payment,
    due_day: debt.due_day,
    notes: debt.notes,
    is_paid_off: debt.is_paid_off,
  };
}

export function DebtForm({ open, onOpenChange, debt, onSubmit }: DebtFormProps) {
  const [form, setForm] = useState<DebtFormValues>(
    debt ? fromDebt(debt) : defaultValues
  );
  const [errors, setErrors] = useState<Partial<Record<keyof DebtFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(val: boolean) {
    if (val) {
      setForm(debt ? fromDebt(debt) : defaultValues);
      setErrors({});
    }
    onOpenChange(val);
  }

  function numericField(value: string): number | null {
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = debtSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof DebtFormValues;
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              {debt ? "Edit debt" : "Add debt"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="debt-name">
                Name
              </label>
              <input
                id="debt-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Credit Card, Student Loan"
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                  errors.name && "border-destructive"
                )}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Total / Balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="total-amount">
                  Original total ($)
                </label>
                <input
                  id="total-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.total_amount || ""}
                  onChange={(e) =>
                    setForm({ ...form, total_amount: numericField(e.target.value) ?? 0 })
                  }
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.total_amount && "border-destructive"
                  )}
                />
                {errors.total_amount && (
                  <p className="text-xs text-destructive">{errors.total_amount}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="current-balance">
                  Current balance ($)
                </label>
                <input
                  id="current-balance"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.current_balance || ""}
                  onChange={(e) =>
                    setForm({ ...form, current_balance: numericField(e.target.value) ?? 0 })
                  }
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.current_balance && "border-destructive"
                  )}
                />
                {errors.current_balance && (
                  <p className="text-xs text-destructive">{errors.current_balance}</p>
                )}
              </div>
            </div>

            {/* Interest / Min Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="interest-rate">
                  Interest rate (%)
                </label>
                <input
                  id="interest-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.interest_rate || ""}
                  onChange={(e) =>
                    setForm({ ...form, interest_rate: numericField(e.target.value) ?? 0 })
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="min-payment">
                  Min payment ($/mo)
                </label>
                <input
                  id="min-payment"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.minimum_payment || ""}
                  onChange={(e) =>
                    setForm({ ...form, minimum_payment: numericField(e.target.value) ?? 0 })
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Due Day */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="due-day">
                Due day of month{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <input
                id="due-day"
                type="number"
                min={1}
                max={31}
                value={form.due_day ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    due_day: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g. 15"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="debt-notes">
                Notes{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="debt-notes"
                value={form.notes ?? ""}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value || null })
                }
                rows={2}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Paid off toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_paid_off}
                onChange={(e) => setForm({ ...form, is_paid_off: e.target.checked })}
                className="h-4 w-4 rounded border"
              />
              Mark as paid off
            </label>

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
                {submitting ? "Saving…" : debt ? "Save changes" : "Add debt"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
