"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import {
  tradingSessionSchema,
  type TradingSessionFormValues,
  MOOD_RATINGS,
} from "@/lib/validations/trading";
import { getTradingSession, upsertTradingSession } from "@/lib/supabase/trading";
import { cn } from "@/lib/utils";
import type { TradingSessionJournal } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const MOOD_EMOJIS: Record<string, string> = {
  "1": "😞",
  "2": "😕",
  "3": "😐",
  "4": "🙂",
  "5": "😄",
};

function emptyForm(date: string): TradingSessionFormValues {
  return {
    session_date: date,
    pre_market_notes: null,
    mood_before: null,
    plan: null,
    post_market_notes: null,
    mood_after: null,
    lessons: null,
    followed_plan: null,
  };
}

function fromSession(s: TradingSessionJournal): TradingSessionFormValues {
  return {
    session_date: s.session_date,
    pre_market_notes: s.pre_market_notes,
    mood_before: s.mood_before,
    plan: s.plan,
    post_market_notes: s.post_market_notes,
    mood_after: s.mood_after,
    lessons: s.lessons,
    followed_plan: s.followed_plan,
  };
}

export function SessionJournal() {
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState<TradingSessionFormValues>(emptyForm(date));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load session for the selected date
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaved(false);

    getTradingSession(date)
      .then((session) => {
        if (cancelled) return;
        setForm(session ? fromSession(session) : emptyForm(date));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load session");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [date]);

  function changeDate(days: number) {
    setDate(offsetDate(date, days));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await upsertTradingSession({ ...form, session_date: date });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const textAreaCls = "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  const isToday = date === todayISO();

  return (
    <div className="space-y-4">
      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => changeDate(-1)}
          className="rounded-md border p-1.5 hover:bg-accent text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold">{formatDisplayDate(date)}</p>
          {isToday && (
            <p className="text-xs text-muted-foreground">Today</p>
          )}
        </div>
        <button
          onClick={() => changeDate(1)}
          disabled={isToday}
          className="rounded-md border p-1.5 hover:bg-accent text-muted-foreground disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayISO()}
          className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="rounded-xl border p-8 text-center text-muted-foreground text-sm">
          Loading…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Pre-market section */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Pre-Market</h3>

            {/* Mood Before */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mood Before Trading</label>
              <div className="flex gap-2">
                {MOOD_RATINGS.map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setForm({ ...form, mood_before: rating as TradingSessionFormValues["mood_before"] })}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-center transition-colors",
                      form.mood_before === rating
                        ? "border-primary bg-primary/10"
                        : "hover:border-primary/40 hover:bg-accent"
                    )}
                  >
                    <span className="text-lg">{MOOD_EMOJIS[rating]}</span>
                    <span className="text-xs text-muted-foreground">{rating}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pre-market notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Market Bias & Key Levels</label>
              <textarea
                value={form.pre_market_notes ?? ""}
                onChange={(e) => setForm({ ...form, pre_market_notes: e.target.value || null })}
                rows={3}
                placeholder="HTF bias, key support/resistance, upcoming news events…"
                className={textAreaCls}
              />
            </div>

            {/* Plan */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Trade Plan for Today</label>
              <textarea
                value={form.plan ?? ""}
                onChange={(e) => setForm({ ...form, plan: e.target.value || null })}
                rows={4}
                placeholder="What setups are you looking for? What are your rules for today?"
                className={textAreaCls}
              />
            </div>
          </div>

          {/* Post-market section */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Post-Market</h3>

            {/* Mood After */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mood After Trading</label>
              <div className="flex gap-2">
                {MOOD_RATINGS.map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setForm({ ...form, mood_after: rating as TradingSessionFormValues["mood_after"] })}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-center transition-colors",
                      form.mood_after === rating
                        ? "border-primary bg-primary/10"
                        : "hover:border-primary/40 hover:bg-accent"
                    )}
                  >
                    <span className="text-lg">{MOOD_EMOJIS[rating]}</span>
                    <span className="text-xs text-muted-foreground">{rating}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Post notes */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Session Recap</label>
              <textarea
                value={form.post_market_notes ?? ""}
                onChange={(e) => setForm({ ...form, post_market_notes: e.target.value || null })}
                rows={3}
                placeholder="How did the session go? Key observations…"
                className={textAreaCls}
              />
            </div>

            {/* Lessons */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Lessons Learned Today</label>
              <textarea
                value={form.lessons ?? ""}
                onChange={(e) => setForm({ ...form, lessons: e.target.value || null })}
                rows={3}
                placeholder="What did you learn? What will you do differently tomorrow?"
                className={textAreaCls}
              />
            </div>

            {/* Followed Plan */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Did you stick to your plan?</label>
              <div className="flex gap-2">
                {[
                  { val: true, label: "✓ Yes" },
                  { val: false, label: "✗ No" },
                  { val: null, label: "— N/A" },
                ].map(({ val, label }) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm({ ...form, followed_plan: val })}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                      form.followed_plan === val
                        ? val === true
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : val === false
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-muted border-border"
                        : "hover:bg-accent border-border"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <p className="text-sm text-emerald-600 font-medium">Saved!</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save Journal"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
