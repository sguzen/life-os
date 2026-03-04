"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getHabitsWithLogs,
  createHabit,
  updateHabit,
  archiveHabit,
  toggleHabitLog,
} from "@/lib/supabase/habits";
import type { HabitWithLogs } from "@/lib/types";
import type { HabitFormData } from "@/lib/validations/habit";
import { HabitCard } from "./habit-card";
import { HabitForm } from "./habit-form";
import { HabitChart } from "./habit-chart";

interface HabitsViewProps {
  initialHabits: HabitWithLogs[];
}

export function HabitsView({ initialHabits }: HabitsViewProps) {
  const [habits, setHabits] = useState<HabitWithLogs[]>(initialHabits);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitWithLogs | undefined>();

  const supabase = createClient();

  const refresh = useCallback(async () => {
    const updated = await getHabitsWithLogs(supabase);
    setHabits(updated);
  }, [supabase]);

  async function handleCreate(data: HabitFormData) {
    await createHabit(supabase, data);
    await refresh();
  }

  async function handleEdit(data: HabitFormData) {
    if (!editingHabit) return;
    await updateHabit(supabase, editingHabit.id, data);
    await refresh();
  }

  async function handleDelete(habitId: string) {
    if (!confirm("Archive this habit? It will no longer appear in your list.")) return;
    await archiveHabit(supabase, habitId);
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
  }

  async function handleCheckIn(habitId: string, loggedToday: boolean) {
    await toggleHabitLog(supabase, habitId, loggedToday);
    // Refresh full list to get accurate streaks
    await refresh();
  }

  function openEdit(habit: HabitWithLogs) {
    setEditingHabit(habit);
    setFormOpen(true);
  }

  function handleFormOpenChange(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingHabit(undefined);
  }

  const totalToday = habits.length;
  const doneToday = habits.filter((h) => h.logged_today).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Habits</h1>
          {habits.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {doneToday}/{totalToday} completed today
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setEditingHabit(undefined);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add habit
        </button>
      </div>

      {/* Analytics chart */}
      {habits.length > 0 && <HabitChart habits={habits} />}

      {/* Habit list */}
      {habits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-lg font-medium">No habits yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first habit to start tracking.
          </p>
          <button
            onClick={() => setFormOpen(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add habit
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onCheckIn={handleCheckIn}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add / Edit form dialog */}
      <HabitForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        habit={editingHabit}
        onSubmit={editingHabit ? handleEdit : handleCreate}
      />
    </div>
  );
}
