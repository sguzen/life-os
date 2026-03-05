import { z } from "zod";

export const PROJECT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#64748b", // slate
] as const;

export const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(150, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional().or(z.literal("")),
  status: z.enum(["active", "paused", "done", "abandoned"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(300, "Title is too long"),
  status: z.enum(["todo", "in_progress", "done"]),
  notes: z.string().max(2000, "Notes are too long").optional().or(z.literal("")),
});

export type TaskFormData = z.infer<typeof taskSchema>;
