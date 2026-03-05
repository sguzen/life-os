import { createClient } from "@/lib/supabase/server";
import { getBooks } from "@/lib/supabase/books";
import { BooksView } from "@/components/books/books-view";

export default async function BooksPage() {
  const supabase = createClient();
  const books = await getBooks(supabase);

  return <BooksView initialBooks={books} />;
}
