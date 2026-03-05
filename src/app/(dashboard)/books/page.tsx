import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Books",
  description: "Personal reading list and book notes",
};
import { getBooks } from "@/lib/supabase/books";
import { BooksView } from "@/components/books/books-view";

export default async function BooksPage() {
  const supabase = createClient();
  const books = await getBooks(supabase);

  return <BooksView initialBooks={books} />;
}
