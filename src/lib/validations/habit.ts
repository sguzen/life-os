import { z } from "zod";

export const HABIT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#64748b", // slate
] as const;

export const habitSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z
    .string()
    .max(500, "Description is too long")
    .optional()
    .or(z.literal("")),
  frequency: z.enum(["daily", "weekly"]),
  target_count: z.coerce
    .number()
    .int()
    .min(1, "At least 1")
    .max(100, "Max 100"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
});

export type HabitFormData = z.infer<typeof habitSchema>;
