import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCSV, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trades, error } = await supabase
    .from("trades")
    .select(
      "instrument, direction, entry_price, exit_price, contracts, entry_time, exit_time, " +
      "gross_pnl, fees, net_pnl, outcome, session, setup_tags, confluence_notes, " +
      "entry_notes, exit_notes, lessons, followed_rules, is_reviewed, created_at, " +
      "prop_accounts(firm, account_label), strategies(name)"
    )
    .eq("user_id", user.id)
    .order("entry_time", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (trades ?? []).map((t) => ({
    entry_time: t.entry_time,
    exit_time: t.exit_time ?? "",
    instrument: t.instrument,
    direction: t.direction,
    outcome: t.outcome,
    session: t.session ?? "",
    entry_price: t.entry_price,
    exit_price: t.exit_price ?? "",
    contracts: t.contracts,
    gross_pnl: t.gross_pnl ?? "",
    fees: t.fees,
    net_pnl: t.net_pnl ?? "",
    prop_firm: (t.prop_accounts as { firm?: string } | null)?.firm ?? "",
    account: (t.prop_accounts as { account_label?: string } | null)?.account_label ?? "",
    strategy: (t.strategies as { name?: string } | null)?.name ?? "",
    setup_tags: Array.isArray(t.setup_tags) ? t.setup_tags.join("|") : "",
    confluence_notes: t.confluence_notes ?? "",
    entry_notes: t.entry_notes ?? "",
    exit_notes: t.exit_notes ?? "",
    lessons: t.lessons ?? "",
    followed_rules: t.followed_rules ?? "",
    is_reviewed: t.is_reviewed,
    created_at: t.created_at,
  }));

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(toCSV(rows), `trades-${date}.csv`);
}
