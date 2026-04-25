"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveGoals, upsertDailyLog } from "@/lib/supabase/goals-logs";
import type { GoalCategory, UserGoal } from "@/lib/supabase/goals-logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  category: GoalCategory;
}

function toInputType(value: unknown): "number" | "text" {
  return typeof value === "number" ? "number" : "text";
}

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DynamicLogForm({ category }: Props) {
  const supabase = createClient();
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getActiveGoals(supabase, category).then((data) => {
      if (cancelled) return;
      setGoals(data);

      // Pre-populate field defaults from target_metrics
      const defaults: Record<string, string> = {};
      for (const goal of data) {
        for (const key of Object.keys(goal.target_metrics)) {
          defaults[key] = "";
        }
      }
      setValues(defaults);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [category]);

  // Collect all metric fields from all goals (deduped)
  const metricFields = Array.from(
    new Set(goals.flatMap((g) => Object.keys(g.target_metrics)))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const metrics: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      const num = parseFloat(v);
      metrics[k] = isNaN(num) ? v : num;
    }

    startTransition(async () => {
      const { error } = await upsertDailyLog(
        supabase,
        user.id,
        category,
        today,
        metrics,
        notes || undefined
      );

      if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No active goals for this domain yet.{" "}
          <span className="text-foreground">Ask your coach to set some up.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Log Today</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {metricFields.map((key) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{humanize(key)}</Label>
              <Input
                id={key}
                type={toInputType(
                  goals[0]?.target_metrics[key]
                )}
                placeholder={`e.g. ${goals[0]?.target_metrics[key] ?? ""}`}
                value={values[key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="How did it go? Any observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className={cn("w-full", saved && "bg-green-600 hover:bg-green-600")}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            ) : null}
            {saved ? "Saved!" : "Save Log"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
