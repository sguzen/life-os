import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Debt,
  MonthlyExpense,
  PropPayout,
  PayoffProjectionPoint,
} from "@/lib/types";
import type {
  DebtFormValues,
  MonthlyExpenseFormValues,
  PropPayoutFormValues,
} from "@/lib/validations/finance";

// ============================================================
// Debts
// ============================================================

export async function getDebts(supabase: SupabaseClient): Promise<Debt[]> {
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Debt[];
}

export async function createDebt(
  supabase: SupabaseClient,
  input: DebtFormValues
): Promise<Debt> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("debts")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as Debt;
}

export async function updateDebt(
  supabase: SupabaseClient,
  id: string,
  input: Partial<DebtFormValues>
): Promise<Debt> {
  const { data, error } = await supabase
    .from("debts")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Debt;
}

export async function deleteDebt(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Monthly Expenses
// ============================================================

export async function getMonthlyExpenses(
  supabase: SupabaseClient
): Promise<MonthlyExpense[]> {
  const { data, error } = await supabase
    .from("monthly_expenses")
    .select("*")
    .order("category", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MonthlyExpense[];
}

export async function createMonthlyExpense(
  supabase: SupabaseClient,
  input: MonthlyExpenseFormValues
): Promise<MonthlyExpense> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("monthly_expenses")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as MonthlyExpense;
}

export async function updateMonthlyExpense(
  supabase: SupabaseClient,
  id: string,
  input: Partial<MonthlyExpenseFormValues>
): Promise<MonthlyExpense> {
  const { data, error } = await supabase
    .from("monthly_expenses")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as MonthlyExpense;
}

export async function deleteMonthlyExpense(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("monthly_expenses")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// Prop Payouts
// ============================================================

export async function getPropPayouts(
  supabase: SupabaseClient
): Promise<PropPayout[]> {
  const { data, error } = await supabase
    .from("prop_payouts")
    .select("*")
    .order("payout_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PropPayout[];
}

export async function createPropPayout(
  supabase: SupabaseClient,
  input: PropPayoutFormValues
): Promise<PropPayout> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("prop_payouts")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as PropPayout;
}

export async function updatePropPayout(
  supabase: SupabaseClient,
  id: string,
  input: Partial<PropPayoutFormValues>
): Promise<PropPayout> {
  const { data, error } = await supabase
    .from("prop_payouts")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as PropPayout;
}

export async function deletePropPayout(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("prop_payouts").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Debt payoff projection (client-side computed)
// ============================================================

/**
 * Projects month-by-month debt balance until paid off (or monthsToShow elapses).
 * Monthly surplus = average monthly payout (last 90 days) - total monthly expenses.
 */
export function buildPayoffProjection(
  debts: Debt[],
  expenses: MonthlyExpense[],
  payouts: PropPayout[],
  monthsToShow = 36
): PayoffProjectionPoint[] {
  const totalBalance = debts
    .filter((d) => !d.is_paid_off)
    .reduce((sum, d) => sum + d.current_balance, 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Average monthly payout from last 90 days (≈3 months)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recentPayouts = payouts.filter((p) => p.payout_date >= cutoffStr);
  const avgMonthlyPayout =
    recentPayouts.length > 0
      ? recentPayouts.reduce((sum, p) => sum + p.amount, 0) / 3
      : 0;

  const monthlySurplus = avgMonthlyPayout - totalExpenses;

  const points: PayoffProjectionPoint[] = [];
  let balance = totalBalance;
  const now = new Date();

  for (let i = 0; i < monthsToShow; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    if (balance <= 0) {
      points.push({ month: label, balance: 0 });
      break;
    }

    points.push({ month: label, balance: Math.round(balance * 100) / 100 });

    if (monthlySurplus > 0) {
      balance -= monthlySurplus;
    }
  }

  return points;
}
