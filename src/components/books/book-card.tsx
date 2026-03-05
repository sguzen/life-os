"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, BookOpen, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Book } from "@/lib/types";

interface BookCardProps {
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

export function BookCard({ book }: BookCardProps) {
  const statusCfg = STATUS_CONFIG[book.status];
  const StatusIcon = statusCfg.icon;

  return (
    <Link href={`/books/${book.id}`} className="group">
      <div className="flex gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40">
        {/* Cover image */}
        <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              fill
              className="object-cover"
              sizes="64px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate font-medium leading-tight group-hover:text-accent-foreground">
            {book.title}
          </p>
          {book.author && (
            <p className="truncate text-sm text-muted-foreground">{book.author}</p>
          )}

          <div className="mt-auto flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                statusCfg.className
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </span>

            {book.rating && (
              <span className="flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: book.rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-current" />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
