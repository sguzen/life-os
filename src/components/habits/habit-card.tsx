"use client";

import { useState } from "react";
import { Check, Flame, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import type { HabitWithLogs } from "@/lib/types";
import { todayDate } from "@/lib/supabase/habits";

interface HabitCardProps {
  habit: HabitWithLogs;
  onCheckIn: (habitId: string, loggedToday: boolean) => Promise<void>;
  onEdit: (habit: HabitWithLogs) => void;
  onDelete: (habitId: string) => Promise<void>;
}

/**
 * Render the last 7 days as dots (P1-07 micro-streak display).
 * Filled = logged that day, empty = missed.
 */
function MiniStreakDots({ logs, color }: { logs: HabitWithLogs["logs"]; color: string }) {
  const today = todayDate();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const loggedSet = new Set(logs.map((l) => l.logged_at));
  return (
    <div className="flex items-center gap-1">
      {days.map((day) => (
        <span
          key={day}
          title={day}
          className="h-2 w-2 rounded-full"
          style={
            loggedSet.has(day)
              ? { backgroundColor: color }
              : { backgroundColor: "transparent", border: "1px solid currentColor" }
          }
        />
      ))}
    </div>
  );
}

export function HabitCard({ habit, onCheckIn, onEdit, onDelete }: HabitCardProps) {
  const [optimisticLogged, setOptimisticLogged] = useState(habit.logged_today);
  const [optimisticStreak, setOptimisticStreak] = useState(habit.streak);
  const [loading, setLoading] = useState(false);

  async function handleCheckIn() {
    if (loading) return;
    setLoading(true);
    const wasLogged = optimisticLogged;

    // Optimistic update
    setOptimisticLogged(!wasLogged);
    setOptimisticStreak((s) => (!wasLogged ? s + 1 : Math.max(0, s - 1)));

    try {
      await onCheckIn(habit.id, wasLogged);
    } catch {
      // Revert on error
      setOptimisticLogged(wasLogged);
      setOptimisticStreak(habit.streak);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="group relative rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Color accent bar */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: habit.color }}
      />

      <div className="flex items-start justify-between gap-3 pl-2">
        {/* Left: info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold leading-snug">{habit.name}</span>
            <span className="rounded-full px-1.5 py-0.5 text-xs text-muted-foreground capitalize border">
              {habit.frequency}
            </span>
          </div>
          {habit.description && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {habit.description}
            </p>
          )}

          {/* Streak row */}
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Flame
                className={cn(
                  "h-3.5 w-3.5",
                  optimisticStreak > 0 ? "text-orange-500" : "text-muted-foreground"
                )}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {optimisticStreak > 0
                  ? `${optimisticStreak} day${optimisticStreak !== 1 ? "s" : ""}`
                  : "No streak"}
              </span>
            </div>
            <MiniStreakDots logs={habit.logs} color={habit.color} />
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Check-in button */}
          <button
            onClick={handleCheckIn}
            disabled={loading}
            aria-label={optimisticLogged ? "Undo check-in" : "Check in"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
              optimisticLogged
                ? "border-transparent text-white"
                : "border-muted-foreground/30 text-muted-foreground hover:border-current",
              loading && "opacity-50 cursor-wait"
            )}
            style={optimisticLogged ? { backgroundColor: habit.color } : {}}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>

          {/* Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-50 min-w-[140px] rounded-lg border bg-card p-1 shadow-md"
              >
                <DropdownMenu.Item
                  onSelect={() => onEdit(habit)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => onDelete(habit.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
}
