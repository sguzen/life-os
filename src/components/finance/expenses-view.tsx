"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getMonthlyExpenses,
  createMonthlyExpense,
  updateMonthlyExpense,
  deleteMonthlyExpense,
} from "@/lib/supabase/finance";
import type { MonthlyExpense } from "@/lib/types";
import type { MonthlyExpenseFormValues } from "@/lib/validations/finance";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/validations/finance";
import { ExpenseForm } from "./expense-form";

interface ExpensesViewProps {
  initialExpenses: MonthlyExpense[];
  onExpensesChange?: (expenses: MonthlyExpense[]) => void;
}

export function ExpensesView({ initialExpenses, onExpensesChange }: ExpensesViewProps) {
  const [expenses, setExpenses] = useState<MonthlyExpense[]>(initialExpenses);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | undefined>();
  const supabase = createClient();

  function sync(updated: MonthlyExpense[]) {
    setExpenses(updated);
    onExpensesChange?.(updated);
  }

  async function refresh() {
    const fresh = await getMonthlyExpenses(supabase);
    sync(fresh);
  }

  async function handleCreate(data: MonthlyExpenseFormValues) {
    await createMonthlyExpense(supabase, data);
    await refresh();
  }

  async function handleEdit(data: MonthlyExpenseFormValues) {
    if (!editingExpense) return;
    await updateMonthlyExpense(supabase, editingExpense.id, data);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this expense?")) return;
    await deleteMonthlyExpense(supabase, id);
    sync(expenses.filter((e) => e.id !== id));
  }

  const totalMonthly = expenses.reduce((s, e) => s + e.amount, 0);

  // Group by category
  const grouped = expenses.reduce<Record<string, MonthlyExpense[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">
            ${totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            <span className="text-base font-normal text-muted-foreground">/mo</span>
          </p>
          <p className="text-xs text-muted-foreground">total monthly expenses</p>
        </div>
        <button
          onClick={() => {
            setEditingExpense(undefined);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add expense
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="font-medium">No expenses tracked yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your monthly expenses to see your net payout.
          </p>
          <button
            onClick={() => setFormOpen(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {EXPENSE_CATEGORY_LABELS[category] ?? category}
                </p>
                <p className="text-xs text-muted-foreground">
                  ${items.reduce((s, e) => s + e.amount, 0).toLocaleString()}/mo
                </p>
              </div>
              <div className="space-y-1.5">
                {items.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{expense.name}</p>
                      {expense.due_day && (
                        <p className="text-xs text-muted-foreground">
                          Due the {expense.due_day}
                          {ordinal(expense.due_day)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="tabular-nums text-sm font-medium">
                        ${expense.amount.toLocaleString()}
                      </p>
                      <button
                        onClick={() => {
                          setEditingExpense(expense);
                          setFormOpen(true);
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ExpenseForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingExpense(undefined);
        }}
        expense={editingExpense}
        onSubmit={editingExpense ? handleEdit : handleCreate}
      />
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
