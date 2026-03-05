import { z } from "zod";

export const bookSchema = z.object({
  title: z.string().min(1, "Title is required").max(300, "Title is too long"),
  author: z.string().max(200, "Author name is too long").optional().or(z.literal("")),
  isbn: z
    .string()
    .regex(/^(\d{9}[\dX]|\d{13})?$/, "Must be a valid ISBN-10 or ISBN-13")
    .optional()
    .or(z.literal("")),
  status: z.enum(["want-to-read", "reading", "done", "abandoned"]),
  rating: z.coerce
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .nullable(),
  notes: z.string().max(5000, "Notes are too long").optional().or(z.literal("")),
  started_at: z.string().optional().nullable(),
  finished_at: z.string().optional().nullable(),
  cover_url: z.string().url().optional().nullable().or(z.literal("")),
});

export type BookFormData = z.infer<typeof bookSchema>;
