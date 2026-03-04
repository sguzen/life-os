import type { SupabaseClient } from "@supabase/supabase-js";
import type { Habit, HabitLog, HabitWithLogs } from "@/lib/types";
import type { HabitFormData } from "@/lib/validations/habit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns today's date as a YYYY-MM-DD string in the local timezone. */
export function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Calculate the consecutive-day streak for a sorted (desc) list of log dates.
 * For weekly habits we check week continuity instead.
 */
function calcStreak(
  logs: HabitLog[],
  frequency: "daily" | "weekly"
): number {
  if (logs.length === 0) return 0;

  const today = todayDate();
  const sortedDates = logs
    .map((l) => l.logged_at)
    .sort((a, b) => (a > b ? -1 : 1));

  if (frequency === "daily") {
    let streak = 0;
    let expected = today;

    for (const date of sortedDates) {
      if (date === expected) {
        streak++;
        // decrement expected by one day
        const d = new Date(expected + "T00:00:00");
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
      } else if (date < expected) {
        // gap — allow missing today (streak still ongoing from yesterday)
        if (streak === 0 && date === getPreviousDay(today)) {
          streak++;
          const d = new Date(date + "T00:00:00");
          d.setDate(d.getDate() - 1);
          expected = d.toISOString().slice(0, 10);
        } else {
          break;
        }
      }
    }
    return streak;
  }

  // Weekly: group logs by ISO week, count consecutive weeks
  const weeks = new Set(sortedDates.map(getISOWeek));
  const sortedWeeks = Array.from(weeks).sort((a, b) => (a > b ? -1 : 1));

  let streak = 0;
  let expectedWeek = getISOWeek(today);

  for (const week of sortedWeeks) {
    if (week === expectedWeek) {
      streak++;
      expectedWeek = previousISOWeek(expectedWeek);
    } else {
      break;
    }
  }
  return streak;
}

function getPreviousDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Returns "YYYY-Www" string for a given YYYY-MM-DD date. */
function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diffMs = d.getTime() - startOfWeek1.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function previousISOWeek(weekStr: string): string {
  const [yearStr, wStr] = weekStr.split("-W");
  let year = parseInt(yearStr);
  let week = parseInt(wStr) - 1;
  if (week < 1) {
    year--;
    week = 52; // approximate; good enough for streak calculation
  }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// P1-03 Query functions
// ---------------------------------------------------------------------------

/** Fetch all non-archived habits for the current user. */
export async function getHabits(supabase: SupabaseClient): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Habit[];
}

/**
 * Fetch all non-archived habits with their logs from the last 30 days,
 * and compute streak + logged_today for each.
 */
export async function getHabitsWithLogs(
  supabase: SupabaseClient
): Promise<HabitWithLogs[]> {
  const today = todayDate();
  const thirtyDaysAgo = (() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  })();

  const [{ data: habitsData, error: habitsError }, { data: logsData, error: logsError }] =
    await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: true }),
      supabase
        .from("habit_logs")
        .select("*")
        .gte("logged_at", thirtyDaysAgo)
        .order("logged_at", { ascending: false }),
    ]);

  if (habitsError) throw habitsError;
  if (logsError) throw logsError;

  const habits = (habitsData ?? []) as Habit[];
  const logs = (logsData ?? []) as HabitLog[];

  return habits.map((habit) => {
    const habitLogs = logs.filter((l) => l.habit_id === habit.id);
    return {
      ...habit,
      logs: habitLogs,
      streak: calcStreak(habitLogs, habit.frequency),
      logged_today: habitLogs.some((l) => l.logged_at === today),
    };
  });
}

/** Create a new habit. */
export async function createHabit(
  supabase: SupabaseClient,
  data: HabitFormData
): Promise<Habit> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: habit, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      name: data.name,
      description: data.description || null,
      frequency: data.frequency,
      target_count: data.target_count,
      color: data.color,
    })
    .select()
    .single();

  if (error) throw error;
  return habit as Habit;
}

/** Update an existing habit. */
export async function updateHabit(
  supabase: SupabaseClient,
  id: string,
  data: HabitFormData
): Promise<Habit> {
  const { data: habit, error } = await supabase
    .from("habits")
    .update({
      name: data.name,
      description: data.description || null,
      frequency: data.frequency,
      target_count: data.target_count,
      color: data.color,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return habit as Habit;
}

/** Soft-delete (archive) a habit. */
export async function archiveHabit(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("habits")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) throw error;
}

/**
 * P1-06: Toggle today's log for a habit.
 * If already logged today → remove it. Otherwise → insert it.
 */
export async function toggleHabitLog(
  supabase: SupabaseClient,
  habitId: string,
  loggedToday: boolean
): Promise<void> {
  const today = todayDate();

  if (loggedToday) {
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("habit_id", habitId)
      .eq("logged_at", today);
    if (error) throw error;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("habit_logs").insert({
      user_id: user.id,
      habit_id: habitId,
      logged_at: today,
      count: 1,
    });
    if (error) throw error;
  }
}
