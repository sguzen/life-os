import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBook } from "@/lib/supabase/books";
import { BookDetail } from "@/components/books/book-detail";

interface Props {
  params: { id: string };
}

export default async function BookPage({ params }: Props) {
  const supabase = createClient();
  const book = await getBook(supabase, params.id);

  if (!book) notFound();

  return <BookDetail book={book} />;
}
