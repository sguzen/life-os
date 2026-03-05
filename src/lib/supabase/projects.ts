import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project, ProjectTask, ProjectWithTasks } from "@/lib/types";
import type { ProjectFormData, TaskFormData } from "@/lib/validations/projects";

// ---- Projects ----

export async function getProjects(supabase: SupabaseClient): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProject(
  supabase: SupabaseClient,
  id: string
): Promise<ProjectWithTasks | null> {
  const [{ data: projectData, error: projectError }, { data: tasksData, error: tasksError }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", id)
        .order("position", { ascending: true }),
    ]);

  if (projectError) {
    if (projectError.code === "PGRST116") return null;
    throw projectError;
  }
  if (tasksError) throw tasksError;

  return {
    ...(projectData as Project),
    tasks: (tasksData ?? []) as ProjectTask[],
  };
}

export async function createProject(
  supabase: SupabaseClient,
  input: ProjectFormData
): Promise<Project> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description || null,
      status: input.status,
      color: input.color,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  supabase: SupabaseClient,
  id: string,
  input: ProjectFormData
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: input.name,
      description: input.description || null,
      status: input.status,
      color: input.color,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ---- Tasks ----

export async function createTask(
  supabase: SupabaseClient,
  projectId: string,
  input: TaskFormData
): Promise<ProjectTask> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // get max position for ordering
  const { data: maxRow } = await supabase
    .from("project_tasks")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = maxRow ? (maxRow as { position: number }).position + 1 : 0;

  const { data, error } = await supabase
    .from("project_tasks")
    .insert({
      user_id: user.id,
      project_id: projectId,
      title: input.title,
      status: input.status,
      notes: input.notes || null,
      position,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectTask;
}

export async function updateTask(
  supabase: SupabaseClient,
  id: string,
  input: Partial<TaskFormData>
): Promise<ProjectTask> {
  const { data, error } = await supabase
    .from("project_tasks")
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectTask;
}

export async function deleteTask(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("project_tasks").delete().eq("id", id);
  if (error) throw error;
}
