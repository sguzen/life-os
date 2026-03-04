import { createClient } from "@/lib/supabase/server";
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
