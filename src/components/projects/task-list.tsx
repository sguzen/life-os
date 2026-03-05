"use client";

import { useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createTask, updateTask, deleteTask } from "@/lib/supabase/projects";
import type { ProjectTask } from "@/lib/types";

interface TaskListProps {
  projectId: string;
  initialTasks: ProjectTask[];
}

const STATUS_CYCLE: Record<ProjectTask["status"], ProjectTask["status"]> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

export function TaskList({ projectId, initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>(initialTasks);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const supabase = createClient();
      const task = await createTask(supabase, projectId, {
        title,
        status: "todo",
        notes: "",
      });
      setTasks((prev) => [...prev, task]);
      setNewTitle("");
    } finally {
      setAdding(false);
    }
  }

  async function handleCycleStatus(task: ProjectTask) {
    const nextStatus = STATUS_CYCLE[task.status];
    const supabase = createClient();
    const updated = await updateTask(supabase, task.id, { status: nextStatus });
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await deleteTask(supabase, id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const columns: { label: string; status: ProjectTask["status"] }[] = [
    { label: "To Do", status: "todo" },
    { label: "In Progress", status: "in_progress" },
    { label: "Done", status: "done" },
  ];

  return (
    <div className="space-y-4">
      {/* Add task */}
      <form onSubmit={handleAddTask} className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New task…"
          disabled={adding}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium">{col.label}</h3>
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
              </div>

              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-start gap-2 rounded-md border bg-card p-2.5"
                  >
                    <button
                      onClick={() => handleCycleStatus(task)}
                      className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      title="Click to advance status"
                    >
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : task.status === "in_progress" ? (
                        <Loader className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>

                    <span
                      className={cn(
                        "flex-1 text-sm",
                        task.status === "done" && "text-muted-foreground line-through"
                      )}
                    >
                      {task.title}
                    </span>

                    <button
                      onClick={() => handleDelete(task.id)}
                      className="flex-shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
