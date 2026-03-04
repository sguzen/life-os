"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getPropPayouts,
  createPropPayout,
  updatePropPayout,
  deletePropPayout,
} from "@/lib/supabase/finance";
import type { PropPayout } from "@/lib/types";
import type { PropPayoutFormValues } from "@/lib/validations/finance";
import { PayoutForm } from "./payout-form";

interface PayoutsViewProps {
  initialPayouts: PropPayout[];
  onPayoutsChange?: (payouts: PropPayout[]) => void;
}

export function PayoutsView({ initialPayouts, onPayoutsChange }: PayoutsViewProps) {
  const [payouts, setPayouts] = useState<PropPayout[]>(initialPayouts);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPayout, setEditingPayout] = useState<PropPayout | undefined>();
  const supabase = createClient();

  function sync(updated: PropPayout[]) {
    setPayouts(updated);
    onPayoutsChange?.(updated);
  }

  async function refresh() {
    const fresh = await getPropPayouts(supabase);
    sync(fresh);
  }

  async function handleCreate(data: PropPayoutFormValues) {
    await createPropPayout(supabase, data);
    await refresh();
  }

  async function handleEdit(data: PropPayoutFormValues) {
    if (!editingPayout) return;
    await updatePropPayout(supabase, editingPayout.id, data);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payout record?")) return;
    await deletePropPayout(supabase, id);
    sync(payouts.filter((p) => p.id !== id));
  }

  // Summary stats
  const totalAll = payouts.reduce((s, p) => s + p.amount, 0);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recent = payouts.filter((p) => p.payout_date >= cutoffStr);
  const avgMonthly =
    recent.length > 0 ? recent.reduce((s, p) => s + p.amount, 0) / 3 : 0;

  // Group by month
  const grouped = payouts.reduce<Record<string, PropPayout[]>>((acc, p) => {
    const month = p.payout_date.slice(0, 7); // YYYY-MM
    if (!acc[month]) acc[month] = [];
    acc[month].push(p);
    return acc;
  }, {});

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-bold text-green-500">
              ${totalAll.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground">total payouts</p>
          </div>
          {avgMonthly > 0 && (
            <div>
              <p className="text-2xl font-bold">
                ${Math.round(avgMonthly).toLocaleString()}
                <span className="text-base font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-xs text-muted-foreground">avg (last 90 days)</p>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setEditingPayout(undefined);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Log payout
        </button>
      </div>

      {payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="font-medium">No payouts logged yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Log your prop firm payouts to track your income and project debt payoff.
          </p>
          <button
            onClick={() => setFormOpen(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Log payout
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {months.map((month) => {
            const items = grouped[month];
            const monthTotal = items.reduce((s, p) => s + p.amount, 0);
            const label = new Date(month + "-01").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            });

            return (
              <div key={month}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${monthTotal.toLocaleString()} total
                  </p>
                </div>
                <div className="space-y-1.5">
                  {items.map((payout) => (
                    <div
                      key={payout.id}
                      className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{payout.firm_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payout.payout_date + "T00:00:00").toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                          {payout.notes && ` · ${payout.notes}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="tabular-nums text-sm font-semibold text-green-500">
                          +${payout.amount.toLocaleString()}
                        </p>
                        <button
                          onClick={() => {
                            setEditingPayout(payout);
                            setFormOpen(true);
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(payout.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PayoutForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingPayout(undefined);
        }}
        payout={editingPayout}
        onSubmit={editingPayout ? handleEdit : handleCreate}
      />
    </div>
  );
}
