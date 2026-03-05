"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Star,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Pencil,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { BookForm } from "./book-form";
import { createClient } from "@/lib/supabase/client";
import { updateBook, deleteBook } from "@/lib/supabase/books";
import { cn } from "@/lib/utils";
import type { Book } from "@/lib/types";
import type { BookFormData } from "@/lib/validations/books";

interface BookDetailProps {
  book: Book;
}

const STATUS_CONFIG: Record<
  Book["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  "want-to-read": {
    label: "Want to Read",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  reading: {
    label: "Reading",
    icon: BookOpen,
    className: "bg-blue-500/10 text-blue-500",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    className: "bg-green-500/10 text-green-500",
  },
  abandoned: {
    label: "Abandoned",
    icon: XCircle,
    className: "bg-rose-500/10 text-rose-500",
  },
};

export function BookDetail({ book: initialBook }: BookDetailProps) {
  const [book, setBook] = useState<Book>(initialBook);
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();

  const statusCfg = STATUS_CONFIG[book.status];
  const StatusIcon = statusCfg.icon;

  async function handleUpdate(data: BookFormData) {
    const supabase = createClient();
    const updated = await updateBook(supabase, book.id, data);
    setBook(updated);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    const supabase = createClient();
    await deleteBook(supabase, book.id);
    router.push("/books");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/books"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Bookshelf
      </Link>

      {/* Header card */}
      <div className="flex gap-6 rounded-lg border bg-card p-6">
        {/* Cover */}
        <div className="relative h-40 w-28 flex-shrink-0 overflow-hidden rounded">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              fill
              className="object-cover"
              sizes="112px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-1 flex-col justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold leading-tight">{book.title}</h1>
            {book.author && (
              <p className="text-muted-foreground">{book.author}</p>
            )}
            {book.isbn && (
              <p className="text-xs text-muted-foreground">ISBN: {book.isbn}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                statusCfg.className
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </span>

            {book.rating && (
              <span className="flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < book.rating! ? "fill-current" : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </span>
            )}

            {book.started_at && (
              <span className="text-xs text-muted-foreground">
                Started {book.started_at}
              </span>
            )}
            {book.finished_at && (
              <span className="text-xs text-muted-foreground">
                · Finished {book.finished_at}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Notes */}
      {book.notes && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {book.notes}
          </p>
        </div>
      )}

      <BookForm
        open={editOpen}
        onOpenChange={setEditOpen}
        book={book}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
