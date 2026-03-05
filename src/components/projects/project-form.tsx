"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { projectSchema, PROJECT_COLORS, type ProjectFormData } from "@/lib/validations/projects";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
  onSubmit: (data: ProjectFormData) => Promise<void>;
}

const STATUS_OPTIONS: { value: Project["status"]; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
  { value: "abandoned", label: "Abandoned" },
];

function defaultForm(project?: Project): ProjectFormData {
  return project
    ? {
        name: project.name,
        description: project.description ?? "",
        status: project.status,
        color: project.color,
      }
    : {
        name: "",
        description: "",
        status: "active",
        color: PROJECT_COLORS[0],
      };
}

export function ProjectForm({ open, onOpenChange, project, onSubmit }: ProjectFormProps) {
  const [form, setForm] = useState<ProjectFormData>(() => defaultForm(project));
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(val: boolean) {
    if (val) {
      setForm(defaultForm(project));
      setErrors({});
    }
    onOpenChange(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = projectSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ProjectFormData;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = (error?: string) =>
    cn(
      "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-ring",
      error && "border-destructive"
    );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              {project ? "Edit Project" : "New Project"}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="proj-name">
                Name *
              </label>
              <input
                id="proj-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Project name"
                className={inputCls(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="proj-desc">
                Description
              </label>
              <textarea
                id="proj-desc"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this project about?"
                rows={3}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="proj-status">
                Status
              </label>
              <select
                id="proj-status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as Project["status"] })
                }
                className={inputCls()}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Color</p>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={cn(
                      "h-7 w-7 rounded-full transition-transform",
                      form.color === color && "scale-125 ring-2 ring-ring ring-offset-2"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Saving…" : project ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
