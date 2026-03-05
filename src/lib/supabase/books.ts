import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book } from "@/lib/types";
import type { BookFormData } from "@/lib/validations/books";

// Open Library cover image URL helper
// Falls back to null if no ISBN provided
export function openLibraryCoverUrl(isbn: string | null | undefined): string | null {
  if (!isbn) return null;
  const clean = isbn.replace(/[-\s]/g, "");
  if (!clean) return null;
  return `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg`;
}

export async function getBooks(supabase: SupabaseClient): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Book[];
}

export async function getBook(supabase: SupabaseClient, id: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Book;
}

export async function createBook(
  supabase: SupabaseClient,
  input: BookFormData
): Promise<Book> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const coverUrl =
    input.cover_url && input.cover_url !== ""
      ? input.cover_url
      : openLibraryCoverUrl(input.isbn);

  const { data, error } = await supabase
    .from("books")
    .insert({
      user_id: user.id,
      title: input.title,
      author: input.author || null,
      isbn: input.isbn || null,
      status: input.status,
      rating: input.rating ?? null,
      notes: input.notes || null,
      started_at: input.started_at || null,
      finished_at: input.finished_at || null,
      cover_url: coverUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Book;
}

export async function updateBook(
  supabase: SupabaseClient,
  id: string,
  input: BookFormData
): Promise<Book> {
  const coverUrl =
    input.cover_url && input.cover_url !== ""
      ? input.cover_url
      : openLibraryCoverUrl(input.isbn);

  const { data, error } = await supabase
    .from("books")
    .update({
      title: input.title,
      author: input.author || null,
      isbn: input.isbn || null,
      status: input.status,
      rating: input.rating ?? null,
      notes: input.notes || null,
      started_at: input.started_at || null,
      finished_at: input.finished_at || null,
      cover_url: coverUrl,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Book;
}

export async function deleteBook(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) throw error;
}
