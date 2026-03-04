"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { todayDate } from "@/lib/supabase/habits";
import type { HabitWithLogs } from "@/lib/types";

interface HabitChartProps {
  habits: HabitWithLogs[];
}

/** Build a 30-day completion-rate dataset across all habits. */
function buildChartData(habits: HabitWithLogs[]) {
  const today = todayDate();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().slice(0, 10);

    const total = habits.length;
    const done = habits.filter((h) =>
      h.logs.some((l) => l.logged_at === dateStr)
    ).length;

    return {
      date: dateStr,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pct: total === 0 ? 0 : Math.round((done / total) * 100),
      done,
      total,
    };
  });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ReturnType<typeof buildChartData>[number] }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const { done, total, pct } = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">
        {done}/{total} habits — {pct}%
      </p>
    </div>
  );
}

export function HabitChart({ habits }: HabitChartProps) {
  const data = buildChartData(habits);

  if (habits.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        30-day completion rate
      </h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barCategoryGap="30%">
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--accent))" }} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={entry.pct === 100 ? "#22c55e" : entry.pct >= 50 ? "#6366f1" : "hsl(var(--muted))"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
