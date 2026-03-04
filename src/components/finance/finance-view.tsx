"use client";

import { useState } from "react";
import { LayoutDashboard, CreditCard, Receipt, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Debt, MonthlyExpense, PropPayout } from "@/lib/types";
import { DebtsView } from "./debts-view";
import { ExpensesView } from "./expenses-view";
import { PayoutsView } from "./payouts-view";
import { PayoffChart } from "./payoff-chart";

type Tab = "overview" | "debts" | "expenses" | "payouts";

interface FinanceViewProps {
  initialDebts: Debt[];
  initialExpenses: MonthlyExpense[];
  initialPayouts: PropPayout[];
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "debts", label: "Debts", icon: CreditCard },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "payouts", label: "Payouts", icon: TrendingUp },
];

export function FinanceView({
  initialDebts,
  initialExpenses,
  initialPayouts,
}: FinanceViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Keep live state at the top so the overview chart stays in sync
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>(initialExpenses);
  const [payouts, setPayouts] = useState<PropPayout[]>(initialPayouts);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Finance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track debts, expenses, and prop firm payouts — see when you&apos;ll be debt-free.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <PayoffChart debts={debts} expenses={expenses} payouts={payouts} />
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              title="Active debts"
              value={debts.filter((d) => !d.is_paid_off).length}
              sub={`$${debts
                .filter((d) => !d.is_paid_off)
                .reduce((s, d) => s + d.current_balance, 0)
                .toLocaleString("en-US", { maximumFractionDigits: 0 })} remaining`}
              accent="text-destructive"
            />
            <SummaryCard
              title="Monthly expenses"
              value={`$${expenses
                .reduce((s, e) => s + e.amount, 0)
                .toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              sub={`${expenses.length} line items`}
              accent="text-amber-500"
            />
            <SummaryCard
              title="Total payouts received"
              value={`$${payouts
                .reduce((s, p) => s + p.amount, 0)
                .toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              sub={`${payouts.length} payouts logged`}
              accent="text-green-500"
            />
          </div>
        </div>
      )}

      {activeTab === "debts" && (
        <DebtsView initialDebts={debts} onDebtsChange={setDebts} />
      )}

      {activeTab === "expenses" && (
        <ExpensesView initialExpenses={expenses} onExpensesChange={setExpenses} />
      )}

      {activeTab === "payouts" && (
        <PayoutsView initialPayouts={payouts} onPayoutsChange={setPayouts} />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string | number;
  sub: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
