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

  const { data: habits, error: habitErr } = await supabase
    .from("habits")
    .select("id, name, description, frequency, target_count, color, is_archived, created_at")
    .eq("user_id", user.id)
    .order("created_at");

  if (habitErr) {
    return NextResponse.json({ error: habitErr.message }, { status: 500 });
  }

  const { data: logs, error: logErr } = await supabase
    .from("habit_logs")
    .select("habit_id, logged_at, count")
    .eq("user_id", user.id)
    .order("logged_at");

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  // Build habit name lookup
  const habitNames = Object.fromEntries((habits ?? []).map((h) => [h.id, h.name]));

  const rows = (logs ?? []).map((log) => ({
    habit_id: log.habit_id,
    habit_name: habitNames[log.habit_id] ?? "",
    logged_at: log.logged_at,
    count: log.count,
  }));

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(toCSV(rows), `habits-${date}.csv`);
}
