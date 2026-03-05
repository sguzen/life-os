"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Pause, XCircle, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, ProjectTask } from "@/lib/types";

interface ProjectCardProps {
  project: Project;
  tasks?: ProjectTask[];
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
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

export function ProjectCard({ project, tasks = [], onEdit, onDelete }: ProjectCardProps) {
  const statusCfg = STATUS_CONFIG[project.status];
  const StatusIcon = statusCfg.icon;
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;

  return (
    <div className="group relative rounded-lg border bg-card transition-colors hover:bg-accent/40">
      {/* Action buttons — top-right, revealed on hover */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onEdit(project)}
          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(project.id)}
          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Clickable area navigates to detail */}
      <Link href={`/projects/${project.id}`} className="block p-4">
        <div className="flex items-start gap-3">
          {/* Color dot */}
          <div
            className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />

          <div className="flex-1 min-w-0">
            <p className="truncate pr-12 font-medium">{project.name}</p>
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
      </Link>
    </div>
  );
}
