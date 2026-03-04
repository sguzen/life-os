"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getDebts,
  createDebt,
  updateDebt,
  deleteDebt,
} from "@/lib/supabase/finance";
import type { Debt } from "@/lib/types";
import type { DebtFormValues } from "@/lib/validations/finance";
import { DebtForm } from "./debt-form";
import { cn } from "@/lib/utils";

interface DebtsViewProps {
  initialDebts: Debt[];
  onDebtsChange?: (debts: Debt[]) => void;
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function DebtsView({ initialDebts, onDebtsChange }: DebtsViewProps) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>();
  const supabase = createClient();

  function sync(updated: Debt[]) {
    setDebts(updated);
    onDebtsChange?.(updated);
  }

  async function refresh() {
    const fresh = await getDebts(supabase);
    sync(fresh);
  }

  async function handleCreate(data: DebtFormValues) {
    await createDebt(supabase, data);
    await refresh();
  }

  async function handleEdit(data: DebtFormValues) {
    if (!editingDebt) return;
    await updateDebt(supabase, editingDebt.id, data);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this debt? This cannot be undone.")) return;
    await deleteDebt(supabase, id);
    sync(debts.filter((d) => d.id !== id));
  }

  async function handleTogglePaidOff(debt: Debt) {
    await updateDebt(supabase, debt.id, { is_paid_off: !debt.is_paid_off });
    await refresh();
  }

  const activeDebts = debts.filter((d) => !d.is_paid_off);
  const paidDebts = debts.filter((d) => d.is_paid_off);
  const totalBalance = activeDebts.reduce((s, d) => s + d.current_balance, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-destructive">
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-xs text-muted-foreground">total remaining balance</p>
        </div>
        <button
          onClick={() => {
            setEditingDebt(undefined);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add debt
        </button>
      </div>

      {/* Active debts */}
      {activeDebts.length === 0 && paidDebts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="font-medium">No debts tracked yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first debt to start tracking your payoff progress.
          </p>
          <button
            onClick={() => setFormOpen(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add debt
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeDebts.map((debt) => (
            <DebtRow
              key={debt.id}
              debt={debt}
              onEdit={() => {
                setEditingDebt(debt);
                setFormOpen(true);
              }}
              onDelete={() => handleDelete(debt.id)}
              onTogglePaidOff={() => handleTogglePaidOff(debt)}
            />
          ))}

          {paidDebts.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                {paidDebts.length} paid off
              </summary>
              <div className="mt-2 space-y-2">
                {paidDebts.map((debt) => (
                  <DebtRow
                    key={debt.id}
                    debt={debt}
                    onEdit={() => {
                      setEditingDebt(debt);
                      setFormOpen(true);
                    }}
                    onDelete={() => handleDelete(debt.id)}
                    onTogglePaidOff={() => handleTogglePaidOff(debt)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <DebtForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingDebt(undefined);
        }}
        debt={editingDebt}
        onSubmit={editingDebt ? handleEdit : handleCreate}
      />
    </div>
  );
}

function DebtRow({
  debt,
  onEdit,
  onDelete,
  onTogglePaidOff,
}: {
  debt: Debt;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaidOff: () => void;
}) {
  const progress =
    debt.total_amount > 0
      ? Math.max(0, Math.min(100, ((debt.total_amount - debt.current_balance) / debt.total_amount) * 100))
      : 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-opacity",
        debt.is_paid_off && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onTogglePaidOff}
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            title={debt.is_paid_off ? "Mark as active" : "Mark as paid off"}
          >
            {debt.is_paid_off ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </button>
          <div className="min-w-0">
            <p className="font-medium truncate">{debt.name}</p>
            {debt.interest_rate > 0 && (
              <p className="text-xs text-muted-foreground">
                {debt.interest_rate}% APR
                {debt.minimum_payment > 0 && ` · $${debt.minimum_payment}/mo min`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="text-right mr-2">
            <p className="font-semibold tabular-nums">
              ${debt.current_balance.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              of ${debt.total_amount.toLocaleString()}
            </p>
          </div>
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              debt.is_paid_off ? "bg-green-500" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground text-right">
          {Math.round(progress)}% paid
        </p>
      </div>
    </div>
  );
}
