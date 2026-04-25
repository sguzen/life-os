"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRecentLogs } from "@/lib/supabase/goals-logs";
import type { GoalCategory, DailyLog } from "@/lib/supabase/goals-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Props {
  category: GoalCategory;
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecentLogs({ category }: Props) {
  const supabase = createClient();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRecentLogs(supabase, category).then((data) => {
      if (!cancelled) {
        setLogs(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [category]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No entries yet. Start logging above.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="border rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {new Date(log.date).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(log.metrics).map(([k, v]) => (
                <span key={k} className="text-sm">
                  <span className="text-muted-foreground">{humanize(k)}: </span>
                  <span className="font-medium">{String(v)}</span>
                </span>
              ))}
            </div>
            {log.journal_notes && (
              <p className="text-xs text-muted-foreground italic">{log.journal_notes}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
