import { createClient } from "@/lib/supabase/server";
import { getHabitsWithLogs } from "@/lib/supabase/habits";
import { HabitsView } from "@/components/habits/habits-view";

export default async function HabitsPage() {
  const supabase = createClient();
  const habits = await getHabitsWithLogs(supabase);

  return <HabitsView initialHabits={habits} />;
}
