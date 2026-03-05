import { createClient } from "./client";
import type {
  Trade,
  PropAccount,
  Strategy,
  TradingSessionJournal,
  TradeStats,
  DailyPnl,
  Instrument,
  TradeOutcome,
} from "@/lib/types";

// ============================================================
// Prop Accounts
// ============================================================

export async function getPropAccounts(): Promise<PropAccount[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prop_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createPropAccount(
  input: Omit<PropAccount, "id" | "user_id" | "created_at" | "updated_at">
): Promise<PropAccount> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("prop_accounts")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePropAccount(
  id: string,
  input: Partial<Omit<PropAccount, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<PropAccount> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prop_accounts")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePropAccount(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("prop_accounts").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Strategies
// ============================================================

export async function getStrategies(): Promise<Strategy[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategies")
    .select("*")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function createStrategy(
  input: Omit<Strategy, "id" | "user_id" | "created_at" | "updated_at">
): Promise<Strategy> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("strategies")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStrategy(
  id: string,
  input: Partial<Omit<Strategy, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<Strategy> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategies")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStrategy(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("strategies").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Trades
// ============================================================

export interface TradeFilters {
  instrument?: Instrument;
  outcome?: TradeOutcome;
  prop_account_id?: string;
  strategy_id?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  limit?: number;
  offset?: number;
}

export async function getTrades(filters: TradeFilters = {}): Promise<Trade[]> {
  const supabase = createClient();
  let query = supabase
    .from("trades")
    .select(
      `*,
       prop_accounts(id, firm, account_label),
       strategies(id, name)`
    )
    .order("entry_time", { ascending: false });

  if (filters.instrument) query = query.eq("instrument", filters.instrument);
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.prop_account_id) query = query.eq("prop_account_id", filters.prop_account_id);
  if (filters.strategy_id) query = query.eq("strategy_id", filters.strategy_id);
  if (filters.from) query = query.gte("entry_time", filters.from);
  if (filters.to) query = query.lte("entry_time", filters.to + "T23:59:59");
  if (filters.limit) query = query.limit(filters.limit);
  if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Trade[];
}

export async function getTradeById(id: string): Promise<Trade | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trades")
    .select(
      `*,
       prop_accounts(id, firm, account_label),
       strategies(id, name)`
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Trade;
}

export async function createTrade(
  input: Omit<Trade, "id" | "user_id" | "net_pnl" | "created_at" | "updated_at" | "prop_accounts" | "strategies">
): Promise<Trade> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("trades")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as Trade;
}

export async function updateTrade(
  id: string,
  input: Partial<Omit<Trade, "id" | "user_id" | "net_pnl" | "created_at" | "updated_at" | "prop_accounts" | "strategies">>
): Promise<Trade> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trades")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Trade;
}

export async function deleteTrade(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Recomputes a prop account's balance as:
 *   account_size + SUM(net_pnl of all trades assigned to it)
 * Call this after any trade ↔ account assignment change.
 */
export async function recomputeAccountBalance(accountId: string): Promise<void> {
  const supabase = createClient();

  const [{ data: tradePnls, error: tradesErr }, { data: account, error: accountErr }] =
    await Promise.all([
      supabase.from("trades").select("net_pnl").eq("prop_account_id", accountId),
      supabase.from("prop_accounts").select("account_size").eq("id", accountId).single(),
    ]);

  if (tradesErr) throw tradesErr;
  if (accountErr) throw accountErr;

  const totalPnl = (tradePnls ?? []).reduce((s, t) => s + (t.net_pnl ?? 0), 0);
  const newBalance = (account.account_size ?? 0) + totalPnl;

  const { error: updateErr } = await supabase
    .from("prop_accounts")
    .update({ balance: newBalance })
    .eq("id", accountId);
  if (updateErr) throw updateErr;
}

export async function bulkUpdateTrades(
  ids: string[],
  input: { prop_account_id?: string | null; strategy_id?: string | null }
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = createClient();

  // Collect old account IDs before the update so we can recompute those balances too
  const accountsToRecompute = new Set<string>();
  if ("prop_account_id" in input) {
    const { data: before } = await supabase
      .from("trades")
      .select("prop_account_id")
      .in("id", ids);
    (before ?? []).forEach((t) => { if (t.prop_account_id) accountsToRecompute.add(t.prop_account_id); });
    if (input.prop_account_id) accountsToRecompute.add(input.prop_account_id);
  }

  const { error } = await supabase.from("trades").update(input).in("id", ids);
  if (error) throw error;

  // Recompute balances for all affected accounts
  await Promise.all(Array.from(accountsToRecompute).map(recomputeAccountBalance));
}

export type TradeImportInput = Omit<
  Trade,
  "id" | "user_id" | "net_pnl" | "created_at" | "updated_at" | "prop_accounts" | "strategies"
>;

export interface ImportResult {
  imported: number;
  skipped: number;
}

export async function importTrades(inputs: TradeImportInput[]): Promise<ImportResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Split inputs: those with a pair_id use the new dedup key; others use the legacy composite key.
  const inputsWithPairId    = inputs.filter((t) => t.pair_id);
  const inputsWithoutPairId = inputs.filter((t) => !t.pair_id);

  // Fetch existing pair_ids for new-style dedup
  let existingPairIds = new Set<string>();
  if (inputsWithPairId.length > 0) {
    const { data, error } = await supabase
      .from("trades")
      .select("pair_id")
      .eq("user_id", user.id)
      .not("pair_id", "is", null);
    if (error) throw error;
    existingPairIds = new Set((data ?? []).map((t) => t.pair_id as string));
  }

  // Fetch legacy composite keys for backward-compat dedup
  let existingCompositeKeys = new Set<string>();
  if (inputsWithoutPairId.length > 0) {
    const { data, error } = await supabase
      .from("trades")
      .select("entry_time, instrument, entry_price, direction")
      .eq("user_id", user.id);
    if (error) throw error;
    existingCompositeKeys = new Set(
      (data ?? []).map(
        (t) => `${t.entry_time.substring(0, 10)}|${t.instrument}|${t.entry_price}|${t.direction}`
      )
    );
  }

  const toInsert = inputs.filter((t) => {
    if (t.pair_id) return !existingPairIds.has(t.pair_id);
    const key = `${t.entry_time.substring(0, 10)}|${t.instrument}|${t.entry_price}|${t.direction}`;
    return !existingCompositeKeys.has(key);
  });

  if (toInsert.length === 0) {
    return { imported: 0, skipped: inputs.length };
  }

  // Try bulk insert first (fast path)
  const rows = toInsert.map((t) => ({ ...t, user_id: user.id }));
  const { error: bulkError } = await supabase.from("trades").insert(rows);

  if (!bulkError) {
    await recomputeAffectedAccounts(toInsert);
    return { imported: toInsert.length, skipped: inputs.length - toInsert.length };
  }

  // Bulk failed — fall back to row-by-row so partial batches still succeed.
  // This handles cases like unsupported enum values (e.g. 'ES' before migration).
  let imported = 0;
  const rowErrors: string[] = [];

  for (const row of rows) {
    const { error: rowError } = await supabase.from("trades").insert(row);
    if (rowError) {
      rowErrors.push(`${row.instrument} ${row.direction} @ ${row.entry_price}: ${rowError.message}`);
    } else {
      imported++;
    }
  }

  const skipped = inputs.length - toInsert.length;

  if (imported === 0) {
    // Every row failed — surface the first error clearly
    const detail = rowErrors[0] ?? bulkError.message;
    throw new Error(`Import failed: ${detail}`);
  }

  // Partial success — recompute accounts and return counts
  await recomputeAffectedAccounts(toInsert);
  return { imported, skipped: skipped + rowErrors.length };
}

function recomputeAffectedAccounts(inputs: TradeImportInput[]): Promise<void[]> {
  const ids = Array.from(new Set(inputs.map((t) => t.prop_account_id).filter(Boolean))) as string[];
  return Promise.all(ids.map(recomputeAccountBalance));
}

// ============================================================
// Trading Session Journal
// ============================================================

export async function getTradingSession(date: string): Promise<TradingSessionJournal | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trading_sessions")
    .select("*")
    .eq("session_date", date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTradingSessions(from?: string, to?: string): Promise<TradingSessionJournal[]> {
  const supabase = createClient();
  let query = supabase
    .from("trading_sessions")
    .select("*")
    .order("session_date", { ascending: false });

  if (from) query = query.gte("session_date", from);
  if (to) query = query.lte("session_date", to);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertTradingSession(
  input: Omit<TradingSessionJournal, "id" | "user_id" | "created_at" | "updated_at">
): Promise<TradingSessionJournal> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("trading_sessions")
    .upsert(
      { ...input, user_id: user.id },
      { onConflict: "user_id,session_date" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Analytics helpers (client-side computed)
// ============================================================

export function computeTradeStats(trades: Trade[]): TradeStats {
  const closed = trades.filter((t) => t.outcome !== "open");
  const wins = closed.filter((t) => t.outcome === "win");
  const losses = closed.filter((t) => t.outcome === "loss");
  const breakEvens = closed.filter((t) => t.outcome === "break_even");

  const totalNetPnl = closed.reduce((s, t) => s + (t.net_pnl ?? 0), 0);
  const totalGrossPnl = closed.reduce((s, t) => s + (t.gross_pnl ?? 0), 0);
  const totalFees = closed.reduce((s, t) => s + (t.fees ?? 0), 0);

  const winPnl = wins.map((t) => t.net_pnl ?? 0);
  const lossPnl = losses.map((t) => t.net_pnl ?? 0);

  const avgWin = wins.length ? winPnl.reduce((s, v) => s + v, 0) / wins.length : 0;
  const avgLoss = losses.length ? lossPnl.reduce((s, v) => s + v, 0) / losses.length : 0;

  const grossWins = wins.reduce((s, t) => s + (t.gross_pnl ?? 0), 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + (t.gross_pnl ?? 0), 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakEvens: breakEvens.length,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
    totalNetPnl,
    totalGrossPnl,
    totalFees,
    avgWin,
    avgLoss,
    profitFactor,
    largestWin: wins.length ? Math.max(...winPnl) : 0,
    largestLoss: losses.length ? Math.min(...lossPnl) : 0,
    avgRR: null, // requires stop loss data — future enhancement
  };
}

export function buildDailyPnl(trades: Trade[]): DailyPnl[] {
  const closed = trades.filter((t) => t.outcome !== "open" && t.exit_time);

  // Group by local date of exit_time
  const byDate = new Map<string, { pnl: number; count: number }>();
  for (const t of closed) {
    const date = (t.exit_time ?? t.entry_time).slice(0, 10);
    const existing = byDate.get(date) ?? { pnl: 0, count: 0 };
    byDate.set(date, {
      pnl: existing.pnl + (t.net_pnl ?? 0),
      count: existing.count + 1,
    });
  }

  // Sort ascending and compute cumulative
  const sorted = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  let cumulative = 0;

  return sorted.map(([date, { pnl, count }]) => {
    cumulative += pnl;
    return {
      date,
      net_pnl: pnl,
      cumulative_pnl: cumulative,
      trade_count: count,
    };
  });
}
