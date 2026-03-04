"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { buildPayoffProjection } from "@/lib/supabase/finance";
import type { Debt, MonthlyExpense, PropPayout } from "@/lib/types";

interface PayoffChartProps {
  debts: Debt[];
  expenses: MonthlyExpense[];
  payouts: PropPayout[];
}

function formatDollar(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}

export function PayoffChart({ debts, expenses, payouts }: PayoffChartProps) {
  const activeDebts = debts.filter((d) => !d.is_paid_off);
  const totalBalance = activeDebts.reduce((s, d) => s + d.current_balance, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Average monthly payout (last 90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recentPayouts = payouts.filter((p) => p.payout_date >= cutoffStr);
  const avgMonthlyPayout =
    recentPayouts.length > 0
      ? recentPayouts.reduce((s, p) => s + p.amount, 0) / 3
      : 0;

  const monthlySurplus = avgMonthlyPayout - totalExpenses;
  const projection = buildPayoffProjection(debts, expenses, payouts);

  // Find projected payoff date
  const payoffPoint = projection.find((p) => p.balance === 0);
  const payoffLabel = payoffPoint?.month ?? null;

  // Months until payoff
  const monthsUntilPayoff =
    monthlySurplus > 0 && totalBalance > 0
      ? Math.ceil(totalBalance / monthlySurplus)
      : null;

  const noData = activeDebts.length === 0;
  const noSurplus = monthlySurplus <= 0 && !noData;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">Debt Payoff Projection</h2>
        <p className="text-xs text-muted-foreground">
          Based on average monthly prop firm payouts vs. expenses
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Remaining debt"
          value={`$${totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          color="text-destructive"
        />
        <StatCard
          label="Avg monthly payout"
          value={`$${Math.round(avgMonthlyPayout).toLocaleString()}`}
          color="text-green-500"
        />
        <StatCard
          label="Monthly expenses"
          value={`$${Math.round(totalExpenses).toLocaleString()}`}
          color="text-amber-500"
        />
        <StatCard
          label={monthlySurplus > 0 ? "Projected payoff" : "Monthly surplus"}
          value={
            payoffLabel
              ? payoffLabel
              : monthlySurplus > 0
              ? `${monthsUntilPayoff} mo`
              : monthlySurplus === 0
              ? "$0 surplus"
              : `-$${Math.abs(Math.round(monthlySurplus)).toLocaleString()}`
          }
          color={monthlySurplus > 0 ? "text-primary" : "text-destructive"}
        />
      </div>

      {noData ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Add debts to see your payoff projection.
        </div>
      ) : noSurplus ? (
        <div className="flex h-48 items-center justify-center flex-col gap-1 text-center">
          <p className="text-sm font-medium">No surplus to project</p>
          <p className="text-xs text-muted-foreground">
            Your monthly expenses exceed your average payouts.
            <br />
            Log more payouts or reduce expenses to see a projection.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={projection}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatDollar}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip
              formatter={(value: number) =>
                [`$${value.toLocaleString()}`, "Balance"]
              }
              contentStyle={{
                borderRadius: "8px",
                fontSize: "12px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
              }}
            />
            {payoffLabel && (
              <ReferenceLine
                x={payoffLabel}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                label={{
                  value: "Paid off",
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "hsl(var(--primary))",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {!noData && !noSurplus && monthlySurplus > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Net surplus:{" "}
          <span className="font-medium text-green-500">
            ${Math.round(monthlySurplus).toLocaleString()}/mo
          </span>{" "}
          applied to debt
          {payoffLabel && ` · payoff projected: ${payoffLabel}`}
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
