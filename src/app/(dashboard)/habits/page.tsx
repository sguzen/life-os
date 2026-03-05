// P5-05: Habits Coach AI widget added
// P7-05: metadata + loading state

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getHabitsWithLogs } from "@/lib/supabase/habits";
import { HabitsView } from "@/components/habits/habits-view";
import { HabitsCoach } from "@/components/ai/habits-coach";

export const metadata: Metadata = {
  title: "Habits",
  description: "Track and manage your daily habits",
};

export default async function HabitsPage() {
  const supabase = createClient();
  const habits = await getHabitsWithLogs(supabase);

  return (
    <div className="space-y-6">
      <HabitsCoach />
      <HabitsView initialHabits={habits} />
    </div>
  );
}
