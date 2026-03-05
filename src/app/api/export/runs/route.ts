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

  const { data: runs, error } = await supabase
    .from("running_activities")
    .select(
      "started_at, distance_meters, duration_seconds, avg_pace_sec_per_km, " +
      "avg_hr, max_hr, elevation_gain_m, calories, sport, notes, created_at"
    )
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (runs ?? []).map((r) => ({
    started_at: r.started_at,
    distance_km: r.distance_meters ? (r.distance_meters / 1000).toFixed(2) : "",
    duration_min: r.duration_seconds ? (r.duration_seconds / 60).toFixed(1) : "",
    avg_pace_min_km: r.avg_pace_sec_per_km
      ? `${Math.floor(r.avg_pace_sec_per_km / 60)}:${String(r.avg_pace_sec_per_km % 60).padStart(2, "0")}`
      : "",
    avg_hr: r.avg_hr ?? "",
    max_hr: r.max_hr ?? "",
    elevation_gain_m: r.elevation_gain_m ?? "",
    calories: r.calories ?? "",
    sport: r.sport ?? "",
    notes: r.notes ?? "",
    created_at: r.created_at,
  }));

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(toCSV(rows), `runs-${date}.csv`);
}
