// src/lib/ai/get-system-snapshot.ts
import { createClient } from '@/lib/supabase/server';

export async function getSystemSnapshot() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return JSON.stringify({ error: "No authenticated user" });

  try {
    // Run all queries in parallel for speed
    const [
      { data: trades },
      { data: runs },
      { data: supplements },
      { data: planConfigs }
    ] = await Promise.all([
      // Last 5 Trades
      supabase.from('trades').select('symbol, pnl, status, created_at').order('created_at', { ascending: false }).limit(5),
      // Last 3 Runs
      supabase.from('activities').select('name, distance, moving_time, average_heartrate, start_date').order('start_date', { ascending: false }).limit(3),
      // Active Supplements
      supabase.from('supplements').select('name, dose_amount, dose_unit, frequency, status').in('status', ['active', 'taking']),
      // Current Plan Configs
      supabase.from('plan_configs').select('key, value')
    ]);

    // Format into a highly readable JSON string for Gemini
    const snapshot = {
      timestamp: new Date().toISOString(),
      recent_trades: trades || [],
      recent_runs: runs || [],
      active_supplements: supplements || [],
      current_targets: planConfigs || []
    };

    return JSON.stringify(snapshot, null, 2);
  } catch (error) {
    console.error("Failed to fetch system snapshot:", error);
    return JSON.stringify({ error: "Failed to fetch data from Supabase" });
  }
}