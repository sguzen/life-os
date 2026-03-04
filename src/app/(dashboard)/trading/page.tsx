import { createClient } from "@/lib/supabase/server";
import { TradingView } from "@/components/trading/trading-view";
import type { Trade, PropAccount, Strategy } from "@/lib/types";

export const dynamic = "force-dynamic";

async function fetchInitialData() {
  const supabase = createClient();

  const [tradesRes, accountsRes, strategiesRes] = await Promise.all([
    supabase
      .from("trades")
      .select("*, prop_accounts(id, firm, account_label), strategies(id, name)")
      .order("entry_time", { ascending: false })
      .limit(500),
    supabase
      .from("prop_accounts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("strategies")
      .select("*")
      .order("name"),
  ]);

  return {
    trades: (tradesRes.data ?? []) as Trade[],
    accounts: (accountsRes.data ?? []) as PropAccount[],
    strategies: (strategiesRes.data ?? []) as Strategy[],
  };
}

export default async function TradingPage() {
  const { trades, accounts, strategies } = await fetchInitialData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trading Journal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Log trades, track prop accounts, manage strategies, and review your performance.
        </p>
      </div>
      <TradingView
        initialTrades={trades}
        initialAccounts={accounts}
        initialStrategies={strategies}
      />
    </div>
  );
}
