"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  monthlyExpenseSchema,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type MonthlyExpenseFormValues,
} from "@/lib/validations/finance";
import type { MonthlyExpense } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: MonthlyExpense;
  onSubmit: (data: MonthlyExpenseFormValues) => Promise<void>;
}

const defaultValues: MonthlyExpenseFormValues = {
  name: "",
  amount: 0,
  category: "other",
  due_day: null,
  is_recurring: true,
  notes: null,
};

function fromExpense(e: MonthlyExpense): MonthlyExpenseFormValues {
  return {
    name: e.name,
    amount: e.amount,
    category: e.category,
    due_day: e.due_day,
    is_recurring: e.is_recurring,
    notes: e.notes,
  };
}

export function ExpenseForm({
  open,
  onOpenChange,
  expense,
  onSubmit,
}: ExpenseFormProps) {
  const [form, setForm] = useState<MonthlyExpenseFormValues>(
    expense ? fromExpense(expense) : defaultValues
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof MonthlyExpenseFormValues, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(expense ? fromExpense(expense) : defaultValues);
      setErrors({});
    }
  }, [open, expense]);

  function handleOpenChange(val: boolean) {
    onOpenChange(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = monthlyExpenseSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof MonthlyExpenseFormValues;
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
              {expense ? "Edit expense" : "Add expense"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="exp-name">
                Name
              </label>
              <input
                id="exp-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Rent, Netflix, Car insurance"
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                  errors.name && "border-destructive"
                )}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Amount + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="exp-amount">
                  Amount ($/mo)
                </label>
                <input
                  id="exp-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount: parseFloat(e.target.value) || 0,
                    })
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
                <label className="text-sm font-medium" htmlFor="exp-category">
                  Category
                </label>
                <select
                  id="exp-category"
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as MonthlyExpenseFormValues["category"],
                    })
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due day */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="exp-due-day">
                Due day of month{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <input
                id="exp-due-day"
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
                placeholder="e.g. 1"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="exp-notes">
                Notes{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="exp-notes"
                value={form.notes ?? ""}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value || null })
                }
                rows={2}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Recurring toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) =>
                  setForm({ ...form, is_recurring: e.target.checked })
                }
                className="h-4 w-4 rounded border"
              />
              Recurring monthly expense
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
                {submitting
                  ? "Saving…"
                  : expense
                  ? "Save changes"
                  : "Add expense"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
