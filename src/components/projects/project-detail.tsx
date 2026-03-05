"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Pause,
  XCircle,
} from "lucide-react";
import { TaskList } from "./task-list";
import { ProjectForm } from "./project-form";
import { createClient } from "@/lib/supabase/client";
import { updateProject, deleteProject } from "@/lib/supabase/projects";
import { cn } from "@/lib/utils";
import type { ProjectWithTasks, Project } from "@/lib/types";
import type { ProjectFormData } from "@/lib/validations/projects";

interface ProjectDetailProps {
  project: ProjectWithTasks;
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

export function ProjectDetail({ project: initialProject }: ProjectDetailProps) {
  const [project, setProject] = useState<ProjectWithTasks>(initialProject);
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();

  const statusCfg = STATUS_CONFIG[project.status];
  const StatusIcon = statusCfg.icon;

  const done = project.tasks.filter((t) => t.status === "done").length;
  const total = project.tasks.length;

  async function handleUpdate(data: ProjectFormData) {
    const supabase = createClient();
    const updated = await updateProject(supabase, project.id, data);
    setProject((prev) => ({ ...prev, ...updated }));
  }

  async function handleDelete() {
    if (!confirm(`Delete "${project.name}"? This will also delete all tasks.`)) return;
    const supabase = createClient();
    await deleteProject(supabase, project.id);
    router.push("/projects");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {/* Color dot */}
            <div
              className="mt-1.5 h-4 w-4 flex-shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="mt-1 text-muted-foreground">{project.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                    statusCfg.className
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusCfg.label}
                </span>
                {total > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {done}/{total} tasks complete
                  </span>
                )}
              </div>
              {total > 0 && (
                <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round((done / total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 font-semibold">Tasks</h2>
        <TaskList projectId={project.id} initialTasks={project.tasks} />
      </div>

      <ProjectForm
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
