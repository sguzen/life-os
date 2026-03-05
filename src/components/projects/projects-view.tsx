"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProjectCard } from "./project-card";
import { ProjectForm } from "./project-form";
import { createClient } from "@/lib/supabase/client";
import { createProject, updateProject, deleteProject } from "@/lib/supabase/projects";
import type { Project } from "@/lib/types";
import type { ProjectFormData } from "@/lib/validations/projects";

type FilterStatus = "all" | Project["status"];

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All Projects" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
  { value: "abandoned", label: "Abandoned" },
];

interface ProjectsViewProps {
  initialProjects: Project[];
}

export function ProjectsView({ initialProjects }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [filter, setFilter] = useState<FilterStatus>("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const router = useRouter();

  const filtered =
    filter === "all" ? projects : projects.filter((p) => p.status === filter);

  const active = projects.filter((p) => p.status === "active").length;

  function openCreate() {
    setEditingProject(undefined);
    setFormOpen(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setFormOpen(true);
  }

  async function handleSubmit(data: ProjectFormData) {
    const supabase = createClient();
    if (editingProject) {
      const updated = await updateProject(supabase, editingProject.id, data);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const created = await createProject(supabase, data);
      setProjects((prev) => [created, ...prev]);
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project and all its tasks? This cannot be undone.")) return;
    const supabase = createClient();
    await deleteProject(supabase, id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {active} active · {projects.length} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value as FilterStatus)}
        className="w-48 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {FILTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Projects grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {filter === "all"
              ? "No projects yet. Create your first project!"
              : `No ${filter} projects.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ProjectForm
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editingProject}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
