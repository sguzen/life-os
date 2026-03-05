import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Finance",
  description: "Track debts, expenses, and prop firm payouts",
};
import {
  getDebts,
  getMonthlyExpenses,
  getPropPayouts,
} from "@/lib/supabase/finance";
import { FinanceView } from "@/components/finance/finance-view";

export default async function FinancePage() {
  const supabase = createClient();

  const [debts, expenses, payouts] = await Promise.all([
    getDebts(supabase),
    getMonthlyExpenses(supabase),
    getPropPayouts(supabase),
  ]);

  return (
    <FinanceView
      initialDebts={debts}
      initialExpenses={expenses}
      initialPayouts={payouts}
    />
  );
}
