"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { BookCard } from "./book-card";
import { BookForm } from "./book-form";
import { createClient } from "@/lib/supabase/client";
import { createBook, updateBook, deleteBook } from "@/lib/supabase/books";
import type { Book } from "@/lib/types";
import type { BookFormData } from "@/lib/validations/books";

type FilterStatus = "all" | Book["status"];

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All Books" },
  { value: "reading", label: "Reading" },
  { value: "want-to-read", label: "Want to Read" },
  { value: "done", label: "Done" },
  { value: "abandoned", label: "Abandoned" },
];

interface BooksViewProps {
  initialBooks: Book[];
}

export function BooksView({ initialBooks }: BooksViewProps) {
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | undefined>();
  const router = useRouter();

  const filtered =
    filter === "all" ? books : books.filter((b) => b.status === filter);

  const counts = {
    reading: books.filter((b) => b.status === "reading").length,
    "want-to-read": books.filter((b) => b.status === "want-to-read").length,
    done: books.filter((b) => b.status === "done").length,
  };

  function openCreate() {
    setEditingBook(undefined);
    setFormOpen(true);
  }

  function openEdit(book: Book) {
    setEditingBook(book);
    setFormOpen(true);
  }

  async function handleSubmit(data: BookFormData) {
    const supabase = createClient();
    if (editingBook) {
      const updated = await updateBook(supabase, editingBook.id, data);
      setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } else {
      const created = await createBook(supabase, data);
      setBooks((prev) => [created, ...prev]);
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this book? This cannot be undone.")) return;
    const supabase = createClient();
    await deleteBook(supabase, id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookshelf</h1>
          <p className="text-sm text-muted-foreground">
            {counts.reading > 0 && `${counts.reading} reading · `}
            {counts["want-to-read"]} to read · {counts.done} finished
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Book
        </button>
      </div>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value as FilterStatus)}
        className="w-48 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {FILTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Book grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {filter === "all"
              ? "No books yet. Add your first book!"
              : `No books with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <BookForm
        open={formOpen}
        onOpenChange={setFormOpen}
        book={editingBook}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
