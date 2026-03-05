"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, BookOpen, CheckCircle2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { StrategyForm } from "./strategy-form";
import { deleteStrategy } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type { Strategy } from "@/lib/types";

interface Props {
  strategies: Strategy[];
  onStrategiesChange: (strategies: Strategy[]) => void;
}

export function StrategiesView({ strategies, onStrategiesChange }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Strategy | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(s: Strategy) {
    setEditing(s);
    setFormOpen(true);
  }

  function handleSaved(saved: Strategy) {
    if (editing) {
      onStrategiesChange(strategies.map((s) => (s.id === saved.id ? saved : s)));
    } else {
      onStrategiesChange([saved, ...strategies]);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteStrategy(id);
      onStrategiesChange(strategies.filter((s) => s.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Strategies</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Strategy
        </button>
      </div>

      {strategies.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">No strategies yet.</p>
          <p className="text-xs mt-1">Create a strategy to attach to your trades.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {strategies.map((s) => (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border bg-card overflow-hidden",
                !s.is_active && "opacity-60"
              )}
            >
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{s.name}</span>
                    {s.is_active && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>
                  )}
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Instrument pills */}
                  <div className="hidden sm:flex gap-1">
                    {(s.instruments ?? []).map((inst) => (
                      <span
                        key={inst}
                        className="rounded-full bg-accent px-2 py-0.5 text-xs"
                      >
                        {inst}
                      </span>
                    ))}
                  </div>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="rounded-md p-1 text-muted-foreground hover:bg-accent">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                          <circle cx="4" cy="8" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="12" cy="8" r="1.5" />
                        </svg>
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="z-50 min-w-[130px] rounded-lg border bg-card p-1 shadow-lg"
                        align="end"
                        sideOffset={4}
                      >
                        <DropdownMenu.Item
                          onClick={() => openEdit(s)}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent outline-none"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={() => handleDelete(s.id)}
                          disabled={deleting === s.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 outline-none disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deleting === s.id ? "Deleting…" : "Delete"}
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>

              {/* Expanded rules */}
              {expanded === s.id && s.rules && (
                <div className="border-t bg-muted/30 px-4 py-3">
                  <pre className="whitespace-pre-wrap text-xs font-mono text-foreground/80 leading-relaxed">
                    {s.rules}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <StrategyForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        initial={editing}
      />
    </div>
  );
}
