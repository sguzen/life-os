import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ── Types ───────────────────────────────────────────────────────────────────

interface TradovateTradeRow {
  date: string;             // "2026-03-02"
  timestamp: string;        // ISO 8601 exit timestamp (UTC)
  entry_time: string;       // ISO 8601 entry timestamp (UTC)
  instrument: string;       // mapped DB value e.g. "NQ", "Gold"
  contract: string;         // e.g. "MGCJ6"
  direction: "long" | "short";
  qty: number;
  entry_price: number | null;
  exit_price: number | null;
  gross_pnl: number;
  exchange_fee: number;     // negative
  clearing_fee: number;     // negative
  nfa_fee: number;          // negative
  commission: number;       // negative
  total_fees: number;       // negative, sum of above
  net_pnl: number;
  session: "london" | "new_york_am" | "new_york_pm" | "overnight";
  prop_account_id: string | null;
  strategy_id: string | null;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ── POST /api/trading/import-tradovate ───────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let trades: TradovateTradeRow[];
  try {
    trades = await req.json();
    if (!Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: "Expected non-empty array" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Dedup: fetch existing (exit_time, contract, gross_pnl) tuples ──────────
  const { data: existing, error: existingErr } = await supabase
    .from("trades")
    .select("exit_time, contract, gross_pnl")
    .eq("user_id", user.id)
    .not("contract", "is", null);

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  const existingKeys = new Set(
    (existing ?? []).map(
      (t) => `${t.exit_time}|${t.contract}|${t.gross_pnl}`
    )
  );

  const toInsert = trades.filter((t) => {
    const key = `${t.timestamp}|${t.contract}|${t.gross_pnl}`;
    return !existingKeys.has(key);
  });

  const skipped = trades.length - toInsert.length;

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skipped, errors: [] } satisfies ImportResult);
  }

  // ── Map TradovateTradeRow → DB row ─────────────────────────────────────────
  const rows = toInsert.map((t) => {
    const netPnl = t.gross_pnl + t.total_fees; // total_fees is negative
    const outcome = netPnl > 0 ? "win" : netPnl < 0 ? "loss" : "break_even";
    return {
      user_id:        user.id,
      instrument:     t.instrument,
      contract:       t.contract,
      direction:      t.direction,
      contracts:      t.qty,
      entry_price:    t.entry_price ?? t.exit_price ?? 0,
      exit_price:     t.exit_price,
      entry_time:     t.entry_time,
      exit_time:      t.timestamp,
      gross_pnl:      t.gross_pnl,
      // fees stored as positive for the generated net_pnl = gross_pnl - fees
      fees:           Math.abs(t.total_fees),
      outcome,
      session:        t.session,
      exchange_fee:   t.exchange_fee,
      clearing_fee:   t.clearing_fee,
      nfa_fee:        t.nfa_fee,
      commission:     t.commission,
      total_fees:     t.total_fees,
      prop_account_id: t.prop_account_id,
      strategy_id:    t.strategy_id,
      position_id:    null,
      pair_id:        null,
      setup_tags:     null,
      confluence_notes: null,
      entry_notes:    null,
      exit_notes:     null,
      lessons:        null,
      screenshots:    null,
      pre_emotion:    null,
      post_emotion:   null,
      followed_rules: null,
      is_reviewed:    false,
    };
  });

  // ── Bulk insert (fast path) ────────────────────────────────────────────────
  const { error: bulkErr } = await supabase.from("trades").insert(rows);

  if (!bulkErr) {
    await recomputeAffectedAccounts(supabase, toInsert);
    return NextResponse.json({ imported: toInsert.length, skipped, errors: [] } satisfies ImportResult);
  }

  // ── Row-by-row fallback ────────────────────────────────────────────────────
  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const { error: rowErr } = await supabase.from("trades").insert(row);
    if (rowErr) {
      errors.push(`${row.contract} @ ${row.exit_time}: ${rowErr.message}`);
    } else {
      imported++;
    }
  }

  if (imported === 0) {
    return NextResponse.json(
      { error: `Import failed: ${errors[0] ?? bulkErr.message}` },
      { status: 500 }
    );
  }

  await recomputeAffectedAccounts(supabase, toInsert);
  return NextResponse.json({ imported, skipped: skipped + errors.length, errors } satisfies ImportResult);
}

// ── Helper: recompute prop account balances ──────────────────────────────────

async function recomputeAffectedAccounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  trades: TradovateTradeRow[]
): Promise<void> {
  const accountIds = Array.from(
    new Set(trades.map((t) => t.prop_account_id).filter(Boolean))
  ) as string[];

  await Promise.all(
    accountIds.map(async (id) => {
      const [{ data: pnls }, { data: account }] = await Promise.all([
        supabase.from("trades").select("net_pnl").eq("prop_account_id", id),
        supabase.from("prop_accounts").select("account_size").eq("id", id).single(),
      ]);
      const total = (pnls ?? []).reduce((s: number, t: { net_pnl: number | null }) => s + (t.net_pnl ?? 0), 0);
      await supabase
        .from("prop_accounts")
        .update({ balance: (account?.account_size ?? 0) + total })
        .eq("id", id);
    })
  );
}
