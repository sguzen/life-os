"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Pause, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, ProjectTask } from "@/lib/types";

interface ProjectCardProps {
  project: Project;
  tasks?: ProjectTask[];
}

const STATUS_CONFIG: Record<
  Project["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  active: {
    label: "Active",
    icon: Circle,
    className: "bg-blue-500/10 text-blue-500",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    className: "bg-amber-500/10 text-amber-500",
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

export function ProjectCard({ project, tasks = [] }: ProjectCardProps) {
  const statusCfg = STATUS_CONFIG[project.status];
  const StatusIcon = statusCfg.icon;
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;

  return (
    <Link href={`/projects/${project.id}`} className="group">
      <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40">
        <div className="flex items-start gap-3">
          {/* Color dot */}
          <div
            className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />

          <div className="flex-1 min-w-0">
            <p className="truncate font-medium group-hover:text-accent-foreground">
              {project.name}
            </p>
            {project.description && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {project.description}
              </p>
            )}

            <div className="mt-3 flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  statusCfg.className
                )}
              >
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </span>

              {total > 0 && (
                <span className="text-xs text-muted-foreground">
                  {done}/{total} tasks
                </span>
              )}
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((done / total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
