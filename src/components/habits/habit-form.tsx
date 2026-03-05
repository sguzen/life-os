"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { habitSchema, HABIT_COLORS, type HabitFormData } from "@/lib/validations/habit";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HabitFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the form is in edit mode. */
  habit?: Habit;
  onSubmit: (data: HabitFormData) => Promise<void>;
}

const defaultValues: HabitFormData = {
  name: "",
  description: "",
  frequency: "daily",
  target_count: 1,
  color: HABIT_COLORS[0],
};

export function HabitForm({ open, onOpenChange, habit, onSubmit }: HabitFormProps) {
  const [form, setForm] = useState<HabitFormData>(
    habit
      ? {
          name: habit.name,
          description: habit.description ?? "",
          frequency: habit.frequency,
          target_count: habit.target_count,
          color: habit.color,
        }
      : defaultValues
  );
  const [errors, setErrors] = useState<Partial<Record<keyof HabitFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        habit
          ? {
              name: habit.name,
              description: habit.description ?? "",
              frequency: habit.frequency,
              target_count: habit.target_count,
              color: habit.color,
            }
          : defaultValues
      );
      setErrors({});
    }
  }, [open, habit]);

  function handleOpenChange(val: boolean) {
    onOpenChange(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = habitSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof HabitFormData;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              {habit ? "Edit habit" : "New habit"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Morning meditation"
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none",
                  "focus:ring-2 focus:ring-ring",
                  errors.name && "border-destructive"
                )}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="description">
                Description
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="description"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Frequency + Target */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="frequency">
                  Frequency
                </label>
                <select
                  id="frequency"
                  value={form.frequency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      frequency: e.target.value as "daily" | "weekly",
                    })
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="target_count">
                  Target / day
                </label>
                <input
                  id="target_count"
                  type="number"
                  min={1}
                  max={100}
                  value={form.target_count}
                  onChange={(e) =>
                    setForm({ ...form, target_count: Number(e.target.value) })
                  }
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.target_count && "border-destructive"
                  )}
                />
                {errors.target_count && (
                  <p className="text-xs text-destructive">{errors.target_count}</p>
                )}
              </div>
            </div>

            {/* Color */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Color</p>
              <div className="flex flex-wrap gap-2">
                {HABIT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      "h-7 w-7 rounded-full transition-transform",
                      form.color === c && "scale-125 ring-2 ring-ring ring-offset-2"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Saving…" : habit ? "Save changes" : "Create habit"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
