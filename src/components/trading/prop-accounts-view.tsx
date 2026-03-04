"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { PropAccountForm } from "./prop-account-form";
import { deletePropAccount } from "@/lib/supabase/trading";
import { PROP_FIRM_LABELS } from "@/lib/validations/trading";
import { cn } from "@/lib/utils";
import type { PropAccount } from "@/lib/types";

interface Props {
  accounts: PropAccount[];
  onAccountsChange: (accounts: PropAccount[]) => void;
}

function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function progressPct(balance: number | null, size: number, target: number | null) {
  if (balance == null || target == null) return null;
  const gained = balance - size;
  return Math.max(0, Math.min(100, (gained / target) * 100));
}

export function PropAccountsView({ accounts, onAccountsChange }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PropAccount | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(account: PropAccount) {
    setEditing(account);
    setFormOpen(true);
  }

  function handleSaved(saved: PropAccount) {
    if (editing) {
      onAccountsChange(accounts.map((a) => (a.id === saved.id ? saved : a)));
    } else {
      onAccountsChange([saved, ...accounts]);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deletePropAccount(id);
      onAccountsChange(accounts.filter((a) => a.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Prop Accounts</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">No prop accounts yet.</p>
          <p className="text-xs mt-1">Add an account to track your funded challenges.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const pct = progressPct(account.balance, account.account_size, account.profit_target);
            return (
              <div
                key={account.id}
                className={cn(
                  "rounded-xl border bg-card p-4 space-y-3",
                  !account.is_active && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {PROP_FIRM_LABELS[account.firm]}
                    </p>
                    <p className="font-semibold truncate">{account.account_label}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {account.is_funded && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        Funded
                      </span>
                    )}
                    {!account.is_active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Inactive
                      </span>
                    )}
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="rounded-md p-1 text-muted-foreground hover:bg-accent">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                            <circle cx="4" cy="8" r="1.5" />
                            <circle cx="8" cy="8" r="1.5" />
                            <circle cx="12" cy="8" r="1.5" />
                          </svg>
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="z-50 min-w-[130px] rounded-lg border bg-card p-1 shadow-lg"
                          align="end"
                          sideOffset={4}
                        >
                          <DropdownMenu.Item
                            onClick={() => openEdit(account)}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent outline-none"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onClick={() => handleDelete(account.id)}
                            disabled={deleting === account.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 outline-none disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deleting === account.id ? "Deleting…" : "Delete"}
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Size</p>
                    <p className="font-medium">{formatMoney(account.account_size)}</p>
                  </div>
                  {account.balance != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-medium">{formatMoney(account.balance)}</p>
                    </div>
                  )}
                  {account.daily_loss_limit != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Daily Limit</p>
                      <p className="font-medium text-amber-600">{formatMoney(account.daily_loss_limit)}</p>
                    </div>
                  )}
                  {account.profit_target != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="font-medium text-emerald-600">{formatMoney(account.profit_target)}</p>
                    </div>
                  )}
                </div>

                {pct != null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress to target</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PropAccountForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        initial={editing}
      />
    </div>
  );
}
