"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { bookSchema, type BookFormData } from "@/lib/validations/books";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book?: Book;
  onSubmit: (data: BookFormData) => Promise<void>;
}

const STATUS_OPTIONS: { value: Book["status"]; label: string }[] = [
  { value: "want-to-read", label: "Want to Read" },
  { value: "reading", label: "Reading" },
  { value: "done", label: "Done" },
  { value: "abandoned", label: "Abandoned" },
];

function defaultForm(book?: Book): BookFormData {
  return book
    ? {
        title: book.title,
        author: book.author ?? "",
        isbn: book.isbn ?? "",
        status: book.status,
        rating: book.rating ?? undefined,
        notes: book.notes ?? "",
        started_at: book.started_at ?? undefined,
        finished_at: book.finished_at ?? undefined,
        cover_url: book.cover_url ?? "",
      }
    : {
        title: "",
        author: "",
        isbn: "",
        status: "want-to-read",
        rating: undefined,
        notes: "",
        started_at: undefined,
        finished_at: undefined,
        cover_url: "",
      };
}

export function BookForm({ open, onOpenChange, book, onSubmit }: BookFormProps) {
  const [form, setForm] = useState<BookFormData>(() => defaultForm(book));
  const [errors, setErrors] = useState<Partial<Record<keyof BookFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(defaultForm(book));
      setErrors({});
    }
  }, [open, book]);

  function handleOpenChange(val: boolean) {
    onOpenChange(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = bookSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof BookFormData;
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

  const inputCls = (error?: string) =>
    cn(
      "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-ring",
      error && "border-destructive"
    );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              {book ? "Edit Book" : "Add Book"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="title">
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Book title"
                className={inputCls(errors.title)}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            {/* Author */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="author">
                Author
              </label>
              <input
                id="author"
                type="text"
                value={form.author ?? ""}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="Author name"
                className={inputCls()}
              />
            </div>

            {/* ISBN */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="isbn">
                ISBN
                <span className="ml-1 text-xs text-muted-foreground">
                  (used for cover image)
                </span>
              </label>
              <input
                id="isbn"
                type="text"
                value={form.isbn ?? ""}
                onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                placeholder="ISBN-10 or ISBN-13"
                className={inputCls(errors.isbn)}
              />
              {errors.isbn && <p className="text-xs text-destructive">{errors.isbn}</p>}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as Book["status"] })
                }
                className={inputCls()}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="started_at">
                  Started
                </label>
                <input
                  id="started_at"
                  type="date"
                  value={form.started_at ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, started_at: e.target.value || undefined })
                  }
                  className={inputCls()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="finished_at">
                  Finished
                </label>
                <input
                  id="finished_at"
                  type="date"
                  value={form.finished_at ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, finished_at: e.target.value || undefined })
                  }
                  className={inputCls()}
                />
              </div>
            </div>

            {/* Rating */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="rating">
                Rating (1–5)
              </label>
              <input
                id="rating"
                type="number"
                min={1}
                max={5}
                value={form.rating ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rating: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="Leave blank if unrated"
                className={inputCls(errors.rating)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Your thoughts, highlights, quotes…"
                rows={4}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
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
                {submitting ? "Saving…" : book ? "Save Changes" : "Add Book"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
